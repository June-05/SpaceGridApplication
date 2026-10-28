package com.techhub.spacegridapplication.model;

/** Status of a lease request. Only PENDING requests can change: the other three are final. */
public enum RequestStatus {
    PENDING("Pending", "request-pending"),
    APPROVED("Approved", "request-approved"),
    DECLINED("Declined", "request-declined"),
    CANCELLED("Cancelled", "request-cancelled");

    private final String label;
    private final String cssClass;

    RequestStatus(String label, String cssClass) {
        this.label = label;
        this.cssClass = cssClass;
    }

    public String getLabel() { return label; }
    public String getCssClass() { return cssClass; }
}
