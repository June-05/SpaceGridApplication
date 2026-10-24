package com.techhub.spacegridapplication.model;

/**
 * Type of a non-rentable zone. cssClass + defaultColor let the page style each type;
 * indoor types get automatic walls (see GridZone.isEnclosed()).
 */
public enum CommonAreaType {
    WALKWAY("Walkway", "zone-walkway", "#d6d3d1", false),
    GRASS("Grass", "zone-grass", "#86efac", false),
    BATHROOM("Bathroom", "zone-bathroom", "#bae6fd", true),
    KITCHEN("Kitchen", "zone-kitchen", "#fde68a", true),
    LAUNDRY("Laundry", "zone-laundry", "#ddd6fe", true),
    LOBBY("Lobby", "zone-lobby", "#fbcfe8", true),
    PARKING("Parking", "zone-parking", "#9ca3af", false),
    STAIRS("Stairs", "zone-stairs", "#a8a29e", true);

    private final String label;
    private final String cssClass;
    private final String defaultColor;
    private final boolean indoor;

    CommonAreaType(String label, String cssClass, String defaultColor, boolean indoor) {
        this.label = label;
        this.cssClass = cssClass;
        this.defaultColor = defaultColor;
        this.indoor = indoor;
    }

    public String getLabel() { return label; }
    public String getCssClass() { return cssClass; }
    public String getDefaultColor() { return defaultColor; }
    public boolean isIndoor() { return indoor; }
}
