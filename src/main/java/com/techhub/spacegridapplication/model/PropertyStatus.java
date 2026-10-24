package com.techhub.spacegridapplication.model;

/** Status of a property. A new property starts as DRAFT. */
public enum PropertyStatus {
    DRAFT("Draft"),
    ACTIVE("Active"),
    ARCHIVED("Archived");

    private final String label;

    PropertyStatus(String label) {
        this.label = label;
    }

    public String getLabel() { return label; }
}
