package com.techhub.spacegridapplication.controller;

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

    /** Query string: ?search=&type= (both optional). */
    @GetMapping
    public List<Property> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) PropertyType type,
            HttpSession session) {
        // TODO: get the user from sessionManager, call the service, return the result
        throw new UnsupportedOperationException("TODO");
    }

    /** Includes zones (with spots) and edgesByType, for the grid page. */
    @GetMapping("/{id}")
    public Property get(@PathVariable int id, HttpSession session) {
        User landlord = sessionManager.requireRole(session, Role.LANDLORD);
        return propertyService.getOwnedProperty(id, landlord);
    }

    /** Form fields. Build Dimensions from exactSize / areaSqm / sizeDescription (all optional). */
    @PostMapping
    public Property create(
            @RequestParam String name,
            @RequestParam String address,
            @RequestParam PropertyType type,
            @RequestParam(required = false) String description,
            @RequestParam(required = false) Boolean exactSize,
            @RequestParam(required = false) BigDecimal areaSqm,
            @RequestParam(required = false) String sizeDescription,
            HttpSession session) {
        // TODO: get the user from sessionManager, call the service, return the result
        throw new UnsupportedOperationException("TODO");
    }

    @PutMapping("/{id}")
    public Property update(
            @PathVariable int id,
            @RequestParam String name,
            @RequestParam String address,
            @RequestParam PropertyType type,
            @RequestParam(required = false) String description,
            @RequestParam(required = false) Boolean exactSize,
            @RequestParam(required = false) BigDecimal areaSqm,
            @RequestParam(required = false) String sizeDescription,
            HttpSession session) {
        // TODO: get the user from sessionManager, call the service, return the result
        throw new UnsupportedOperationException("TODO");
    }

    @PostMapping("/{id}/publish")
    public void publish(@PathVariable int id, HttpSession session) {
        // TODO: get the user from sessionManager, call the service, return the result
    }

    @PostMapping("/{id}/archive")
    public void archive(@PathVariable int id, HttpSession session) {
        // TODO: get the user from sessionManager, call the service, return the result
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
}
