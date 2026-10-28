package com.techhub.spacegridapplication.model;

/**
 * Value object: what a property offers (the checkboxes on the property form).
 * Stored in properties.has_parking / has_power_backup / has_security / has_water_access / is_open_24h.
 */
public record Amenities(boolean parking, boolean powerBackup, boolean security, boolean waterAccess, boolean open24h) {

    /** No amenities ticked. */
    public static final Amenities NONE = new Amenities(false, false, false, false, false);
}
