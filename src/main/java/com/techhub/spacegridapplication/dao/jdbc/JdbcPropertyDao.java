package com.techhub.spacegridapplication.dao.jdbc;

import com.techhub.spacegridapplication.dao.PropertyDao;
import com.techhub.spacegridapplication.model.Amenities;
import com.techhub.spacegridapplication.model.CommonArea;
import com.techhub.spacegridapplication.model.CommonAreaType;
import com.techhub.spacegridapplication.model.DemoImages;
import com.techhub.spacegridapplication.model.Dimensions;
import com.techhub.spacegridapplication.model.EdgeType;
import com.techhub.spacegridapplication.model.GridEdge;
import com.techhub.spacegridapplication.model.GridPosition;
import com.techhub.spacegridapplication.model.GridZone;
import com.techhub.spacegridapplication.model.Orientation;
import com.techhub.spacegridapplication.model.Property;
import com.techhub.spacegridapplication.model.PropertyStatus;
import com.techhub.spacegridapplication.model.PropertyListing;
import com.techhub.spacegridapplication.model.PropertyType;
import com.techhub.spacegridapplication.model.RentableUnit;
import com.techhub.spacegridapplication.model.StoredFile;
import com.techhub.spacegridapplication.model.UnitListing;
import com.techhub.spacegridapplication.model.UnitStatus;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/** PropertyDao with JdbcTemplate. Table(s): properties. */
@Repository
public class JdbcPropertyDao implements PropertyDao {

    private final JdbcTemplate jdbcTemplate;
    private final RowMapper<Property> rowMapper;

    private static final String ZONES_SQL = """
            SELECT z.id, z.created_at, z.property_id, z.zone_kind, z.name,
                   u.rental_rate, u.is_exact_size, u.size_description, u.area_sqm,
                   u.includes_electricity, u.includes_water, u.status, c.area_type, c.color
            FROM grid_zones z
            LEFT JOIN rentable_units u ON u.zone_id = z.id
            LEFT JOIN common_areas c ON c.zone_id = z.id
            WHERE z.property_id = ?
            ORDER BY z.id
            """;

    /** Every property column, plus the id of its first property photo (NULL if it has none). */
    private static final String SELECT_PROPERTIES = """
            SELECT p.*,
                   (SELECT MIN(f.id) FROM uploaded_files f
                    WHERE f.property_id = p.id AND f.file_kind = 'PROPERTY_PHOTO') AS cover_photo_id
            FROM properties p
            """;

    /** Homepage: ACTIVE properties with the landlord's name. The optional "AND p.id = ?" is added by loadListings. */
    private static final String LISTINGS_SQL = """
            SELECT p.id, p.name, CONCAT_WS(', ', p.address, p.city, p.region) AS address,
                   p.property_type, p.description, p.created_at,
                   p.has_parking, p.has_power_backup, p.has_security, p.has_water_access, p.is_open_24h,
                   (SELECT MIN(f.id) FROM uploaded_files f
                    WHERE f.property_id = p.id AND f.file_kind = 'PROPERTY_PHOTO') AS cover_photo_id,
                   usr.full_name AS landlord_name
            FROM properties p
            JOIN users usr ON usr.id = p.landlord_id
            WHERE p.status = 'ACTIVE'
            """;

    /** Homepage: the AVAILABLE units ("blocks") of ACTIVE properties. */
    private static final String AVAILABLE_UNITS_SQL = """
            SELECT z.property_id, z.id, z.name, u.rental_rate, u.is_exact_size, u.size_description, u.area_sqm,
                   u.includes_electricity, u.includes_water
            FROM grid_zones z
            JOIN rentable_units u ON u.zone_id = z.id
            JOIN properties p ON p.id = z.property_id
            WHERE p.status = 'ACTIVE' AND u.status = 'AVAILABLE'
            ORDER BY z.property_id, z.id
            """;

    public JdbcPropertyDao(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        this.rowMapper = (rs, rowNum) -> {
            int id = rs.getInt("id");
            return new Property(
                    id,
                    rs.getTimestamp("created_at").toLocalDateTime(),
                    rs.getInt("landlord_id"),
                    rs.getString("name"),
                    rs.getString("address"),
                    rs.getString("city"),
                    rs.getString("region"),
                    PropertyType.valueOf(rs.getString("property_type")),
                    rs.getString("description"),
                    readDimensions(rs),
                    rs.getBigDecimal("default_rate"),
                    readAmenities(rs),
                    PropertyStatus.valueOf(rs.getString("status")),
                    rs.getInt("grid_rows"),
                    rs.getInt("grid_columns"),
                    loadZones(id),
                    loadEdgeOverrides(id),
                    rs.getObject("cover_photo_id", Integer.class));
        };
    }

    @Override
    public Optional<Property> findById(int id) {
        return jdbcTemplate.query(SELECT_PROPERTIES + " WHERE p.id = ?", rowMapper, id).stream().findFirst();
    }

    /** INSERT, then entity.assignId(generated key). A new property has no zones yet. */
    @Override
    public Property save(Property entity) {
        Dimensions size = entity.getDimensions();
        Amenities amenities = entity.getAmenities();
        KeyHolder keys = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement("""
                    INSERT INTO properties (landlord_id, name, address, city, region, property_type, description,
                                            is_exact_size, size_description, area_sqm, default_rate,
                                            has_parking, has_power_backup, has_security, has_water_access, is_open_24h,
                                            status, grid_rows, grid_columns)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, Statement.RETURN_GENERATED_KEYS);
            ps.setInt(1, entity.getLandlordId());
            ps.setString(2, entity.getName());
            ps.setString(3, entity.getAddress());
            ps.setString(4, entity.getCity());
            ps.setString(5, entity.getRegion());
            ps.setString(6, entity.getPropertyType().name());
            ps.setString(7, entity.getDescription());
            ps.setObject(8, size == null ? null : size.exact());
            ps.setString(9, size == null ? null : size.description());
            ps.setBigDecimal(10, size == null ? null : size.areaSqm());
            ps.setBigDecimal(11, entity.getDefaultRate());
            ps.setBoolean(12, amenities.parking());
            ps.setBoolean(13, amenities.powerBackup());
            ps.setBoolean(14, amenities.security());
            ps.setBoolean(15, amenities.waterAccess());
            ps.setBoolean(16, amenities.open24h());
            ps.setString(17, entity.getStatus().name());
            ps.setInt(18, entity.getGridRows());
            ps.setInt(19, entity.getGridColumns());
            return ps;
        }, keys);
        entity.assignId(keys.getKey().intValue());
        return entity;
    }

    /** Saves the form fields and the status. The grid is saved separately (saveGridLayout / saveEdgeOverrides). */
    @Override
    public void update(Property entity) {
        Dimensions size = entity.getDimensions();
        Amenities amenities = entity.getAmenities();
        jdbcTemplate.update("""
                UPDATE properties
                SET name = ?, address = ?, city = ?, region = ?, property_type = ?, description = ?,
                    is_exact_size = ?, size_description = ?, area_sqm = ?, default_rate = ?,
                    has_parking = ?, has_power_backup = ?, has_security = ?, has_water_access = ?, is_open_24h = ?,
                    status = ?
                WHERE id = ?
                """,
                entity.getName(), entity.getAddress(), entity.getCity(), entity.getRegion(),
                entity.getPropertyType().name(), entity.getDescription(),
                size == null ? null : size.exact(),
                size == null ? null : size.description(),
                size == null ? null : size.areaSqm(),
                entity.getDefaultRate(),
                amenities.parking(), amenities.powerBackup(), amenities.security(),
                amenities.waterAccess(), amenities.open24h(),
                entity.getStatus().name(),
                entity.getId());
    }

    /** Zones, spots, edges and files go with it (ON DELETE CASCADE); a property with leases can't be deleted (RESTRICT). */
    @Override
    public void deleteById(int id) {
        jdbcTemplate.update("DELETE FROM properties WHERE id = ?", id);
    }

    /** Newest first. */
    @Override
    public List<Property> findByLandlordId(int landlordId) {
        return jdbcTemplate.query(SELECT_PROPERTIES + " WHERE p.landlord_id = ? ORDER BY p.created_at DESC, p.id DESC",
                rowMapper, landlordId);
    }

    /** UPDATE grid size, DELETE + INSERT zone_cells (service method is @Transactional). */
    @Override
    public void saveGridLayout(Property property) {
        jdbcTemplate.update("UPDATE properties SET grid_rows = ?, grid_columns = ? WHERE id = ?",
                property.getGridRows(), property.getGridColumns(), property.getId());
        jdbcTemplate.update("DELETE FROM zone_cells WHERE property_id = ?", property.getId());

        List<Object[]> rows = new ArrayList<>();
        for (GridZone zone : property.getZones()) {
            for (GridPosition position : zone.getPositions()) {
                rows.add(new Object[] {property.getId(), position.row(), position.col(), zone.getId()});
            }
        }
        if (!rows.isEmpty()) {
            jdbcTemplate.batchUpdate(
                    "INSERT INTO zone_cells (property_id, row_idx, col_idx, zone_id) VALUES (?, ?, ?, ?)", rows);
        }
    }

    /** DELETE + INSERT edge_overrides. */
    @Override
    public void saveEdgeOverrides(Property property) {
        jdbcTemplate.update("DELETE FROM edge_overrides WHERE property_id = ?", property.getId());

        List<Object[]> rows = new ArrayList<>();
        property.getEdgeOverrides().forEach((edge, type) -> rows.add(new Object[] {
                property.getId(), edge.row(), edge.col(), edge.orientation().name(), type.name()}));
        if (!rows.isEmpty()) {
            jdbcTemplate.batchUpdate("INSERT INTO edge_overrides (property_id, row_idx, col_idx, orientation, edge_type) "
                    + "VALUES (?, ?, ?, ?, ?)", rows);
        }
    }

    @Override
    public List<PropertyListing> findActiveListings() {
        return loadListings(null);
    }

    @Override
    public Optional<PropertyListing> findActiveListingById(int propertyId) {
        return loadListings(propertyId).stream().findFirst();
    }

    /** Two queries (properties, then their available units), joined here. Properties without a free unit are left out. */
    private List<PropertyListing> loadListings(Integer propertyId) {
        Map<Integer, List<UnitListing>> unitsByProperty = new HashMap<>();
        jdbcTemplate.query(AVAILABLE_UNITS_SQL, rs -> {
            unitsByProperty.computeIfAbsent(rs.getInt("property_id"), k -> new ArrayList<>()).add(new UnitListing(
                    rs.getInt("id"),
                    rs.getString("name"),
                    rs.getBigDecimal("rental_rate"),
                    readDimensions(rs),
                    rs.getBoolean("includes_electricity"),
                    rs.getBoolean("includes_water")));
        });

        String sql = LISTINGS_SQL + (propertyId == null ? "" : " AND p.id = ?") + " ORDER BY p.created_at DESC, p.id DESC";
        RowMapper<PropertyListing> mapper = (rs, rowNum) -> new PropertyListing(
                rs.getInt("id"),
                rs.getString("name"),
                rs.getString("address"),
                PropertyType.valueOf(rs.getString("property_type")),
                rs.getString("description"),
                rs.getString("landlord_name"),
                rs.getTimestamp("created_at").toLocalDateTime(),
                readAmenities(rs),
                coverUrl(rs.getObject("cover_photo_id", Integer.class), rs.getInt("id")),
                unitsByProperty.getOrDefault(rs.getInt("id"), List.of()));
        List<PropertyListing> listings = (propertyId == null)
                ? jdbcTemplate.query(sql, mapper)
                : jdbcTemplate.query(sql, mapper, propertyId);
        return listings.stream().filter(listing -> !listing.units().isEmpty()).toList();
    }

    /** The uploaded cover ("/api/files/7") or, when none, the demo photo that ships with the project. */
    private static String coverUrl(Integer coverFileId, int propertyId) {
        String uploaded = StoredFile.urlOf(coverFileId);
        return (uploaded != null) ? uploaded : DemoImages.coverOfProperty(propertyId);
    }

    /** Reads the five amenity columns. */
    private static Amenities readAmenities(ResultSet rs) throws SQLException {
        return new Amenities(rs.getBoolean("has_parking"), rs.getBoolean("has_power_backup"),
                rs.getBoolean("has_security"), rs.getBoolean("has_water_access"), rs.getBoolean("is_open_24h"));
    }

    /** Reads is_exact_size / size_description / area_sqm into a Dimensions (null when no size was given). */
    static Dimensions readDimensions(ResultSet rs) throws SQLException {
        boolean exact = rs.getBoolean("is_exact_size");
        if (rs.wasNull()) {
            return null;
        }
        return new Dimensions(exact, rs.getString("size_description"), rs.getBigDecimal("area_sqm"));
    }

    /** Units + common areas of a property (with their spots), for the from-database constructor. */
    private List<GridZone> loadZones(int propertyId) {
        // spots of every zone in this property: zone id -> its positions
        Map<Integer, Set<GridPosition>> spots = new HashMap<>();
        jdbcTemplate.query("SELECT zone_id, row_idx, col_idx FROM zone_cells WHERE property_id = ?",
                (rs, rowNum) -> Map.entry(rs.getInt("zone_id"), new GridPosition(rs.getInt("row_idx"), rs.getInt("col_idx"))),
                propertyId)
                .forEach(e -> spots.computeIfAbsent(e.getKey(), k -> new HashSet<>()).add(e.getValue()));

        return jdbcTemplate.query(ZONES_SQL, (rs, rowNum) -> {
            int zoneId = rs.getInt("id");
            LocalDateTime createdAt = rs.getTimestamp("created_at").toLocalDateTime();
            String name = rs.getString("name");
            Set<GridPosition> positions = spots.getOrDefault(zoneId, Set.of());
            if ("UNIT".equals(rs.getString("zone_kind"))) {
                return new RentableUnit(zoneId, createdAt, propertyId, name, positions,
                        rs.getBigDecimal("rental_rate"), readDimensions(rs),
                        rs.getBoolean("includes_electricity"), rs.getBoolean("includes_water"),
                        UnitStatus.valueOf(rs.getString("status")));
            }
            return new CommonArea(zoneId, createdAt, propertyId, name, positions,
                    CommonAreaType.valueOf(rs.getString("area_type")), rs.getString("color"));
        }, propertyId);
    }

    private Map<GridEdge, EdgeType> loadEdgeOverrides(int propertyId) {
        Map<GridEdge, EdgeType> overrides = new HashMap<>();
        jdbcTemplate.query("SELECT row_idx, col_idx, orientation, edge_type FROM edge_overrides WHERE property_id = ?",
                (rs, rowNum) -> Map.entry(
                        new GridEdge(rs.getInt("row_idx"), rs.getInt("col_idx"), Orientation.valueOf(rs.getString("orientation"))),
                        EdgeType.valueOf(rs.getString("edge_type"))),
                propertyId)
                .forEach(e -> overrides.put(e.getKey(), e.getValue()));
        return overrides;
    }
}
