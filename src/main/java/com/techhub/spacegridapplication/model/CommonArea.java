package com.techhub.spacegridapplication.model;

import com.techhub.spacegridapplication.exception.ValidationException;

import java.time.LocalDateTime;
import java.util.Set;

/** A non-rentable zone: walkway, grass, shared bathroom, kitchen... */
public class CommonArea extends GridZone {

    private CommonAreaType areaType;

    /** New common area. */
    public CommonArea(int propertyId, String name, CommonAreaType areaType) {
        super(propertyId, name);
        if (areaType == null) {
            throw new ValidationException("Area type is required.");
        }
        this.areaType = areaType;
    }

    /** From database. */
    public CommonArea(int id, LocalDateTime createdAt, int propertyId, String name, Set<GridPosition> positions,
                      CommonAreaType areaType) {
        super(id, createdAt, propertyId, name, positions);
        this.areaType = areaType;
    }

    public CommonAreaType getAreaType() { return areaType; }

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
        return areaType.getDefaultColor();
    }
}
