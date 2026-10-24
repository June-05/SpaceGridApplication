package com.techhub.spacegridapplication.model;

/** Feature on a line between two spots. OPEN removes an automatic wall. */
public enum EdgeType {
    WALL("Wall", "edge-wall"),
    DOOR("Door", "edge-door"),
    WINDOW("Window", "edge-window"),
    OPEN("Open", "edge-open");

    private final String label;
    private final String cssClass;

    EdgeType(String label, String cssClass) {
        this.label = label;
        this.cssClass = cssClass;
    }

    public String getLabel() { return label; }
    public String getCssClass() { return cssClass; }
}
