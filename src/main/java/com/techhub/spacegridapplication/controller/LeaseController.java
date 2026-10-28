package com.techhub.spacegridapplication.controller;

import com.techhub.spacegridapplication.model.LeaseContract;
import com.techhub.spacegridapplication.model.PaymentTerms;
import com.techhub.spacegridapplication.model.Property;
import com.techhub.spacegridapplication.model.Role;
import com.techhub.spacegridapplication.model.User;
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
        User user = sessionManager.currentUser(session);
        return user.isLandlord() ? leaseService.getLeasesForLandlord(user) : leaseService.getLeasesForRenter(user);
    }

    @GetMapping("/leases/{id}")
    public LeaseContract get(@PathVariable int id, HttpSession session) {
        User user = sessionManager.currentUser(session);
        return leaseService.getLeaseFor(id, user);
    }

    /** The lease's property and grid (read-only view on lease.html), for its landlord or its renter. */
    @GetMapping("/leases/{id}/property")
    public Property property(@PathVariable int id, HttpSession session) {
        User user = sessionManager.currentUser(session);
        return leaseService.getPropertyOfLease(id, user);
    }

    @GetMapping("/properties/{propertyId}/leases")
    public List<LeaseContract> listForProperty(@PathVariable int propertyId, HttpSession session) {
        User landlord = sessionManager.requireRole(session, Role.LANDLORD);
        return leaseService.getLeasesForProperty(propertyId, landlord);
    }

    /** Lease form's "pick an existing account": ?search= matches username or full name (at most 20 renters). */
    @GetMapping("/renters")
    public List<User> renters(@RequestParam(required = false) String search, HttpSession session) {
        sessionManager.requireRole(session, Role.LANDLORD);
        return leaseService.findRenters(search);
    }

    /**
     * Form fields; dates as yyyy-MM-dd (what <input type="date"> sends).
     * paymentTerms defaults to MONTHLY_ADVANCE; tenantName defaults to the renter account's name.
     */
    @PostMapping("/leases")
    public LeaseContract create(
            @RequestParam int unitId,
            @RequestParam String renterUsername,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam BigDecimal monthlyRent,
            @RequestParam(defaultValue = "MONTHLY_ADVANCE") PaymentTerms paymentTerms,
            @RequestParam(required = false) String tenantName,
            @RequestParam(required = false) String tenantEmail,
            @RequestParam(required = false) String tenantPhone,
            HttpSession session) {
        User landlord = sessionManager.requireRole(session, Role.LANDLORD);
        return leaseService.createLease(landlord, unitId, renterUsername, startDate, endDate, monthlyRent,
                paymentTerms, tenantName, tenantEmail, tenantPhone);
    }

    /** paymentTerms is optional: leave it out to keep the old lease's terms. */
    @PostMapping("/leases/{id}/renew")
    public LeaseContract renew(
            @PathVariable int id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate newStartDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate newEndDate,
            @RequestParam BigDecimal newMonthlyRent,
            @RequestParam(required = false) PaymentTerms paymentTerms,
            HttpSession session) {
        User landlord = sessionManager.requireRole(session, Role.LANDLORD);
        return leaseService.renewLease(id, landlord, newStartDate, newEndDate, newMonthlyRent, paymentTerms);
    }

    /** Normal end, from the end date on (409 before that: terminate instead). */
    @PostMapping("/leases/{id}/end")
    public void end(@PathVariable int id, HttpSession session) {
        User landlord = sessionManager.requireRole(session, Role.LANDLORD);
        leaseService.endLease(id, landlord);
    }

    @PostMapping("/leases/{id}/terminate")
    public void terminate(@PathVariable int id, HttpSession session) {
        User landlord = sessionManager.requireRole(session, Role.LANDLORD);
        leaseService.terminateLease(id, landlord);
    }
}
