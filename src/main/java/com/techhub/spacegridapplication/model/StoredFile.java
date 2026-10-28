package com.techhub.spacegridapplication.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.techhub.spacegridapplication.exception.ValidationException;

import java.time.LocalDateTime;

/**
 * An uploaded file: a property photo, a site plan, a unit photo or a lease contract.
 * The bytes are in the uploads folder under storedName; this object says what it belongs to.
 * Exactly one of propertyId / unitId / leaseId is set, matching the kind.
 */
public class StoredFile extends BaseEntity {

    private final FileKind kind;
    private final Integer propertyId;
    private final Integer unitId;
    private final Integer leaseId;
    private final String fileName;          // the uploader's file name, shown on screen
    private final String storedName;        // random name in the uploads folder (never sent to the browser)
    private final String contentType;

    /** New file (not saved yet). ownerId is the property, unit or lease id, depending on the kind. */
    public StoredFile(FileKind kind, int ownerId, String fileName, String storedName, String contentType) {
        if (kind == null) {
            throw new ValidationException("File kind is required.");
        }
        this.kind = kind;
        this.propertyId = (kind == FileKind.PROPERTY_PHOTO || kind == FileKind.SITE_PLAN) ? ownerId : null;
        this.unitId = (kind == FileKind.UNIT_PHOTO) ? ownerId : null;
        this.leaseId = (kind == FileKind.CONTRACT) ? ownerId : null;
        this.fileName = (fileName == null || fileName.isBlank()) ? "file" : fileName.trim();
        this.storedName = storedName;
        this.contentType = contentType;
    }

    /** From database. */
    public StoredFile(int id, LocalDateTime createdAt, FileKind kind, Integer propertyId, Integer unitId,
                      Integer leaseId, String fileName, String storedName, String contentType) {
        super(id, createdAt);
        this.kind = kind;
        this.propertyId = propertyId;
        this.unitId = unitId;
        this.leaseId = leaseId;
        this.fileName = fileName;
        this.storedName = storedName;
        this.contentType = contentType;
    }

    public FileKind getKind() { return kind; }
    public Integer getPropertyId() { return propertyId; }
    public Integer getUnitId() { return unitId; }
    public Integer getLeaseId() { return leaseId; }
    public String getFileName() { return fileName; }
    public String getContentType() { return contentType; }

    @JsonIgnore
    public String getStoredName() { return storedName; }

    /** Where the page can show or download it: GET /api/files/{id}. */
    public String getUrl() {
        return urlOf(getId());
    }

    @JsonIgnore
    public boolean isImage() {
        return contentType != null && contentType.startsWith("image/");
    }

    /** "/api/files/7", or null when there is no file. */
    public static String urlOf(Integer fileId) {
        return (fileId == null) ? null : "/api/files/" + fileId;
    }
}
