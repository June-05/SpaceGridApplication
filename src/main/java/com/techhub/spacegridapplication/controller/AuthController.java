package com.techhub.spacegridapplication.controller;

import com.techhub.spacegridapplication.model.Role;
import com.techhub.spacegridapplication.model.User;
import com.techhub.spacegridapplication.security.SessionManager;
import com.techhub.spacegridapplication.service.AuthService;

import jakarta.servlet.http.HttpSession;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Login, registration, logout and "who am I". Used by login.html, register.html and auth.js.
 * Every method gets the logged-in user from SessionManager (never from the browser).
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final SessionManager sessionManager;

    public AuthController(AuthService authService, SessionManager sessionManager) {
        this.authService = authService;
        this.sessionManager = sessionManager;
    }

    /** Form fields: username, password, fullName, role (LANDLORD or RENTER); email and phone are optional. */
    @PostMapping("/register")
    public User register(
            @RequestParam String username,
            @RequestParam String password,
            @RequestParam String fullName,
            @RequestParam Role role,
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String phone) {
        return authService.register(username, password, fullName, email, phone, role);   // not logged in yet: register.js logs in next
    }

    /** Form fields: username, password. On success, store the user in the session. */
    @PostMapping("/login")
    public User login(@RequestParam String username, @RequestParam String password, HttpSession session) {
        User user = authService.login(username, password);
        sessionManager.login(session, user);
        return user;
    }

    @PostMapping("/logout")
    public void logout(HttpSession session) {
        sessionManager.logout(session);
    }

    /** Form fields email, phone (blank removes one). A renter needs both before sending a lease request. */
    @PutMapping("/me/contact")
    public User updateContact(
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String phone,
            HttpSession session) {
        return authService.updateContact(sessionManager.currentUser(session), email, phone);
    }

    /** The logged-in user (401 if nobody). auth.js calls this on every protected page. */
    @GetMapping("/me")
    public User me(HttpSession session) {
        return sessionManager.currentUser(session);
    }
}
