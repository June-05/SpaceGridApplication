package com.techhub.spacegridapplication.dao.jdbc;

import com.techhub.spacegridapplication.dao.LeaseContractDao;
import com.techhub.spacegridapplication.model.LeaseContract;
import com.techhub.spacegridapplication.model.LeaseStatus;
import com.techhub.spacegridapplication.model.PaymentTerms;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.Statement;
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
                    PaymentTerms.valueOf(rs.getString("payment_terms")),
                    rs.getString("tenant_name"),
                    rs.getString("tenant_email"),
                    rs.getString("tenant_phone"),
                    rs.getObject("previous_lease_id", Integer.class),
                    LeaseStatus.valueOf(rs.getString("status")),
                    closedOn == null ? null : closedOn.toLocalDate(),
                    rs.getString("unit_name"),
                    rs.getString("property_name"),
                    rs.getObject("property_id", Integer.class),
                    rs.getString("renter_name"),
                    rs.getString("renter_username"),
                    rs.getObject("unit_photo_id", Integer.class));
        };
    }

    @Override
    public Optional<LeaseContract> findById(int id) {
        return jdbcTemplate.query("SELECT * FROM lease_details WHERE id = ?", rowMapper, id).stream().findFirst();
    }

    /** INSERT, then entity.assignId(generated key). A new lease is ACTIVE, so closed_on stays NULL. */
    @Override
    public LeaseContract save(LeaseContract entity) {
        KeyHolder keys = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement("""
                    INSERT INTO lease_contracts (rentable_unit_id, renter_id, previous_lease_id, start_date, end_date,
                                                 monthly_rent, payment_terms, tenant_name, tenant_email, tenant_phone, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, Statement.RETURN_GENERATED_KEYS);
            ps.setInt(1, entity.getUnitId());
            ps.setInt(2, entity.getRenterId());
            ps.setObject(3, entity.getPreviousLeaseId());
            ps.setDate(4, Date.valueOf(entity.getStartDate()));
            ps.setDate(5, Date.valueOf(entity.getEndDate()));
            ps.setBigDecimal(6, entity.getMonthlyRent());
            ps.setString(7, entity.getPaymentTerms().name());
            ps.setString(8, entity.getTenantName());
            ps.setString(9, entity.getTenantEmail());
            ps.setString(10, entity.getTenantPhone());
            ps.setString(11, entity.getStatus().name());
            return ps;
        }, keys);
        entity.assignId(keys.getKey().intValue());
        return entity;
    }

    /** Only the status and closed_on change after a lease is created (its terms are final). */
    @Override
    public void update(LeaseContract entity) {
        jdbcTemplate.update("UPDATE lease_contracts SET status = ?, closed_on = ? WHERE id = ?",
                entity.getStatus().name(),
                entity.getClosedOn() == null ? null : Date.valueOf(entity.getClosedOn()),
                entity.getId());
    }

    /** Leases are history and normally never deleted; payments block it (ON DELETE RESTRICT). */
    @Override
    public void deleteById(int id) {
        jdbcTemplate.update("DELETE FROM lease_contracts WHERE id = ?", id);
    }

    /** Newest first. */
    @Override
    public List<LeaseContract> findByRenterId(int renterId) {
        return jdbcTemplate.query("SELECT * FROM lease_details WHERE renter_id = ? ORDER BY start_date DESC, id DESC",
                rowMapper, renterId);
    }

    @Override
    public List<LeaseContract> findByLandlordId(int landlordId) {
        return jdbcTemplate.query("SELECT * FROM lease_details WHERE landlord_id = ? ORDER BY start_date DESC, id DESC",
                rowMapper, landlordId);
    }

    @Override
    public List<LeaseContract> findByPropertyId(int propertyId) {
        return jdbcTemplate.query("SELECT * FROM lease_details WHERE property_id = ? ORDER BY start_date DESC, id DESC",
                rowMapper, propertyId);
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
