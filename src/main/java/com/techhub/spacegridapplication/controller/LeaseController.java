package com.techhub.spacegridapplication.controller;

import com.techhub.spacegridapplication.model.LeaseContract;
import com.techhub.spacegridapplication.security.SessionManager;
import com.techhub.spacegridapplication.service.LeaseService;
import jakarta.servlet.http.HttpSession;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Lease pages for both roles (landlord: leases, lease form, lease details; renter: dashboard).
 * Every method gets the logged-in user from SessionManager (never from the browser).
 */
@RestController
@RequestMapping("/api")
public class LeaseController {

    private final LeaseService leaseService;
    private final SessionManager sessionManager;

    public LeaseController(LeaseService leaseService, SessionManager sessionManager) {
        this.leaseService = leaseService;
        this.sessionManager = sessionManager;
    }

    /** Landlord: all leases on their properties. Renter: only their own. */
    @GetMapping("/leases")
    public List<LeaseContract> list(HttpSession session) {
        // TODO: get the user from sessionManager, call the service, return the result
        throw new UnsupportedOperationException("TODO");
    }

    @GetMapping("/leases/{id}")
    public LeaseContract get(@PathVariable int id, HttpSession session) {
        // TODO: get the user from sessionManager, call the service, return the result
        throw new UnsupportedOperationException("TODO");
    }

    @GetMapping("/properties/{propertyId}/leases")
    public List<LeaseContract> listForProperty(@PathVariable int propertyId, HttpSession session) {
        // TODO: get the user from sessionManager, call the service, return the result
        throw new UnsupportedOperationException("TODO");
    }

    /** Form fields; dates as yyyy-MM-dd (what <input type="date"> sends). */
    @PostMapping("/leases")
    public LeaseContract create(
            @RequestParam int unitId,
            @RequestParam String renterUsername,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam BigDecimal monthlyRent,
            HttpSession session) {
        // TODO: get the user from sessionManager, call the service, return the result
        throw new UnsupportedOperationException("TODO");
    }

    @PostMapping("/leases/{id}/renew")
    public LeaseContract renew(
            @PathVariable int id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate newStartDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate newEndDate,
            @RequestParam BigDecimal newMonthlyRent,
            HttpSession session) {
        // TODO: get the user from sessionManager, call the service, return the result
        throw new UnsupportedOperationException("TODO");
    }

    @PostMapping("/leases/{id}/end")
    public void end(@PathVariable int id, HttpSession session) {
        // TODO: get the user from sessionManager, call the service, return the result
    }

    @PostMapping("/leases/{id}/terminate")
    public void terminate(@PathVariable int id, HttpSession session) {
        // TODO: get the user from sessionManager, call the service, return the result
    }
}
