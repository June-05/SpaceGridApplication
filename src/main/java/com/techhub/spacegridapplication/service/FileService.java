package com.techhub.spacegridapplication.service;

import com.techhub.spacegridapplication.dao.LeaseContractDao;
import com.techhub.spacegridapplication.dao.PropertyDao;
import com.techhub.spacegridapplication.dao.RentableUnitDao;
import com.techhub.spacegridapplication.dao.StoredFileDao;
import com.techhub.spacegridapplication.exception.AccessDeniedException;
import com.techhub.spacegridapplication.exception.ConflictException;
import com.techhub.spacegridapplication.exception.NotFoundException;
import com.techhub.spacegridapplication.exception.ValidationException;
import com.techhub.spacegridapplication.model.FileKind;
import com.techhub.spacegridapplication.model.LeaseContract;
import com.techhub.spacegridapplication.model.Property;
import com.techhub.spacegridapplication.model.PropertyStatus;
import com.techhub.spacegridapplication.model.RentableUnit;
import com.techhub.spacegridapplication.model.StoredFile;
import com.techhub.spacegridapplication.model.User;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Uploaded files: property photos, site plans, unit photos and lease contracts.
 * The bytes are saved in the uploads folder (application.properties: spacegrid.upload-dir) under a random name;
 * the uploaded_files table says what each file belongs to.
 *
 * Who may see a file:
 *   the landlord who owns it: always
 *   PROPERTY_PHOTO / UNIT_PHOTO: anyone, once the property is ACTIVE (the homepage shows them)
 *   CONTRACT: also the renter of that lease
 *   SITE_PLAN: only the landlord
 * Only the owning landlord may upload or delete.
 */
@Service
public class FileService {

    public static final int MAX_FILES_PER_OWNER = 10;

    /** Allowed types and the extension they are saved with. */
    private static final Map<String, String> IMAGE_TYPES = Map.of(
            "image/jpeg", ".jpg", "image/png", ".png", "image/webp", ".webp");
    private static final String PDF_TYPE = "application/pdf";

    private final StoredFileDao fileDao;
    private final PropertyDao propertyDao;
    private final RentableUnitDao unitDao;
    private final LeaseContractDao leaseDao;
    private final Path uploadDir;

    public FileService(StoredFileDao fileDao, PropertyDao propertyDao, RentableUnitDao unitDao,
                       LeaseContractDao leaseDao, @Value("${spacegrid.upload-dir:uploads}") String uploadDir) {
        this.fileDao = fileDao;
        this.propertyDao = propertyDao;
        this.unitDao = unitDao;
        this.leaseDao = leaseDao;
        this.uploadDir = Path.of(uploadDir).toAbsolutePath().normalize();
    }

    /**
     * Saves the file for its owner (a property, unit or lease id, matching the kind). A lease has one contract:
     * a new upload replaces the old one. Other kinds allow up to 10 files each.
     */
    @Transactional
    public StoredFile upload(User landlord, FileKind kind, int ownerId, MultipartFile file) {
        if (kind == null) {
            throw new ValidationException("File kind is required.");
        }
        checkCanChange(kind, ownerId, landlord);
        if (file == null || file.isEmpty()) {
            throw new ValidationException("Choose a file to upload.");
        }
        String contentType = (file.getContentType() == null) ? "" : file.getContentType().toLowerCase();
        String extension = extensionFor(kind, contentType);

        List<StoredFile> existing = fileDao.findByOwner(kind, ownerId);
        if (kind == FileKind.CONTRACT) {
            existing.forEach(this::remove);                       // one contract per lease
        } else if (existing.size() >= MAX_FILES_PER_OWNER) {
            throw new ConflictException("You can upload at most " + MAX_FILES_PER_OWNER + " files here. Delete one first.");
        }

        String storedName = UUID.randomUUID() + extension;
        Path target = uploadDir.resolve(storedName);
        try (InputStream in = file.getInputStream()) {
            Files.createDirectories(uploadDir);
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new UncheckedIOException("Couldn't save the uploaded file.", e);
        }
        try {
            return fileDao.save(new StoredFile(kind, ownerId, file.getOriginalFilename(), storedName, contentType));
        } catch (RuntimeException e) {
            deleteQuietly(target);                                // don't leave a file without a row
            throw e;
        }
    }

    /** The files of one kind for an owner, if the user may see them (user is null when nobody is logged in). */
    public List<StoredFile> list(FileKind kind, int ownerId, User user) {
        List<StoredFile> files = fileDao.findByOwner(kind, ownerId);
        if (!files.isEmpty() && !canView(files.get(0), user)) {
            throw new AccessDeniedException("You can't see these files.");
        }
        return files;
    }

    /** One file and where it is on disk, for GET /api/files/{id}. */
    public StoredFile get(int fileId, User user) {
        StoredFile file = fileDao.findById(fileId).orElseThrow(() -> new NotFoundException("File not found."));
        if (!canView(file, user)) {
            throw new AccessDeniedException("You can't see this file.");
        }
        return file;
    }

    public Path pathOf(StoredFile file) {
        return uploadDir.resolve(file.getStoredName());
    }

    @Transactional
    public void delete(int fileId, User landlord) {
        StoredFile file = fileDao.findById(fileId).orElseThrow(() -> new NotFoundException("File not found."));
        checkCanChange(file.getKind(), ownerIdOf(file), landlord);
        remove(file);
    }

    /** Before a unit is deleted: removes its photos from disk (the rows go with the unit, ON DELETE CASCADE). */
    public void deleteFilesFromDisk(FileKind kind, int ownerId) {
        fileDao.findByOwner(kind, ownerId).forEach(file -> deleteQuietly(pathOf(file)));
    }

    // ---------------------------------------------------------------- access rules
    /** Only the landlord who owns the property / unit / lease. */
    private void checkCanChange(FileKind kind, int ownerId, User landlord) {
        if (landlord == null || !landlord.isLandlord() || propertyOf(kind, ownerId).getLandlordId() != landlord.getId()) {
            throw new AccessDeniedException("Only the property's landlord can change its files.");
        }
    }

    private boolean canView(StoredFile file, User user) {
        Property property = propertyOf(file.getKind(), ownerIdOf(file));
        if (user != null && property.isOwnedBy(user.getId())) {
            return true;
        }
        return switch (file.getKind()) {
            case PROPERTY_PHOTO, UNIT_PHOTO -> property.getStatus() == PropertyStatus.ACTIVE;
            case CONTRACT -> user != null && findLease(file.getLeaseId()).isRentedBy(user.getId());
            case SITE_PLAN -> false;
        };
    }

    /** The property a file's owner belongs to (NotFoundException if the owner is gone). */
    private Property propertyOf(FileKind kind, int ownerId) {
        int propertyId = switch (kind) {
            case PROPERTY_PHOTO, SITE_PLAN -> ownerId;
            case UNIT_PHOTO -> unitDao.findById(ownerId).map(RentableUnit::getPropertyId)
                    .orElseThrow(() -> new NotFoundException("Unit not found."));
            case CONTRACT -> findLease(ownerId).getPropertyId();
        };
        return propertyDao.findById(propertyId).orElseThrow(() -> new NotFoundException("Property not found."));
    }

    private LeaseContract findLease(int leaseId) {
        return leaseDao.findById(leaseId).orElseThrow(() -> new NotFoundException("Lease not found."));
    }

    private static int ownerIdOf(StoredFile file) {
        return switch (file.getKind()) {
            case PROPERTY_PHOTO, SITE_PLAN -> file.getPropertyId();
            case UNIT_PHOTO -> file.getUnitId();
            case CONTRACT -> file.getLeaseId();
        };
    }

    // ---------------------------------------------------------------- helpers
    /** Photos: JPG / PNG / WebP. Site plans: those or PDF. Contracts: PDF only. */
    private static String extensionFor(FileKind kind, String contentType) {
        if (kind == FileKind.CONTRACT) {
            if (!PDF_TYPE.equals(contentType)) {
                throw new ValidationException("The contract must be a PDF file.");
            }
            return ".pdf";
        }
        if (IMAGE_TYPES.containsKey(contentType)) {
            return IMAGE_TYPES.get(contentType);
        }
        if (!kind.isImageOnly() && PDF_TYPE.equals(contentType)) {
            return ".pdf";
        }
        throw new ValidationException(kind.isImageOnly()
                ? "Photos must be JPG, PNG or WebP images."
                : "Site plans must be JPG, PNG or WebP images, or PDF files.");
    }

    private void remove(StoredFile file) {
        fileDao.deleteById(file.getId());
        deleteQuietly(pathOf(file));
    }

    private static void deleteQuietly(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
            // the row is gone already; a leftover file on disk does no harm
        }
    }
}
