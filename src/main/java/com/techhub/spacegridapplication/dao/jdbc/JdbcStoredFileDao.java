package com.techhub.spacegridapplication.dao.jdbc;

import com.techhub.spacegridapplication.dao.StoredFileDao;
import com.techhub.spacegridapplication.model.FileKind;
import com.techhub.spacegridapplication.model.StoredFile;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.List;
import java.util.Optional;

/** StoredFileDao with JdbcTemplate. Table(s): uploaded_files (the file bytes are on disk, see FileService). */
@Repository
public class JdbcStoredFileDao implements StoredFileDao {

    private final JdbcTemplate jdbcTemplate;
    private final RowMapper<StoredFile> rowMapper;

    public JdbcStoredFileDao(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        this.rowMapper = (rs, rowNum) -> new StoredFile(
                rs.getInt("id"),
                rs.getTimestamp("created_at").toLocalDateTime(),
                FileKind.valueOf(rs.getString("file_kind")),
                rs.getObject("property_id", Integer.class),
                rs.getObject("unit_id", Integer.class),
                rs.getObject("lease_id", Integer.class),
                rs.getString("file_name"),
                rs.getString("stored_name"),
                rs.getString("content_type"));
    }

    @Override
    public Optional<StoredFile> findById(int id) {
        return jdbcTemplate.query("SELECT * FROM uploaded_files WHERE id = ?", rowMapper, id).stream().findFirst();
    }

    /** INSERT, then entity.assignId(generated key). */
    @Override
    public StoredFile save(StoredFile entity) {
        KeyHolder keys = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement("""
                    INSERT INTO uploaded_files (file_kind, property_id, unit_id, lease_id, file_name, stored_name, content_type)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, entity.getKind().name());
            ps.setObject(2, entity.getPropertyId());
            ps.setObject(3, entity.getUnitId());
            ps.setObject(4, entity.getLeaseId());
            ps.setString(5, entity.getFileName());
            ps.setString(6, entity.getStoredName());
            ps.setString(7, entity.getContentType());
            return ps;
        }, keys);
        entity.assignId(keys.getKey().intValue());
        return entity;
    }

    /** Files are never changed: upload a new one and delete the old one instead. */
    @Override
    public void update(StoredFile entity) {
        throw new UnsupportedOperationException("Uploaded files can't be changed; upload a new one instead.");
    }

    @Override
    public void deleteById(int id) {
        jdbcTemplate.update("DELETE FROM uploaded_files WHERE id = ?", id);
    }

    @Override
    public List<StoredFile> findByOwner(FileKind kind, int ownerId) {
        String ownerColumn = switch (kind) {
            case PROPERTY_PHOTO, SITE_PLAN -> "property_id";
            case UNIT_PHOTO -> "unit_id";
            case CONTRACT -> "lease_id";
        };
        return jdbcTemplate.query("SELECT * FROM uploaded_files WHERE file_kind = ? AND " + ownerColumn + " = ? ORDER BY id",
                rowMapper, kind.name(), ownerId);
    }
}
