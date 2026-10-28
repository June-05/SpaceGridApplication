package com.techhub.spacegridapplication.dao.jdbc;

import com.techhub.spacegridapplication.dao.CommonAreaDao;
import com.techhub.spacegridapplication.model.CommonArea;
import com.techhub.spacegridapplication.model.GridPosition;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.PreparedStatement;
import java.sql.Statement;
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
            // TODO: read the columns from rs and call the "from database" constructor of CommonArea
            throw new UnsupportedOperationException("TODO");
        };
    }

    @Override
    public Optional<CommonArea> findById(int id) {
        // TODO: SQL with jdbcTemplate
        throw new UnsupportedOperationException("TODO");
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

    @Override
    public void deleteById(int id) {
        // TODO: SQL with jdbcTemplate
    }

    @Override
    public List<CommonArea> findByPropertyId(int propertyId) {
        // TODO: SQL with jdbcTemplate
        throw new UnsupportedOperationException("TODO");
    }

    /** Spots of one zone from zone_cells. */
    private Set<GridPosition> loadPositions(int zoneId) {
        // TODO: SQL with jdbcTemplate
        throw new UnsupportedOperationException("TODO");
    }
}
