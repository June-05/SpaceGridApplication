package com.techhub.spacegridapplication.service;

import com.techhub.spacegridapplication.dao.PropertyDao;
import com.techhub.spacegridapplication.exception.AccessDeniedException;
import com.techhub.spacegridapplication.exception.NotFoundException;
import com.techhub.spacegridapplication.exception.ValidationException;
import com.techhub.spacegridapplication.model.Dimensions;
import com.techhub.spacegridapplication.model.EdgeType;
import com.techhub.spacegridapplication.model.GridEdge;
import com.techhub.spacegridapplication.model.GridPosition;
import com.techhub.spacegridapplication.model.GridZone;
import com.techhub.spacegridapplication.model.Orientation;
import com.techhub.spacegridapplication.model.Property;
import com.techhub.spacegridapplication.model.PropertyType;
import com.techhub.spacegridapplication.model.Side;
import com.techhub.spacegridapplication.model.User;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Properties and the grid layout. Every method checks that the landlord owns the property. */
@Service
public class PropertyService {

    private final PropertyDao propertyDao;

    public PropertyService(PropertyDao propertyDao) {
        this.propertyDao = propertyDao;
    }

    /** search and type are optional filters. */
    public List<Property> getPropertiesForLandlord(User landlord, String search, PropertyType type) {
        // TODO
        throw new UnsupportedOperationException("TODO");
    }

    /** NotFoundException if missing, AccessDeniedException if not the landlord's. */
    public Property getOwnedProperty(int propertyId, User landlord) {
        Property property = propertyDao.findById(propertyId)
                .orElseThrow(() -> new NotFoundException("Property not found."));
        if (!property.isOwnedBy(landlord.getId())) {
            throw new AccessDeniedException("This property doesn't belong to your account.");
        }
        return property;
    }

    public Property createProperty(
            User landlord,
            String name,
            String address,
            PropertyType type,
            String description,
            Dimensions dimensions) {
        // TODO
        throw new UnsupportedOperationException("TODO");
    }

    public Property updateProperty(
            int propertyId,
            User landlord,
            String name,
            String address,
            PropertyType type,
            String description,
            Dimensions dimensions) {
        // TODO
        throw new UnsupportedOperationException("TODO");
    }

    public void publishProperty(int propertyId, User landlord) {
        // TODO
    }

    public void archiveProperty(int propertyId, User landlord) {
        // TODO
    }

    /** Resize the grid, clear all spots, assign the new ones (zone id -> its spots), then propertyDao.saveGridLayout(). */
    @Transactional
    public Property saveGridLayout(
            int propertyId,
            User landlord,
            int rows,
            int cols,
            Map<Integer, List<GridPosition>> spotsByZone) {
        Property property = getOwnedProperty(propertyId, landlord);
        property.resizeGrid(rows, cols);
        property.clearAllSpots();

        Map<Integer, GridZone> zonesById = new HashMap<>();
        for (GridZone zone : property.getZones()) {
            zonesById.put(zone.getId(), zone);
        }
        Set<GridPosition> used = new HashSet<>();
        if (spotsByZone != null) {
            for (Map.Entry<Integer, List<GridPosition>> entry : spotsByZone.entrySet()) {
                GridZone zone = zonesById.get(entry.getKey());
                if (zone == null) {
                    throw new ValidationException("Zone #" + entry.getKey() + " doesn't belong to this property.");
                }
                for (GridPosition position : entry.getValue()) {
                    if (!used.add(position)) {
                        throw new ValidationException("The spot " + position.toDisplayString() + " was assigned twice.");
                    }
                    property.assignSpot(zone, position);   // also checks the spot is inside the grid
                }
            }
        }
        propertyDao.saveGridLayout(property);
        return property;
    }

    /** Replace the manual wall/door/window edits, then propertyDao.saveEdgeOverrides(). */
    @Transactional
    public Property saveEdgeOverrides(
            int propertyId,
            User landlord,
            Map<EdgeType, List<GridEdge>> edgesByType) {
        Property property = getOwnedProperty(propertyId, landlord);
        property.resetAllEdges();

        Set<GridEdge> used = new HashSet<>();
        if (edgesByType != null) {
            for (Map.Entry<EdgeType, List<GridEdge>> entry : edgesByType.entrySet()) {
                for (GridEdge edge : entry.getValue()) {
                    if (!used.add(edge)) {
                        throw new ValidationException("A line was given two different types.");
                    }
                    // standard form: HORIZONTAL (r, c) = TOP of spot (r, c); VERTICAL (r, c) = LEFT of spot (r, c)
                    Side side = (edge.orientation() == Orientation.HORIZONTAL) ? Side.TOP : Side.LEFT;
                    property.setEdge(new GridPosition(edge.row(), edge.col()), side, entry.getKey());
                }
            }
        }
        propertyDao.saveEdgeOverrides(property);
        return property;
    }
}
