package com.techhub.spacegridapplication.model;

/** Status of one month on a renter's rent statement. */
public enum DueStatus {
    UPCOMING("Upcoming", "due-upcoming"),
    DUE("Due", "due-due"),
    OVERDUE("Overdue", "due-overdue"),
    PAID("Paid", "due-paid");

    private final String label;
    private final String cssClass;

    DueStatus(String label, String cssClass) {
        this.label = label;
        this.cssClass = cssClass;
    }

    public String getLabel() { return label; }
    public String getCssClass() { return cssClass; }
}
