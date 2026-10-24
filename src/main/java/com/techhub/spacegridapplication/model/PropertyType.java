package com.techhub.spacegridapplication.model;

/** Type of property. Stored in properties.property_type. */
public enum PropertyType {
    APARTMENT("Apartment"),
    CONDOMINIUM("Condominium"),
    TOWNHOUSE("Townhouse"),
    COMMERCIAL("Commercial");

    private final String label;

    PropertyType(String label) {
        this.label = label;
    }

    public String getLabel() { return label; }
}
