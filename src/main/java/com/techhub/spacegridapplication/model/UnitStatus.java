package com.techhub.spacegridapplication.model;

/** Status of a rentable unit. ARCHIVED units keep their lease history but leave the grid. */
public enum UnitStatus {
    AVAILABLE("Available", "status-available", "#16a34a"),
    OCCUPIED("Occupied", "status-occupied", "#dc2626"),
    UNDER_MAINTENANCE("Under maintenance", "status-under-maintenance", "#f59e0b"),
    ARCHIVED("Archived", "status-archived", "#9ca3af");

    private final String label;
    private final String cssClass;
    private final String defaultColor;

    UnitStatus(String label, String cssClass, String defaultColor) {
        this.label = label;
        this.cssClass = cssClass;
        this.defaultColor = defaultColor;
    }

    public String getLabel() { return label; }
    public String getCssClass() { return cssClass; }
    public String getDefaultColor() { return defaultColor; }
}
