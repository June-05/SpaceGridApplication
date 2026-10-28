package com.techhub.spacegridapplication.controller;

import com.techhub.spacegridapplication.model.LeaseRequest;
import com.techhub.spacegridapplication.model.Role;
import com.techhub.spacegridapplication.model.User;
import com.techhub.spacegridapplication.security.SessionManager;
import com.techhub.spacegridapplication.service.LeaseRequestService;

import jakarta.servlet.http.HttpSession;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/**
 * Lease requests (requests.html and the homepage's request form).
 * Every method gets the logged-in user from SessionManager (never from the browser).
 */
@RestController
@RequestMapping("/api/lease-requests")
public class LeaseRequestController {

    private final LeaseRequestService leaseRequestService;
    private final SessionManager sessionManager;

    public LeaseRequestController(LeaseRequestService leaseRequestService, SessionManager sessionManager) {
        this.leaseRequestService = leaseRequestService;
        this.sessionManager = sessionManager;
    }

    /** A renter's own requests, or a landlord's incoming requests, depending on who is logged in. */
    @GetMapping
    public List<LeaseRequest> list(HttpSession session) {
        User user = sessionManager.currentUser(session);
        return leaseRequestService.getRequestsFor(user);
    }

    /** Form fields. RENTER only. startDate is yyyy-MM-dd, message is optional. */
    @PostMapping
    public LeaseRequest create(
            @RequestParam int unitId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam int months,
            @RequestParam(required = false) String message,
            HttpSession session) {
        User renter = sessionManager.requireRole(session, Role.RENTER);
        return leaseRequestService.createRequest(renter, unitId, startDate, months, message);
    }

    @PostMapping("/{id}/approve")
    public LeaseRequest approve(@PathVariable int id, HttpSession session) {
        User landlord = sessionManager.requireRole(session, Role.LANDLORD);
        return leaseRequestService.approve(id, landlord);
    }

    @PostMapping("/{id}/decline")
    public LeaseRequest decline(@PathVariable int id, HttpSession session) {
        User landlord = sessionManager.requireRole(session, Role.LANDLORD);
        return leaseRequestService.decline(id, landlord);
    }

    @PostMapping("/{id}/cancel")
    public LeaseRequest cancel(@PathVariable int id, HttpSession session) {
        User renter = sessionManager.requireRole(session, Role.RENTER);
        return leaseRequestService.cancel(id, renter);
    }
}
