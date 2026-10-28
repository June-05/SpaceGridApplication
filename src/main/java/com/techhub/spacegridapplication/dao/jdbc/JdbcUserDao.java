package com.techhub.spacegridapplication.dao.jdbc;

import com.techhub.spacegridapplication.dao.UserDao;
import com.techhub.spacegridapplication.model.Role;
import com.techhub.spacegridapplication.model.User;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.List;
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

    /** INSERT, then entity.assignId(generated key). */
    @Override
    public User save(User entity) {
        KeyHolder keys = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, entity.getUsername());
            ps.setString(2, entity.getPasswordHash());
            ps.setString(3, entity.getFullName());
            ps.setString(4, entity.getRole().name());
            return ps;
        }, keys);
        entity.assignId(keys.getKey().intValue());
        return entity;
    }

    /** The username and role never change; the name and password can. */
    @Override
    public void update(User entity) {
        jdbcTemplate.update("UPDATE users SET password_hash = ?, full_name = ? WHERE id = ?",
                entity.getPasswordHash(), entity.getFullName(), entity.getId());
    }

    @Override
    public void deleteById(int id) {
        jdbcTemplate.update("DELETE FROM users WHERE id = ?", id);
    }

    @Override
    public Optional<User> findByUsername(String username) {
        return jdbcTemplate.query("SELECT * FROM users WHERE username = ?", rowMapper, username).stream().findFirst();
    }

    @Override
    public boolean existsByUsername(String username) {
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM users WHERE username = ?", Integer.class, username);
        return count != null && count > 0;
    }

    /** Lease form's "pick an existing account": renters whose username or name contains the text (at most 20). */
    @Override
    public List<User> findRenters(String search) {
        String like = "%" + (search == null ? "" : search.trim()) + "%";
        return jdbcTemplate.query("""
                SELECT * FROM users
                WHERE role = 'RENTER' AND (username LIKE ? OR full_name LIKE ?)
                ORDER BY full_name, username
                LIMIT 20
                """, rowMapper, like, like);
    }
}
