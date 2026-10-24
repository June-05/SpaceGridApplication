package com.techhub.spacegridapplication.dao.jdbc;

import com.techhub.spacegridapplication.dao.LeaseContractDao;
import com.techhub.spacegridapplication.model.LeaseContract;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

/** LeaseContractDao with JdbcTemplate. Table(s): lease_details (view) for reading, lease_contracts for writing. */
@Repository
public class JdbcLeaseContractDao implements LeaseContractDao {

    private final JdbcTemplate jdbcTemplate;
    private final RowMapper<LeaseContract> rowMapper;

    public JdbcLeaseContractDao(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        this.rowMapper = (rs, rowNum) -> {
            // TODO: read the columns from rs and call the "from database" constructor of LeaseContract
            throw new UnsupportedOperationException("TODO");
        };
    }

    @Override
    public Optional<LeaseContract> findById(int id) {
        // TODO: SQL with jdbcTemplate
        throw new UnsupportedOperationException("TODO");
    }

    /** INSERT, then entity.assignId(generated key) (use a KeyHolder). */
    @Override
    public LeaseContract save(LeaseContract entity) {
        // TODO: SQL with jdbcTemplate
        throw new UnsupportedOperationException("TODO");
    }

    @Override
    public void update(LeaseContract entity) {
        // TODO: SQL with jdbcTemplate
    }

    @Override
    public void deleteById(int id) {
        // TODO: SQL with jdbcTemplate
    }

    @Override
    public List<LeaseContract> findByRenterId(int renterId) {
        // TODO: SQL with jdbcTemplate
        throw new UnsupportedOperationException("TODO");
    }

    @Override
    public List<LeaseContract> findByLandlordId(int landlordId) {
        // TODO: SQL with jdbcTemplate
        throw new UnsupportedOperationException("TODO");
    }

    @Override
    public List<LeaseContract> findByPropertyId(int propertyId) {
        // TODO: SQL with jdbcTemplate
        throw new UnsupportedOperationException("TODO");
    }

    @Override
    public Optional<LeaseContract> findActiveByUnitId(int unitId) {
        // TODO: SQL with jdbcTemplate
        throw new UnsupportedOperationException("TODO");
    }

    @Override
    public boolean existsByUnitId(int unitId) {
        // TODO: SQL with jdbcTemplate
        throw new UnsupportedOperationException("TODO");
    }
}
