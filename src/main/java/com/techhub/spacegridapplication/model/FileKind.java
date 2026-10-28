package com.techhub.spacegridapplication.model;

/** What an uploaded file is (uploaded_files.file_kind), and so what it belongs to. */
public enum FileKind {
    PROPERTY_PHOTO("Property photo", true),    // belongs to a property: the overview photos
    SITE_PLAN("Site plan", false),             // belongs to a property: layout plans (image or PDF)
    UNIT_PHOTO("Unit photo", true),            // belongs to one unit
    CONTRACT("Contract", false);               // belongs to one lease: the signed contract PDF

    private final String label;
    private final boolean imageOnly;

    FileKind(String label, boolean imageOnly) {
        this.label = label;
        this.imageOnly = imageOnly;
    }

    public String getLabel() { return label; }

    /** Photos must be images; site plans may also be PDFs; contracts must be PDFs (checked by FileService). */
    public boolean isImageOnly() { return imageOnly; }
}
