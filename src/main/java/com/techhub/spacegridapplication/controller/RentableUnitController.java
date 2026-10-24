package com.techhub.spacegridapplication.controller;

import com.techhub.spacegridapplication.model.Dimensions;
import com.techhub.spacegridapplication.model.RentableUnit;
import com.techhub.spacegridapplication.model.Role;
import com.techhub.spacegridapplication.model.User;
import com.techhub.spacegridapplication.security.SessionManager;
import com.techhub.spacegridapplication.service.RentableUnitService;

import jakarta.servlet.http.HttpSession;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;

/**
 * Units page and the "Add unit" form on the grid page.
 * Every method gets the logged-in user from SessionManager (never from the browser).
 */
@RestController
@RequestMapping("/api")
public class RentableUnitController {

    private final RentableUnitService unitService;
    private final SessionManager sessionManager;

    public RentableUnitController(RentableUnitService unitService, SessionManager sessionManager) {
        this.unitService = unitService;
        this.sessionManager = sessionManager;
    }

    @GetMapping("/properties/{propertyId}/units")
    public List<RentableUnit> list(@PathVariable int propertyId, HttpSession session) {
        // TODO: get the user from sessionManager, call the service, return the result
        throw new UnsupportedOperationException("TODO");
    }

    /** Form fields. electricity / water default to false. */
    @PostMapping("/properties/{propertyId}/units")
    public RentableUnit create(
            @PathVariable int propertyId,
            @RequestParam String name,
            @RequestParam BigDecimal rentalRate,
            @RequestParam(required = false) Boolean exactSize,
            @RequestParam(required = false) BigDecimal areaSqm,
            @RequestParam(required = false) String sizeDescription,
            @RequestParam(defaultValue = "false") boolean electricity,
            @RequestParam(defaultValue = "false") boolean water,
            HttpSession session) {
        User landlord = sessionManager.requireRole(session, Role.LANDLORD);
        Dimensions size = (exactSize == null) ? null
                : exactSize ? Dimensions.exact(areaSqm) : Dimensions.approximate(sizeDescription == null ? "" : sizeDescription);
        return unitService.addUnit(propertyId, landlord, name, rentalRate, size, electricity, water);
    }

    @PutMapping("/units/{id}")
    public RentableUnit update(
            @PathVariable int id,
            @RequestParam String name,
            @RequestParam BigDecimal rentalRate,
            @RequestParam(required = false) Boolean exactSize,
            @RequestParam(required = false) BigDecimal areaSqm,
            @RequestParam(required = false) String sizeDescription,
            @RequestParam(defaultValue = "false") boolean electricity,
            @RequestParam(defaultValue = "false") boolean water,
            HttpSession session) {
        // TODO: get the user from sessionManager, call the service, return the result
        throw new UnsupportedOperationException("TODO");
    }

    /** Form field: underMaintenance=true|false */
    @PostMapping("/units/{id}/maintenance")
    public void setMaintenance(
            @PathVariable int id,
            @RequestParam boolean underMaintenance,
            HttpSession session) {
        // TODO: get the user from sessionManager, call the service, return the result
    }

    @PostMapping("/units/{id}/archive")
    public void archive(@PathVariable int id, HttpSession session) {
        // TODO: get the user from sessionManager, call the service, return the result
    }

    @DeleteMapping("/units/{id}")
    public void delete(@PathVariable int id, HttpSession session) {
        // TODO: get the user from sessionManager, call the service, return the result
    }
}
