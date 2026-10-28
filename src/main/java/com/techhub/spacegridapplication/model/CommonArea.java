package com.techhub.spacegridapplication.model;

import com.techhub.spacegridapplication.exception.ValidationException;

import java.time.LocalDateTime;
import java.util.Set;

/** A non-rentable zone: walkway, grass, shared bathroom, kitchen... */
public class CommonArea extends GridZone {

    private CommonAreaType areaType;
    private String customColor;             // "#rrggbb" picked by the landlord, null = the type's default color

    /** New common area with the type's default color. */
    public CommonArea(int propertyId, String name, CommonAreaType areaType) {
        this(propertyId, name, areaType, null);
    }

    /** New common area; color is optional ("#rrggbb", or null/blank for the type's default). */
    public CommonArea(int propertyId, String name, CommonAreaType areaType, String color) {
        super(propertyId, name);
        if (areaType == null) {
            throw new ValidationException("Area type is required.");
        }
        this.areaType = areaType;
        this.customColor = (color == null || color.isBlank()) ? null : checkColor(color);
    }

    /** From database. */
    public CommonArea(int id, LocalDateTime createdAt, int propertyId, String name, Set<GridPosition> positions,
                      CommonAreaType areaType, String customColor) {
        super(id, createdAt, propertyId, name, positions);
        this.areaType = areaType;
        this.customColor = customColor;
    }

    public CommonAreaType getAreaType() { return areaType; }

    /** The picked color, or null when the type's default is used. */
    public String getCustomColor() { return customColor; }

    /** Picks a new color ("#rrggbb"). The service checks that no other common area of the property uses it. */
    public void changeColor(String color) {
        this.customColor = checkColor(color);
    }

    /** "#RRGGBB" → "#rrggbb"; anything else is rejected. */
    private static String checkColor(String color) {
        String c = color == null ? "" : color.trim().toLowerCase();
        if (!c.matches("#[0-9a-f]{6}")) {
            throw new ValidationException("Pick a color like #a1b2c3.");
        }
        return c;
    }

    public void changeType(CommonAreaType areaType) {
        // TODO: reject null
    }

    @Override
    public boolean isRentable() {
        return false;
    }

    @Override
    public boolean isEnclosed() {
        return areaType.isIndoor();
    }

    @Override
    public String getCssClasses() {
        return "zone zone-common " + areaType.getCssClass();
    }

    @Override
    public String getColor() {
        return customColor != null ? customColor : areaType.getDefaultColor();
    }
}
