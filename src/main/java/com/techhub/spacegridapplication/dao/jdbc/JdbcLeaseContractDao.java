package com.techhub.spacegridapplication.dao.jdbc;

import com.techhub.spacegridapplication.dao.LeaseContractDao;
import com.techhub.spacegridapplication.model.LeaseContract;
import com.techhub.spacegridapplication.model.LeaseStatus;
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
            java.sql.Date closedOn = rs.getDate("closed_on");
            return new LeaseContract(
                    rs.getInt("id"),
                    rs.getTimestamp("created_at").toLocalDateTime(),
                    rs.getInt("rentable_unit_id"),
                    rs.getInt("renter_id"),
                    rs.getDate("start_date").toLocalDate(),
                    rs.getDate("end_date").toLocalDate(),
                    rs.getBigDecimal("monthly_rent"),
                    rs.getObject("previous_lease_id", Integer.class),
                    LeaseStatus.valueOf(rs.getString("status")),
                    closedOn == null ? null : closedOn.toLocalDate(),
                    rs.getString("unit_name"),
                    rs.getString("property_name"),
                    rs.getString("renter_name"));
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

    /** The unit's ACTIVE lease (running or not started yet), if any. A unit has at most one. */
    @Override
    public Optional<LeaseContract> findActiveByUnitId(int unitId) {
        return jdbcTemplate.query("SELECT * FROM lease_details WHERE rentable_unit_id = ? AND status = 'ACTIVE'",
                rowMapper, unitId).stream().findFirst();
    }

    @Override
    public boolean existsByUnitId(int unitId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM lease_contracts WHERE rentable_unit_id = ?", Integer.class, unitId);
        return count != null && count > 0;
    }
}
