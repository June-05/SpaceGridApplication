package com.techhub.spacegridapplication.model;

/** Status of one payment attempt. */
public enum PaymentStatus {
    PENDING("Pending"),
    PAID("Paid"),
    FAILED("Failed");

    private final String label;

    PaymentStatus(String label) {
        this.label = label;
    }

    public String getLabel() { return label; }
}
