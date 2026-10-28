package com.techhub.spacegridapplication.dao.jdbc;

import com.techhub.spacegridapplication.dao.RentableUnitDao;
import com.techhub.spacegridapplication.model.Dimensions;
import com.techhub.spacegridapplication.model.GridPosition;
import com.techhub.spacegridapplication.model.RentableUnit;
import com.techhub.spacegridapplication.model.UnitStatus;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/** RentableUnitDao with JdbcTemplate. Table(s): grid_zones JOIN rentable_units. */
@Repository
public class JdbcRentableUnitDao implements RentableUnitDao {

    private final JdbcTemplate jdbcTemplate;
    private final RowMapper<RentableUnit> rowMapper;

    public JdbcRentableUnitDao(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        this.rowMapper = (rs, rowNum) -> {
            int id = rs.getInt("id");
            return new RentableUnit(
                    id,
                    rs.getTimestamp("created_at").toLocalDateTime(),
                    rs.getInt("property_id"),
                    rs.getString("name"),
                    loadPositions(id),
                    rs.getBigDecimal("rental_rate"),
                    JdbcPropertyDao.readDimensions(rs),
                    rs.getBoolean("includes_electricity"),
                    rs.getBoolean("includes_water"),
                    UnitStatus.valueOf(rs.getString("status")));
        };
    }

    private static final String SELECT_UNITS = """
            SELECT z.id, z.created_at, z.property_id, z.name,
                   u.rental_rate, u.is_exact_size, u.size_description, u.area_sqm,
                   u.includes_electricity, u.includes_water, u.status
            FROM grid_zones z
            JOIN rentable_units u ON u.zone_id = z.id
            """;

    @Override
    public Optional<RentableUnit> findById(int id) {
        return jdbcTemplate.query(SELECT_UNITS + " WHERE z.id = ?", rowMapper, id).stream().findFirst();
    }

    /** INSERT, then entity.assignId(generated key) (use a KeyHolder). */
    @Override
    public RentableUnit save(RentableUnit entity) {
        KeyHolder keys = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO grid_zones (property_id, zone_kind, name) VALUES (?, 'UNIT', ?)",
                    Statement.RETURN_GENERATED_KEYS);
            ps.setInt(1, entity.getPropertyId());
            ps.setString(2, entity.getName());
            return ps;
        }, keys);
        int zoneId = keys.getKey().intValue();

        Dimensions size = entity.getDimensions();
        jdbcTemplate.update("INSERT INTO rentable_units (zone_id, rental_rate, is_exact_size, size_description, area_sqm, "
                        + "includes_electricity, includes_water, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                zoneId,
                entity.getRentalRate(),
                size == null ? null : size.exact(),
                size == null ? null : size.description(),
                size == null ? null : size.areaSqm(),
                entity.isIncludesElectricity(),
                entity.isIncludesWater(),
                entity.getStatus().name());
        entity.assignId(zoneId);
        return entity;
    }

    @Override
    public void update(RentableUnit entity) {
        // TODO: SQL with jdbcTemplate
    }

    @Override
    public void deleteById(int id) {
        // TODO: SQL with jdbcTemplate
    }

    @Override
    public List<RentableUnit> findByPropertyId(int propertyId) {
        return jdbcTemplate.query(SELECT_UNITS + " WHERE z.property_id = ? ORDER BY z.id", rowMapper, propertyId);
    }

    /** Spots of one zone from zone_cells. */
    private Set<GridPosition> loadPositions(int zoneId) {
        return new HashSet<>(jdbcTemplate.query("SELECT row_idx, col_idx FROM zone_cells WHERE zone_id = ?",
                (rs, rowNum) -> new GridPosition(rs.getInt("row_idx"), rs.getInt("col_idx")), zoneId));
    }
}
