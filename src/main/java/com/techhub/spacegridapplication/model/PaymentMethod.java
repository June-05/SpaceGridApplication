package com.techhub.spacegridapplication.model;

/** Payment methods offered by the (simulated) payment gateway. */
public enum PaymentMethod {
    GCASH("GCash"),
    MAYA("Maya"),
    CARD("Card");

    private final String label;

    PaymentMethod(String label) {
        this.label = label;
    }

    public String getLabel() { return label; }
}
