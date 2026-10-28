package com.techhub.spacegridapplication.controller;

import com.techhub.spacegridapplication.model.Dimensions;
import com.techhub.spacegridapplication.model.RentableUnit;
import com.techhub.spacegridapplication.model.Role;
import com.techhub.spacegridapplication.model.UnitDetails;
import com.techhub.spacegridapplication.model.UnitRemovalCheck;
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
        User landlord = sessionManager.requireRole(session, Role.LANDLORD);
        Dimensions size = (exactSize == null) ? null
                : exactSize ? Dimensions.exact(areaSqm) : Dimensions.approximate(sizeDescription == null ? "" : sizeDescription);
        return unitService.updateUnit(id, landlord, name, rentalRate, size, electricity, water);
    }

    /** Form field: underMaintenance=true|false. Not while the unit is occupied (409). */
    @PostMapping("/units/{id}/maintenance")
    public void setMaintenance(
            @PathVariable int id,
            @RequestParam boolean underMaintenance,
            HttpSession session) {
        User landlord = sessionManager.requireRole(session, Role.LANDLORD);
        unitService.setUnderMaintenance(id, landlord, underMaintenance);
    }

    /** The plotter's View mode: the unit, its current (ACTIVE) lease or null, and how many lease requests are open. */
    @GetMapping("/units/{id}/details")
    public UnitDetails details(@PathVariable int id, HttpSession session) {
        User landlord = sessionManager.requireRole(session, Role.LANDLORD);
        return unitService.getUnitDetails(id, landlord);
    }

    /** Before deleting or archiving: may it be deleted, only archived, or neither (and why), and how many open requests. */
    @GetMapping("/units/{id}/removal-check")
    public UnitRemovalCheck removalCheck(@PathVariable int id, HttpSession session) {
        User landlord = sessionManager.requireRole(session, Role.LANDLORD);
        return unitService.removalCheck(id, landlord);
    }

    /** Only a unit with no ACTIVE lease. Its spots are cleared; its leases and payments are kept. 409 otherwise. */
    @PostMapping("/units/{id}/archive")
    public void archive(@PathVariable int id, HttpSession session) {
        User landlord = sessionManager.requireRole(session, Role.LANDLORD);
        unitService.archiveUnit(id, landlord);
    }

    /** Only a unit that was never leased (409 otherwise: archive it). Open lease requests are declined. */
    @DeleteMapping("/units/{id}")
    public void delete(@PathVariable int id, HttpSession session) {
        User landlord = sessionManager.requireRole(session, Role.LANDLORD);
        unitService.deleteUnit(id, landlord);
    }
}
