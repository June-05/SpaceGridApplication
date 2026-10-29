package com.techhub.spacegridapplication.model;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Value object: a property's grid as the public homepage may see it (GET /api/browse/{id}/layout).
 * Only the layout and which units are free: no rates of taken units, no tenants, no landlord id.
 * The field names match Property's JSON (gridRows, gridColumns, zones, edgesByType), so grid-renderer.js's
 * fromProperty() reads it the same way. Archived units are left out.
 */
public record GridPreview(
        int gridRows,
        int gridColumns,
        List<Zone> zones,
        Map<EdgeType, List<GridEdge>> edgesByType) {

    /** One zone on the preview. available = an AVAILABLE unit (false for common areas and taken units). */
    public record Zone(
            int id,
            String name,
            boolean rentable,
            boolean enclosed,
            boolean available,
            String color,
            String cssClasses,
            Set<GridPosition> positions) {
    }

    public static GridPreview from(Property property) {
        List<Zone> zones = property.getZones().stream()
                .filter(z -> !(z instanceof RentableUnit unit && unit.isArchived()))
                .map(z -> new Zone(
                        z.getId(),
                        z.getName(),
                        z.isRentable(),
                        z.isEnclosed(),
                        z instanceof RentableUnit unit && unit.isAvailable(),
                        z.getColor(),
                        z.getCssClasses(),
                        z.getPositions()))
                .toList();
        return new GridPreview(property.getGridRows(), property.getGridColumns(), zones, property.getEdgesByType());
    }
}
