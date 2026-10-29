package com.techhub.spacegridapplication.service;

import com.techhub.spacegridapplication.dao.LeaseContractDao;
import com.techhub.spacegridapplication.dao.LeaseRequestDao;
import com.techhub.spacegridapplication.dao.PropertyDao;
import com.techhub.spacegridapplication.exception.AccessDeniedException;
import com.techhub.spacegridapplication.exception.ConflictException;
import com.techhub.spacegridapplication.exception.NotFoundException;
import com.techhub.spacegridapplication.exception.ValidationException;
import com.techhub.spacegridapplication.model.Amenities;
import com.techhub.spacegridapplication.model.Dimensions;
import com.techhub.spacegridapplication.model.EdgeType;
import com.techhub.spacegridapplication.model.GridEdge;
import com.techhub.spacegridapplication.model.GridPosition;
import com.techhub.spacegridapplication.model.GridPreview;
import com.techhub.spacegridapplication.model.GridZone;
import com.techhub.spacegridapplication.model.Orientation;
import com.techhub.spacegridapplication.model.Property;
import com.techhub.spacegridapplication.model.PropertyListing;
import com.techhub.spacegridapplication.model.PropertyType;
import com.techhub.spacegridapplication.model.RentableUnit;
import com.techhub.spacegridapplication.model.Side;
import com.techhub.spacegridapplication.model.User;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Properties and the grid layout. Every method checks that the landlord owns the property. */
@Service
public class PropertyService {

    private final PropertyDao propertyDao;
    private final LeaseContractDao leaseDao;
    private final LeaseRequestDao leaseRequestDao;

    public PropertyService(PropertyDao propertyDao, LeaseContractDao leaseDao, LeaseRequestDao leaseRequestDao) {
        this.propertyDao = propertyDao;
        this.leaseDao = leaseDao;
        this.leaseRequestDao = leaseRequestDao;
    }

    /** Public homepage: ACTIVE properties that have at least one AVAILABLE unit. No login needed. */
    public List<PropertyListing> getListings() {
        return propertyDao.findActiveListings();
    }

    /** Public homepage details. NotFoundException if the property isn't ACTIVE or has nothing available. */
    public PropertyListing getListing(int propertyId) {
        return propertyDao.findActiveListingById(propertyId)
                .orElseThrow(() -> new NotFoundException("This space isn't available for rent right now."));
    }

    /** Public homepage layout preview. Same rule as getListing (NotFoundException unless it is listed). */
    public GridPreview getListingLayout(int propertyId) {
        getListing(propertyId);
        Property property = propertyDao.findById(propertyId)
                .orElseThrow(() -> new NotFoundException("This space isn't available for rent right now."));
        return GridPreview.from(property);
    }

    /** search (name, address, city, region or "SG-PROP-<id>") and type are optional filters. Newest first. */
    public List<Property> getPropertiesForLandlord(User landlord, String search, PropertyType type) {
        String text = (search == null) ? "" : search.trim().toLowerCase();
        return propertyDao.findByLandlordId(landlord.getId()).stream()
                .filter(p -> type == null || p.getPropertyType() == type)
                .filter(p -> text.isEmpty()
                        || (p.getName() + " " + p.getFullAddress() + " SG-PROP-" + p.getId()).toLowerCase().contains(text))
                .toList();
    }

    /** Without an owner check: only for callers that checked access themselves (LeaseService.getPropertyOfLease). */
    public Property getProperty(int propertyId) {
        return propertyDao.findById(propertyId).orElseThrow(() -> new NotFoundException("Property not found."));
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

    /** New property: DRAFT with a 1 x 1 grid. The landlord draws the layout in the plotter next. */
    @Transactional
    public Property createProperty(
            User landlord,
            String name,
            String address,
            String city,
            String region,
            PropertyType type,
            String description,
            Dimensions dimensions,
            BigDecimal defaultRate,
            Amenities amenities) {
        Property property = new Property(landlord.getId(), name, address, city, region, type, description,
                dimensions, defaultRate, amenities);
        return propertyDao.save(property);
    }

    @Transactional
    public Property updateProperty(
            int propertyId,
            User landlord,
            String name,
            String address,
            String city,
            String region,
            PropertyType type,
            String description,
            Dimensions dimensions,
            BigDecimal defaultRate,
            Amenities amenities) {
        Property property = getOwnedProperty(propertyId, landlord);
        property.updateDetails(name, address, city, region, type, description, dimensions, defaultRate, amenities);
        propertyDao.update(property);
        return property;
    }

    /** DRAFT -> ACTIVE: it shows on the homepage (if it has an AVAILABLE unit). */
    @Transactional
    public Property publishProperty(int propertyId, User landlord) {
        Property property = getOwnedProperty(propertyId, landlord);
        property.publish();
        propertyDao.update(property);
        return property;
    }

    /**
     * -> ARCHIVED. Not while a unit has an ACTIVE lease (end or terminate it first).
     * Open lease requests for its units are declined, like when a unit is archived.
     */
    @Transactional
    public Property archiveProperty(int propertyId, User landlord) {
        Property property = getOwnedProperty(propertyId, landlord);
        for (RentableUnit unit : property.getRentableUnits()) {
            if (leaseDao.findActiveByUnitId(unit.getId()).isPresent()) {
                throw new ConflictException(unit.getName() + " has an active lease. End or terminate it before "
                        + "archiving " + property.getName() + ".");
            }
        }
        property.archive();
        propertyDao.update(property);
        for (RentableUnit unit : property.getRentableUnits()) {
            leaseRequestDao.declineOpenByUnitId(unit.getId());
        }
        return property;
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
