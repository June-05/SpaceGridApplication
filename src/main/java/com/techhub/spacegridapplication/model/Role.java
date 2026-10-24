package com.techhub.spacegridapplication.model;

/** Account type. Stored in users.role. */
public enum Role {
    LANDLORD("Landlord"),
    RENTER("Renter");

    private final String label;

    Role(String label) {
        this.label = label;
    }

    public String getLabel() { return label; }
}
