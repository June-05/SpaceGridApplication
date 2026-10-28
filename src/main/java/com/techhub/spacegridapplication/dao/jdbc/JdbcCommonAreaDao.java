package com.techhub.spacegridapplication.dao.jdbc;

import com.techhub.spacegridapplication.dao.CommonAreaDao;
import com.techhub.spacegridapplication.model.CommonArea;
import com.techhub.spacegridapplication.model.CommonAreaType;
import com.techhub.spacegridapplication.model.GridPosition;

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

/** CommonAreaDao with JdbcTemplate. Table(s): grid_zones JOIN common_areas. */
@Repository
public class JdbcCommonAreaDao implements CommonAreaDao {

    private final JdbcTemplate jdbcTemplate;
    private final RowMapper<CommonArea> rowMapper;

    public JdbcCommonAreaDao(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        this.rowMapper = (rs, rowNum) -> {
            int id = rs.getInt("id");
            return new CommonArea(
                    id,
                    rs.getTimestamp("created_at").toLocalDateTime(),
                    rs.getInt("property_id"),
                    rs.getString("name"),
                    loadPositions(id),
                    CommonAreaType.valueOf(rs.getString("area_type")),
                    rs.getString("color"));
        };
    }

    private static final String SELECT_AREAS = """
            SELECT z.id, z.created_at, z.property_id, z.name, c.area_type, c.color
            FROM grid_zones z
            JOIN common_areas c ON c.zone_id = z.id
            """;

    @Override
    public Optional<CommonArea> findById(int id) {
        return jdbcTemplate.query(SELECT_AREAS + " WHERE z.id = ?", rowMapper, id).stream().findFirst();
    }

    /** INSERT, then entity.assignId(generated key) (use a KeyHolder). */
    @Override
    public CommonArea save(CommonArea entity) {
        KeyHolder keys = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO grid_zones (property_id, zone_kind, name) VALUES (?, 'COMMON', ?)",
                    Statement.RETURN_GENERATED_KEYS);
            ps.setInt(1, entity.getPropertyId());
            ps.setString(2, entity.getName());
            return ps;
        }, keys);
        int zoneId = keys.getKey().intValue();

        jdbcTemplate.update("INSERT INTO common_areas (zone_id, area_type, color) VALUES (?, ?, ?)",
                zoneId, entity.getAreaType().name(), entity.getCustomColor());
        entity.assignId(zoneId);
        return entity;
    }

    @Override
    public void updateColor(int zoneId, String color) {
        jdbcTemplate.update("UPDATE common_areas SET color = ? WHERE zone_id = ?", color, zoneId);
    }

    @Override
    public void update(CommonArea entity) {
        // TODO: SQL with jdbcTemplate
    }

    /** Deletes the grid_zones row; the common_areas row and the spots go with it (ON DELETE CASCADE). */
    @Override
    public void deleteById(int id) {
        jdbcTemplate.update("DELETE FROM grid_zones WHERE id = ? AND zone_kind = 'COMMON'", id);
    }

    @Override
    public List<CommonArea> findByPropertyId(int propertyId) {
        return jdbcTemplate.query(SELECT_AREAS + " WHERE z.property_id = ? ORDER BY z.id", rowMapper, propertyId);
    }

    /** Spots of one zone from zone_cells. */
    private Set<GridPosition> loadPositions(int zoneId) {
        return new HashSet<>(jdbcTemplate.query("SELECT row_idx, col_idx FROM zone_cells WHERE zone_id = ?",
                (rs, rowNum) -> new GridPosition(rs.getInt("row_idx"), rs.getInt("col_idx")), zoneId));
    }
}
