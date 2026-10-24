package com.techhub.spacegridapplication.dao.jdbc;

import com.techhub.spacegridapplication.dao.RentableUnitDao;
import com.techhub.spacegridapplication.model.Dimensions;
import com.techhub.spacegridapplication.model.GridPosition;
import com.techhub.spacegridapplication.model.RentableUnit;

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

/** RentableUnitDao with JdbcTemplate. Table(s): grid_zones JOIN rentable_units. */
@Repository
public class JdbcRentableUnitDao implements RentableUnitDao {

    private final JdbcTemplate jdbcTemplate;
    private final RowMapper<RentableUnit> rowMapper;

    public JdbcRentableUnitDao(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        this.rowMapper = (rs, rowNum) -> {
            // TODO: read the columns from rs and call the "from database" constructor of RentableUnit
            throw new UnsupportedOperationException("TODO");
        };
    }

    @Override
    public Optional<RentableUnit> findById(int id) {
        // TODO: SQL with jdbcTemplate
        throw new UnsupportedOperationException("TODO");
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
        // TODO: SQL with jdbcTemplate
        throw new UnsupportedOperationException("TODO");
    }

    /** Spots of one zone from zone_cells. */
    private Set<GridPosition> loadPositions(int zoneId) {
        // TODO: SQL with jdbcTemplate
        throw new UnsupportedOperationException("TODO");
    }
}
