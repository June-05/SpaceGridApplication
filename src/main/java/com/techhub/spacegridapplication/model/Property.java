package com.techhub.spacegridapplication.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.techhub.spacegridapplication.exception.ValidationException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * A landlord's property. Owns its zones and the grid rules that involve more than one zone:
 * spots inside the grid, one zone per spot, automatic walls and manual edge overrides.
 */
public class Property extends BaseEntity {

    public static final int MAX_GRID_SIZE = 60;

    private int landlordId;
    private String name;
    private String address;
    private PropertyType propertyType;
    private String description;
    private Dimensions dimensions;                      // null = no size given
    private PropertyStatus status;
    private int gridRows;
    private int gridColumns;
    private List<GridZone> zones;
    private Map<GridEdge, EdgeType> edgeOverrides;      // only manual edits; automatic walls are calculated

    /** New property: starts as DRAFT with a 1 x 1 grid. */
    public Property(int landlordId, String name, String address, PropertyType propertyType,
                    String description, Dimensions dimensions) {
        if (name == null || name.isBlank()) {
            throw new ValidationException("Property name is required.");
        }
        if (address == null || address.isBlank()) {
            throw new ValidationException("Address is required.");
        }
        if (propertyType == null) {
            throw new ValidationException("Property type is required.");
        }
        this.landlordId = landlordId;
        this.name = name.trim();
        this.address = address.trim();
        this.propertyType = propertyType;
        this.description = description;
        this.dimensions = dimensions;
        this.status = PropertyStatus.DRAFT;
        this.gridRows = 1;
        this.gridColumns = 1;
        this.zones = new ArrayList<>();
        this.edgeOverrides = new HashMap<>();
    }

    /** From database (zones and edge overrides are loaded by JdbcPropertyDao). */
    public Property(int id, LocalDateTime createdAt, int landlordId, String name, String address,
                    PropertyType propertyType, String description, Dimensions dimensions, PropertyStatus status,
                    int gridRows, int gridColumns, List<GridZone> zones, Map<GridEdge, EdgeType> edgeOverrides) {
        super(id, createdAt);
        this.landlordId = landlordId;
        this.name = name;
        this.address = address;
        this.propertyType = propertyType;
        this.description = description;
        this.dimensions = dimensions;
        this.status = status;
        this.gridRows = gridRows;
        this.gridColumns = gridColumns;
        this.zones = (zones != null) ? new ArrayList<>(zones) : new ArrayList<>();
        this.edgeOverrides = (edgeOverrides != null) ? new HashMap<>(edgeOverrides) : new HashMap<>();
    }

    // ---------------------------------------------------------------- getters
    public int getLandlordId() { return landlordId; }
    public String getName() { return name; }
    public String getAddress() { return address; }
    public PropertyType getPropertyType() { return propertyType; }
    public String getDescription() { return description; }
    public Dimensions getDimensions() { return dimensions; }
    public PropertyStatus getStatus() { return status; }
    public int getGridRows() { return gridRows; }
    public int getGridColumns() { return gridColumns; }

    /** Read-only list of all zones (units and common areas). */
    public List<GridZone> getZones() { return Collections.unmodifiableList(zones); }

    /** Read-only map of manual edge edits. Hidden from JSON; the page uses getEdgesByType() instead. */
    @JsonIgnore
    public Map<GridEdge, EdgeType> getEdgeOverrides() { return Collections.unmodifiableMap(edgeOverrides); }

    /** Edge overrides grouped by type, the same shape the grid page sends to PUT /edges. Used for JSON. */
    public Map<EdgeType, List<GridEdge>> getEdgesByType() {
        Map<EdgeType, List<GridEdge>> result = new EnumMap<>(EdgeType.class);
        edgeOverrides.forEach((edge, type) -> result.computeIfAbsent(type, t -> new ArrayList<>()).add(edge));
        return result;
    }

    // ---------------------------------------------------------------- details
    public void updateDetails(String name, String address, PropertyType propertyType,
                              String description, Dimensions dimensions) {
        // TODO: validate like the constructor, then replace the fields
    }

    public void publish() {
        // TODO: status -> ACTIVE (not allowed if ARCHIVED)
    }

    public void archive() {
        // TODO: status -> ARCHIVED
    }

    public boolean isOwnedBy(int userId) {
        return landlordId == userId;
    }

    // ---------------------------------------------------------------- zones
    public void addZone(GridZone zone) {
        if (zone == null || getId() == null || zone.getPropertyId() != getId()) {
            throw new ValidationException("This zone doesn't belong to this property.");
        }
        if (!zones.contains(zone)) {
            zones.add(zone);
        }
    }

    /** Takes a zone (and so its spots) off the property, e.g. before it is deleted. */
    public void removeZone(GridZone zone) {
        if (zone != null) {
            zones.remove(zone);
        }
    }

    @JsonIgnore
    public List<RentableUnit> getRentableUnits() {
        // TODO: zones that are RentableUnit (hide ARCHIVED ones if you prefer)
        throw new UnsupportedOperationException("TODO");
    }

    @JsonIgnore
    public List<CommonArea> getCommonAreas() {
        List<CommonArea> areas = new ArrayList<>();
        for (GridZone zone : zones) {
            if (zone instanceof CommonArea area) {
                areas.add(area);
            }
        }
        return areas;
    }

    public int countUnitsByStatus(UnitStatus status) {
        // TODO
        throw new UnsupportedOperationException("TODO");
    }

    /** Archives a unit: it must have no ACTIVE lease (checked by the service); its spots are cleared. */
    public void archiveUnit(RentableUnit unit) {
        if (unit == null || !zones.contains(unit)) {
            throw new ValidationException("This unit doesn't belong to this property.");
        }
        unit.archive();                       // checks first, so nothing is cleared if it is not allowed
        unit.clearPositions();
    }

    // ---------------------------------------------------------------- grid
    public void resizeGrid(int rows, int cols) {
        if (rows < 1 || rows > MAX_GRID_SIZE || cols < 1 || cols > MAX_GRID_SIZE) {
            throw new ValidationException("Rows and columns must be between 1 and " + MAX_GRID_SIZE + ".");
        }
        this.gridRows = rows;
        this.gridColumns = cols;
        for (GridZone zone : zones) {
            for (GridPosition position : new ArrayList<>(zone.getPositions())) {
                if (!position.isWithin(rows, cols)) {
                    zone.removePosition(position);
                }
            }
        }
        edgeOverrides.keySet().removeIf(edge -> !edge.isWithin(rows, cols));
    }

    public boolean isWithinGrid(GridPosition position) {
        return position != null && position.isWithin(gridRows, gridColumns);
    }

    public Optional<GridZone> zoneAt(GridPosition position) {
        for (GridZone zone : zones) {
            if (zone.occupies(position)) {
                return Optional.of(zone);
            }
        }
        return Optional.empty();
    }

    /** Takes the spot away from any other zone first, so a spot has only one zone. */
    public void assignSpot(GridZone zone, GridPosition position) {
        if (zone == null || !zones.contains(zone)) {
            throw new ValidationException("This zone doesn't belong to this property.");
        }
        if (zone instanceof RentableUnit unit && unit.isArchived()) {
            throw new ValidationException(zone.getName() + " is archived and can't be placed on the grid.");
        }
        if (!isWithinGrid(position)) {
            throw new ValidationException("The spot " + (position == null ? "" : position.toDisplayString() + " ")
                    + "is outside the " + gridRows + " x " + gridColumns + " grid.");
        }
        for (GridZone other : zones) {
            if (other != zone) {
                other.removePosition(position);   // a spot belongs to only one zone
            }
        }
        zone.addPosition(position);
    }

    public void clearSpot(GridPosition position) {
        for (GridZone zone : zones) {
            zone.removePosition(position);
        }
    }

    public void clearAllSpots() {
        for (GridZone zone : zones) {
            zone.clearPositions();
        }
    }

    public int totalSpots() {
        return gridRows * gridColumns;
    }

    public int assignedSpotCount() {
        int count = 0;
        for (GridZone zone : zones) {
            count += zone.spotCount();
        }
        return count;
    }

    // ---------------------------------------------------------------- walls / doors / windows
    /**
     * Automatic wall: between two spots of different zones when at least one side isEnclosed(),
     * and on the grid border next to an enclosed spot. Otherwise empty.
     */
    public Optional<EdgeType> autoEdgeAt(GridEdge edge) {
        if (edge == null || !edge.isWithin(gridRows, gridColumns)) {
            return Optional.empty();
        }
        List<GridPosition> sides = new ArrayList<>();
        for (GridPosition position : edge.adjacentPositions()) {
            if (isWithinGrid(position)) {
                sides.add(position);
            }
        }
        if (sides.size() == 1) {                              // outer border of the grid
            return isEnclosedAt(sides.get(0)) ? Optional.of(EdgeType.WALL) : Optional.empty();
        }
        Optional<GridZone> a = zoneAt(sides.get(0));
        Optional<GridZone> b = zoneAt(sides.get(1));
        if (a.isPresent() && b.isPresent() && a.get() == b.get()) {
            return Optional.empty();                          // inside one zone: no wall
        }
        boolean enclosed = isEnclosedAt(sides.get(0)) || isEnclosedAt(sides.get(1));
        return enclosed ? Optional.of(EdgeType.WALL) : Optional.empty();
    }

    /** The manual override if there is one, otherwise the automatic result. */
    public Optional<EdgeType> edgeAt(GridPosition position, Side side) {
        GridEdge edge = GridEdge.of(position, side);
        EdgeType override = edgeOverrides.get(edge);
        return (override != null) ? Optional.of(override) : autoEdgeAt(edge);
    }

    public void setEdge(GridPosition position, Side side, EdgeType type) {
        if (type == null) {
            throw new ValidationException("Edge type is required.");
        }
        GridEdge edge = GridEdge.of(position, side);
        if (!edge.isWithin(gridRows, gridColumns)) {
            throw new ValidationException("That line is outside the " + gridRows + " x " + gridColumns + " grid.");
        }
        edgeOverrides.put(edge, type);
    }

    public void resetEdge(GridPosition position, Side side) {
        edgeOverrides.remove(GridEdge.of(position, side));
    }

    public void resetAllEdges() {
        edgeOverrides.clear();
    }

    private boolean isEnclosedAt(GridPosition position) {
        return zoneAt(position).map(GridZone::isEnclosed).orElse(false);
    }
}
