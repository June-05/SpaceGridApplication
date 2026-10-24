package com.techhub.spacegridapplication.dao.jdbc;

import com.techhub.spacegridapplication.dao.PaymentDao;
import com.techhub.spacegridapplication.model.Payment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/** PaymentDao with JdbcTemplate. Table(s): payments. */
@Repository
public class JdbcPaymentDao implements PaymentDao {

    private final JdbcTemplate jdbcTemplate;
    private final RowMapper<Payment> rowMapper;

    public JdbcPaymentDao(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        this.rowMapper = (rs, rowNum) -> {
            // TODO: read the columns from rs and call the "from database" constructor of Payment
            throw new UnsupportedOperationException("TODO");
        };
    }

    @Override
    public Optional<Payment> findById(int id) {
        // TODO: SQL with jdbcTemplate
        throw new UnsupportedOperationException("TODO");
    }

    /** INSERT, then entity.assignId(generated key) (use a KeyHolder). */
    @Override
    public Payment save(Payment entity) {
        // TODO: SQL with jdbcTemplate
        throw new UnsupportedOperationException("TODO");
    }

    @Override
    public void update(Payment entity) {
        // TODO: SQL with jdbcTemplate
    }

    @Override
    public void deleteById(int id) {
        // TODO: SQL with jdbcTemplate
    }

    @Override
    public List<Payment> findByLeaseId(int leaseId) {
        // TODO: SQL with jdbcTemplate
        throw new UnsupportedOperationException("TODO");
    }

    @Override
    public Set<YearMonth> findPaidMonths(int leaseId) {
        // TODO: SQL with jdbcTemplate
        throw new UnsupportedOperationException("TODO");
    }
}
