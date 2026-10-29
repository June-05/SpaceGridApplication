package com.techhub.spacegridapplication.model;

/** Lease state SHOWN on screen. Calculated by LeaseContract.getCurrentState(today), never saved. */
public enum LeaseState {
    UPCOMING("Upcoming", "state-upcoming"),
    ACTIVE("Active", "state-active"),
    EXPIRING_SOON("Expiring soon", "state-expiring-soon"),
    EXPIRED("Ending today", "state-expired"),         // past the end date, closed by LeaseExpiryJob shortly
    ENDED("Ended", "state-ended"),
    TERMINATED("Terminated", "state-terminated"),
    RENEWED("Renewed", "state-renewed");

    private final String label;
    private final String cssClass;

    LeaseState(String label, String cssClass) {
        this.label = label;
        this.cssClass = cssClass;
    }

    public String getLabel() { return label; }
    public String getCssClass() { return cssClass; }
}
