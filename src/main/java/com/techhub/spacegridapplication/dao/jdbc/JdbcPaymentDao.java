package com.techhub.spacegridapplication.dao.jdbc;

import com.techhub.spacegridapplication.dao.PaymentDao;
import com.techhub.spacegridapplication.model.Payment;
import com.techhub.spacegridapplication.model.PaymentMethod;
import com.techhub.spacegridapplication.model.PaymentStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.YearMonth;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/** PaymentDao with JdbcTemplate. Table(s): payments. billing_month is stored as the 1st of the month. */
@Repository
public class JdbcPaymentDao implements PaymentDao {

    private final JdbcTemplate jdbcTemplate;
    private final RowMapper<Payment> rowMapper;

    public JdbcPaymentDao(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        this.rowMapper = (rs, rowNum) -> {
            Timestamp paidAt = rs.getTimestamp("paid_at");
            return new Payment(
                    rs.getInt("id"),
                    rs.getTimestamp("created_at").toLocalDateTime(),
                    rs.getInt("lease_id"),
                    rs.getInt("renter_id"),
                    YearMonth.from(rs.getDate("billing_month").toLocalDate()),
                    rs.getBigDecimal("amount"),
                    PaymentMethod.valueOf(rs.getString("method")),
                    PaymentStatus.valueOf(rs.getString("status")),
                    rs.getString("reference_no"),
                    paidAt == null ? null : paidAt.toLocalDateTime());
        };
    }

    @Override
    public Optional<Payment> findById(int id) {
        return jdbcTemplate.query("SELECT * FROM payments WHERE id = ?", rowMapper, id).stream().findFirst();
    }

    /** INSERT, then entity.assignId(generated key). */
    @Override
    public Payment save(Payment entity) {
        KeyHolder keys = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement("""
                    INSERT INTO payments (lease_id, renter_id, billing_month, amount, method, status, reference_no, paid_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, Statement.RETURN_GENERATED_KEYS);
            ps.setInt(1, entity.getLeaseId());
            ps.setInt(2, entity.getRenterId());
            ps.setDate(3, Date.valueOf(entity.getBillingMonth().atDay(1)));
            ps.setBigDecimal(4, entity.getAmount());
            ps.setString(5, entity.getMethod().name());
            ps.setString(6, entity.getStatus().name());
            ps.setString(7, entity.getReferenceNo());
            ps.setTimestamp(8, entity.getPaidAt() == null ? null : Timestamp.valueOf(entity.getPaidAt()));
            return ps;
        }, keys);
        entity.assignId(keys.getKey().intValue());
        return entity;
    }

    /** Only the result of the attempt changes: status, reference number, time paid. */
    @Override
    public void update(Payment entity) {
        jdbcTemplate.update("UPDATE payments SET status = ?, reference_no = ?, paid_at = ? WHERE id = ?",
                entity.getStatus().name(),
                entity.getReferenceNo(),
                entity.getPaidAt() == null ? null : Timestamp.valueOf(entity.getPaidAt()),
                entity.getId());
    }

    @Override
    public void deleteById(int id) {
        jdbcTemplate.update("DELETE FROM payments WHERE id = ?", id);
    }

    /** Every attempt (PAID, FAILED, PENDING), newest first. */
    @Override
    public List<Payment> findByLeaseId(int leaseId) {
        return jdbcTemplate.query("SELECT * FROM payments WHERE lease_id = ? ORDER BY created_at DESC, id DESC",
                rowMapper, leaseId);
    }

    /** The billing months (period starts) that have a PAID payment. */
    @Override
    public Set<YearMonth> findPaidMonths(int leaseId) {
        return new HashSet<>(jdbcTemplate.query(
                "SELECT billing_month FROM payments WHERE lease_id = ? AND status = 'PAID'",
                (rs, rowNum) -> YearMonth.from(rs.getDate("billing_month").toLocalDate()), leaseId));
    }
}
