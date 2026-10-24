package com.techhub.spacegridapplication.dao.jdbc;

import com.techhub.spacegridapplication.dao.UserDao;
import com.techhub.spacegridapplication.model.Role;
import com.techhub.spacegridapplication.model.User;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/** UserDao with JdbcTemplate. Table(s): users. */
@Repository
public class JdbcUserDao implements UserDao {

    private final JdbcTemplate jdbcTemplate;
    private final RowMapper<User> rowMapper;

    public JdbcUserDao(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        this.rowMapper = (rs, rowNum) -> {
            return new User(
                    rs.getInt("id"),
                    rs.getTimestamp("created_at").toLocalDateTime(),
                    rs.getString("username"),
                    rs.getString("password_hash"),
                    rs.getString("full_name"),
                    Role.valueOf(rs.getString("role")));
        };
    }

    @Override
    public Optional<User> findById(int id) {
        return jdbcTemplate.query("SELECT * FROM users WHERE id = ?", rowMapper, id).stream().findFirst();
    }

    /** INSERT, then entity.assignId(generated key) (use a KeyHolder). */
    @Override
    public User save(User entity) {
        // TODO: SQL with jdbcTemplate
        throw new UnsupportedOperationException("TODO");
    }

    @Override
    public void update(User entity) {
        // TODO: SQL with jdbcTemplate
    }

    @Override
    public void deleteById(int id) {
        // TODO: SQL with jdbcTemplate
    }

    @Override
    public Optional<User> findByUsername(String username) {
        return jdbcTemplate.query("SELECT * FROM users WHERE username = ?", rowMapper, username).stream().findFirst();
    }

    @Override
    public boolean existsByUsername(String username) {
        // TODO: SQL with jdbcTemplate
        throw new UnsupportedOperationException("TODO");
    }
}
