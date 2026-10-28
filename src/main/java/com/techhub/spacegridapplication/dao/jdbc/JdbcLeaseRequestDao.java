package com.techhub.spacegridapplication.dao.jdbc;

import com.techhub.spacegridapplication.dao.LeaseRequestDao;
import com.techhub.spacegridapplication.model.LeaseRequest;
import com.techhub.spacegridapplication.model.RequestStatus;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;

/** LeaseRequestDao with JdbcTemplate. Table(s): lease_requests (reads go through the lease_request_details view). */
@Repository
public class JdbcLeaseRequestDao implements LeaseRequestDao {

    private static final String SELECT_REQUESTS = "SELECT * FROM lease_request_details";

    private final JdbcTemplate jdbcTemplate;
    private final RowMapper<LeaseRequest> rowMapper;

    public JdbcLeaseRequestDao(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        this.rowMapper = (rs, rowNum) -> {
            Timestamp decidedAt = rs.getTimestamp("decided_at");
            return new LeaseRequest(
                    rs.getInt("id"),
                    rs.getTimestamp("created_at").toLocalDateTime(),
                    rs.getInt("rentable_unit_id"),
                    rs.getInt("renter_id"),
                    rs.getDate("desired_start").toLocalDate(),
                    rs.getInt("months"),
                    rs.getString("message"),
                    RequestStatus.valueOf(rs.getString("status")),
                    decidedAt == null ? null : decidedAt.toLocalDateTime(),
                    rs.getInt("property_id"),
                    rs.getInt("landlord_id"),
                    rs.getString("unit_name"),
                    rs.getString("property_name"),
                    rs.getString("renter_name"),
                    rs.getBigDecimal("rental_rate"));
        };
    }

    @Override
    public Optional<LeaseRequest> findById(int id) {
        return jdbcTemplate.query(SELECT_REQUESTS + " WHERE id = ?", rowMapper, id).stream().findFirst();
    }

    /** INSERT, then entity.assignId(generated key). The display fields stay empty: reload with findById if you need them. */
    @Override
    public LeaseRequest save(LeaseRequest entity) {
        KeyHolder keys = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO lease_requests (rentable_unit_id, renter_id, desired_start, months, message, status) "
                            + "VALUES (?, ?, ?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS);
            ps.setInt(1, entity.getUnitId());
            ps.setInt(2, entity.getRenterId());
            ps.setObject(3, entity.getDesiredStart());
            ps.setInt(4, entity.getMonths());
            ps.setString(5, entity.getMessage());
            ps.setString(6, entity.getStatus().name());
            return ps;
        }, keys);
        entity.assignId(keys.getKey().intValue());
        return entity;
    }

    /** Only the status and decided_at can change. */
    @Override
    public void update(LeaseRequest entity) {
        jdbcTemplate.update("UPDATE lease_requests SET status = ?, decided_at = ? WHERE id = ?",
                entity.getStatus().name(), entity.getDecidedAt(), entity.getId());
    }

    @Override
    public void deleteById(int id) {
        jdbcTemplate.update("DELETE FROM lease_requests WHERE id = ?", id);
    }

    @Override
    public List<LeaseRequest> findByRenterId(int renterId) {
        return jdbcTemplate.query(SELECT_REQUESTS + " WHERE renter_id = ? ORDER BY created_at DESC, id DESC",
                rowMapper, renterId);
    }

    @Override
    public List<LeaseRequest> findByLandlordId(int landlordId) {
        return jdbcTemplate.query(SELECT_REQUESTS + " WHERE landlord_id = ? ORDER BY created_at DESC, id DESC",
                rowMapper, landlordId);
    }

    @Override
    public boolean existsPendingByUnitAndRenter(int unitId, int renterId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM lease_requests WHERE rentable_unit_id = ? AND renter_id = ? AND status = 'PENDING'",
                Integer.class, unitId, renterId);
        return count != null && count > 0;
    }
}
