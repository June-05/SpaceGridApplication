package com.techhub.spacegridapplication.controller;

import com.techhub.spacegridapplication.model.FileKind;
import com.techhub.spacegridapplication.model.Role;
import com.techhub.spacegridapplication.model.StoredFile;
import com.techhub.spacegridapplication.model.User;
import com.techhub.spacegridapplication.security.SessionManager;
import com.techhub.spacegridapplication.service.FileService;

import jakarta.servlet.http.HttpSession;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Photos, site plans and contracts (property form, units page, lease form, homepage).
 * Uploads are multipart forms with one "file" field: the page sends them with api.upload(url, formData).
 * The browser shows a file with GET /api/files/{id} (the "url" field of each StoredFile).
 */
@RestController
@RequestMapping("/api")
public class FileController {

    private final FileService fileService;
    private final SessionManager sessionManager;

    public FileController(FileService fileService, SessionManager sessionManager) {
        this.fileService = fileService;
        this.sessionManager = sessionManager;
    }

    /** Form fields: kind = PROPERTY_PHOTO or SITE_PLAN, file. */
    @PostMapping("/properties/{propertyId}/files")
    public StoredFile uploadForProperty(@PathVariable int propertyId, @RequestParam FileKind kind,
                                        @RequestParam MultipartFile file, HttpSession session) {
        User landlord = sessionManager.requireRole(session, Role.LANDLORD);
        FileKind propertyKind = (kind == FileKind.SITE_PLAN) ? FileKind.SITE_PLAN : FileKind.PROPERTY_PHOTO;
        return fileService.upload(landlord, propertyKind, propertyId, file);
    }

    /** ?kind=PROPERTY_PHOTO (default) or SITE_PLAN. Photos of an ACTIVE property are public. */
    @GetMapping("/properties/{propertyId}/files")
    public List<StoredFile> listForProperty(@PathVariable int propertyId,
                                            @RequestParam(defaultValue = "PROPERTY_PHOTO") FileKind kind,
                                            HttpSession session) {
        FileKind propertyKind = (kind == FileKind.SITE_PLAN) ? FileKind.SITE_PLAN : FileKind.PROPERTY_PHOTO;
        return fileService.list(propertyKind, propertyId, sessionManager.currentUserOrNull(session));
    }

    @PostMapping("/units/{unitId}/files")
    public StoredFile uploadForUnit(@PathVariable int unitId, @RequestParam MultipartFile file, HttpSession session) {
        User landlord = sessionManager.requireRole(session, Role.LANDLORD);
        return fileService.upload(landlord, FileKind.UNIT_PHOTO, unitId, file);
    }

    @GetMapping("/units/{unitId}/files")
    public List<StoredFile> listForUnit(@PathVariable int unitId, HttpSession session) {
        return fileService.list(FileKind.UNIT_PHOTO, unitId, sessionManager.currentUserOrNull(session));
    }

    /** The signed contract (PDF). Uploading again replaces it. */
    @PostMapping("/leases/{leaseId}/files")
    public StoredFile uploadContract(@PathVariable int leaseId, @RequestParam MultipartFile file, HttpSession session) {
        User landlord = sessionManager.requireRole(session, Role.LANDLORD);
        return fileService.upload(landlord, FileKind.CONTRACT, leaseId, file);
    }

    /** The landlord and the lease's renter only. */
    @GetMapping("/leases/{leaseId}/files")
    public List<StoredFile> listForLease(@PathVariable int leaseId, HttpSession session) {
        User user = sessionManager.currentUser(session);
        return fileService.list(FileKind.CONTRACT, leaseId, user);
    }

    /** The file itself, shown in the browser (images) or opened in its PDF viewer. */
    @GetMapping("/files/{id}")
    public ResponseEntity<Resource> show(@PathVariable int id, HttpSession session) {
        StoredFile file = fileService.get(id, sessionManager.currentUserOrNull(session));
        Resource body = new FileSystemResource(fileService.pathOf(file));
        if (!body.exists()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.getContentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                        .filename(file.getFileName(), StandardCharsets.UTF_8).build().toString())
                .body(body);
    }

    @DeleteMapping("/files/{id}")
    public void delete(@PathVariable int id, HttpSession session) {
        User landlord = sessionManager.requireRole(session, Role.LANDLORD);
        fileService.delete(id, landlord);
    }
}
