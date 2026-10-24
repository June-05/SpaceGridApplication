package com.techhub.spacegridapplication.model;

/** Lease status SAVED in the database (lease_contracts.status). */
public enum LeaseStatus {
    ACTIVE("Active"),
    ENDED("Ended"),
    TERMINATED("Terminated"),
    RENEWED("Renewed");

    private final String label;

    LeaseStatus(String label) {
        this.label = label;
    }

    public String getLabel() { return label; }
}
