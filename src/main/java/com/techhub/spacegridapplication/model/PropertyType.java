package com.techhub.spacegridapplication.model;

/** Type of property. Stored in properties.property_type. */
public enum PropertyType {
    APARTMENT("Apartment"),
    CONDOMINIUM("Condominium"),
    TOWNHOUSE("Townhouse"),
    COMMERCIAL("Commercial"),
    NIGHT_MARKET("Night Market"),
    OPEN_SPACE("Open Space");

    private final String label;

    PropertyType(String label) {
        this.label = label;
    }

    public String getLabel() { return label; }
}
