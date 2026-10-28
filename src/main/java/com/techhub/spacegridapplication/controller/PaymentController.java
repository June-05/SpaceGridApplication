package com.techhub.spacegridapplication.controller;

import com.techhub.spacegridapplication.model.Payment;
import com.techhub.spacegridapplication.model.PaymentMethod;
import com.techhub.spacegridapplication.model.RentDue;
import com.techhub.spacegridapplication.model.Role;
import com.techhub.spacegridapplication.model.User;
import com.techhub.spacegridapplication.security.SessionManager;
import com.techhub.spacegridapplication.service.PaymentService;
import jakarta.servlet.http.HttpSession;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

/**
 * Rent statement, payment history and paying rent (lease.html, renter/pay.html).
 * Every method gets the logged-in user from SessionManager (never from the browser).
 */
@RestController
@RequestMapping("/api/leases/{leaseId}")
public class PaymentController {

    private final PaymentService paymentService;
    private final SessionManager sessionManager;

    public PaymentController(PaymentService paymentService, SessionManager sessionManager) {
        this.paymentService = paymentService;
        this.sessionManager = sessionManager;
    }

    @GetMapping("/statement")
    public List<RentDue> statement(@PathVariable int leaseId, HttpSession session) {
        User user = sessionManager.currentUser(session);
        return paymentService.getStatement(leaseId, user, LocalDate.now());
    }

    @GetMapping("/payments")
    public List<Payment> history(@PathVariable int leaseId, HttpSession session) {
        User user = sessionManager.currentUser(session);
        return paymentService.getPaymentHistory(leaseId, user);
    }

    /** Renter only. Form fields: billingMonth (yyyy-MM: the first month of the period, e.g. 2026-11), method (GCASH | MAYA | CARD), accountNumber. */
    @PostMapping("/payments")
    public Payment pay(
            @PathVariable int leaseId,
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM") YearMonth billingMonth,
            @RequestParam PaymentMethod method,
            @RequestParam String accountNumber,
            HttpSession session) {
        User renter = sessionManager.requireRole(session, Role.RENTER);
        return paymentService.payRent(renter, leaseId, billingMonth, method, accountNumber);
    }
}
