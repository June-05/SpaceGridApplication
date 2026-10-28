package com.techhub.spacegridapplication.controller;

import com.techhub.spacegridapplication.model.Amenities;
import com.techhub.spacegridapplication.model.Dimensions;
import com.techhub.spacegridapplication.model.EdgeType;
import com.techhub.spacegridapplication.model.GridEdge;
import com.techhub.spacegridapplication.model.GridPosition;
import com.techhub.spacegridapplication.model.Property;
import com.techhub.spacegridapplication.model.PropertyType;
import com.techhub.spacegridapplication.model.Role;
import com.techhub.spacegridapplication.model.User;
import com.techhub.spacegridapplication.security.SessionManager;
import com.techhub.spacegridapplication.service.PropertyService;

import jakarta.servlet.http.HttpSession;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * Landlord property pages: dashboard, property form and grid plotter.
 * Every method gets the logged-in user from SessionManager (never from the browser).
 */
@RestController
@RequestMapping("/api/properties")
public class PropertyController {

    private final PropertyService propertyService;
    private final SessionManager sessionManager;

    public PropertyController(PropertyService propertyService, SessionManager sessionManager) {
        this.propertyService = propertyService;
        this.sessionManager = sessionManager;
    }

    /** Query string: ?search=&type= (both optional). Each property includes its zones, so the page can count units. */
    @GetMapping
    public List<Property> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) PropertyType type,
            HttpSession session) {
        User landlord = sessionManager.requireRole(session, Role.LANDLORD);
        return propertyService.getPropertiesForLandlord(landlord, search, type);
    }

    /** Includes zones (with spots) and edgesByType, for the grid page. */
    @GetMapping("/{id}")
    public Property get(@PathVariable int id, HttpSession session) {
        User landlord = sessionManager.requireRole(session, Role.LANDLORD);
        return propertyService.getOwnedProperty(id, landlord);
    }

    /**
     * Form fields: name, address (street), city, region, type, description, defaultRate,
     * size (exactSize / areaSqm / sizeDescription) and the amenity checkboxes
     * parking, powerBackup, security, waterAccess, open24h (default false). Optional fields may be left out.
     */
    @PostMapping
    public Property create(
            @RequestParam String name,
            @RequestParam String address,
            @RequestParam String city,
            @RequestParam String region,
            @RequestParam PropertyType type,
            @RequestParam(required = false) String description,
            @RequestParam(required = false) Boolean exactSize,
            @RequestParam(required = false) BigDecimal areaSqm,
            @RequestParam(required = false) String sizeDescription,
            @RequestParam(required = false) BigDecimal defaultRate,
            @RequestParam(defaultValue = "false") boolean parking,
            @RequestParam(defaultValue = "false") boolean powerBackup,
            @RequestParam(defaultValue = "false") boolean security,
            @RequestParam(defaultValue = "false") boolean waterAccess,
            @RequestParam(defaultValue = "false") boolean open24h,
            HttpSession session) {
        User landlord = sessionManager.requireRole(session, Role.LANDLORD);
        return propertyService.createProperty(landlord, name, address, city, region, type, description,
                toDimensions(exactSize, areaSqm, sizeDescription), defaultRate,
                new Amenities(parking, powerBackup, security, waterAccess, open24h));
    }

    /** Same form fields as create. */
    @PutMapping("/{id}")
    public Property update(
            @PathVariable int id,
            @RequestParam String name,
            @RequestParam String address,
            @RequestParam String city,
            @RequestParam String region,
            @RequestParam PropertyType type,
            @RequestParam(required = false) String description,
            @RequestParam(required = false) Boolean exactSize,
            @RequestParam(required = false) BigDecimal areaSqm,
            @RequestParam(required = false) String sizeDescription,
            @RequestParam(required = false) BigDecimal defaultRate,
            @RequestParam(defaultValue = "false") boolean parking,
            @RequestParam(defaultValue = "false") boolean powerBackup,
            @RequestParam(defaultValue = "false") boolean security,
            @RequestParam(defaultValue = "false") boolean waterAccess,
            @RequestParam(defaultValue = "false") boolean open24h,
            HttpSession session) {
        User landlord = sessionManager.requireRole(session, Role.LANDLORD);
        return propertyService.updateProperty(id, landlord, name, address, city, region, type, description,
                toDimensions(exactSize, areaSqm, sizeDescription), defaultRate,
                new Amenities(parking, powerBackup, security, waterAccess, open24h));
    }

    /** DRAFT -> ACTIVE (shows on the homepage). */
    @PostMapping("/{id}/publish")
    public Property publish(@PathVariable int id, HttpSession session) {
        User landlord = sessionManager.requireRole(session, Role.LANDLORD);
        return propertyService.publishProperty(id, landlord);
    }

    /** -> ARCHIVED. 409 while a unit has an active lease. */
    @PostMapping("/{id}/archive")
    public Property archive(@PathVariable int id, HttpSession session) {
        User landlord = sessionManager.requireRole(session, Role.LANDLORD);
        return propertyService.archiveProperty(id, landlord);
    }

    /** PUT /api/properties/{id}/grid?rows=4&cols=6 with a JSON body: {"zoneId": [{"row":0,"col":0}, ...], ...} */
    @PutMapping("/{id}/grid")
    public Property saveGrid(
            @PathVariable int id,
            @RequestParam int rows,
            @RequestParam int cols,
            @RequestBody Map<Integer, List<GridPosition>> spotsByZone,
            HttpSession session) {
        User landlord = sessionManager.requireRole(session, Role.LANDLORD);
        return propertyService.saveGridLayout(id, landlord, rows, cols, spotsByZone);
    }

    /** JSON body: {"DOOR": [{"row":2,"col":0,"orientation":"HORIZONTAL"}], "WINDOW": [...]} */
    @PutMapping("/{id}/edges")
    public Property saveEdges(
            @PathVariable int id,
            @RequestBody Map<EdgeType, List<GridEdge>> edgesByType,
            HttpSession session) {
        User landlord = sessionManager.requireRole(session, Role.LANDLORD);
        return propertyService.saveEdgeOverrides(id, landlord, edgesByType);
    }

    /** exactSize missing = no size; true = areaSqm; false = sizeDescription (same rule as the unit forms). */
    private static Dimensions toDimensions(Boolean exactSize, BigDecimal areaSqm, String sizeDescription) {
        if (exactSize == null) {
            return null;
        }
        return exactSize ? Dimensions.exact(areaSqm) : Dimensions.approximate(sizeDescription == null ? "" : sizeDescription);
    }
}
