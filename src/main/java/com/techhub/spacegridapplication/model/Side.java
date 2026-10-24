package com.techhub.spacegridapplication.model;

/** A side of one grid spot. Used with GridEdge.of(position, side). */
public enum Side {
    TOP, RIGHT, BOTTOM, LEFT;

    /** The side across from this one (TOP <-> BOTTOM, LEFT <-> RIGHT). */
    public Side opposite() {
        return switch (this) {
            case TOP -> BOTTOM;
            case BOTTOM -> TOP;
            case LEFT -> RIGHT;
            case RIGHT -> LEFT;
        };
    }
}
