package com.techhub.spacegridapplication.model;

import com.techhub.spacegridapplication.exception.ValidationException;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/**
 * Anything that takes up spots on a property's grid. Abstract: either a RentableUnit or a CommonArea.
 * Spots can only be changed through Property (the ~ package-private methods), so grid rules can't be bypassed.
 */
public abstract class GridZone extends BaseEntity {

    private int propertyId;
    private String name;
    private Set<GridPosition> positions;

    /** New zone. */
    protected GridZone(int propertyId, String name) {
        if (name == null || name.isBlank()) {
            throw new ValidationException("Name is required.");
        }
        this.propertyId = propertyId;
        this.name = name.trim();
        this.positions = new HashSet<>();
    }

    /** From database (positions come from zone_cells). */
    protected GridZone(
            int id,
            LocalDateTime createdAt,
            int propertyId,
            String name,
            Set<GridPosition> positions) {
        super(id, createdAt);
        this.propertyId = propertyId;
        this.name = name;
        this.positions = (positions != null) ? new HashSet<>(positions) : new HashSet<>();
    }

    public int getPropertyId() { return propertyId; }
    public String getName() { return name; }

    /** Read-only set of this zone's spots. */
    public Set<GridPosition> getPositions() { return Collections.unmodifiableSet(positions); }

    public void rename(String name) {
        if (name == null || name.isBlank()) {
            throw new ValidationException("Name is required.");
        }
        this.name = name.trim();
    }

    public boolean occupies(GridPosition position) {
        return positions.contains(position);
    }

    public int spotCount() {
        return positions.size();
    }

    void addPosition(GridPosition position) {
        positions.add(position);
    }

    void removePosition(GridPosition position) {
        positions.remove(position);
    }

    void clearPositions() {
        positions.clear();
    }

    /** RentableUnit: true. CommonArea: false. */
    public abstract boolean isRentable();

    /** True if automatic walls go around this zone (units and indoor common areas). */
    public abstract boolean isEnclosed();

    /** CSS classes for the grid page, e.g. "zone zone-common zone-grass". */
    public abstract String getCssClasses();

    /** Default color for the grid page (from the enum's defaultColor). */
    public abstract String getColor();
}
