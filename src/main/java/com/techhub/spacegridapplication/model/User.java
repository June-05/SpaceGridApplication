package com.techhub.spacegridapplication.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.techhub.spacegridapplication.exception.ValidationException;

import java.time.LocalDateTime;

/** An account: a landlord or a renter. */
public class User extends BaseEntity {

    private String username;
    @JsonIgnore
    private String passwordHash;        // never sent to the browser
    private String fullName;
    private Role role;

    /** New account (not saved yet). */
    public User(String username, String passwordHash, String fullName, Role role) {
        if (username == null || username.isBlank()) {
            throw new ValidationException("Username is required.");
        }
        if (passwordHash == null || passwordHash.isBlank()) {
            throw new ValidationException("Password is required.");
        }
        if (fullName == null || fullName.isBlank()) {
            throw new ValidationException("Full name is required.");
        }
        if (role == null) {
            throw new ValidationException("Role is required.");
        }
        this.username = username.trim();
        this.passwordHash = passwordHash;
        this.fullName = fullName.trim();
        this.role = role;
    }

    /** From database. */
    public User(
            int id,
            LocalDateTime createdAt,
            String username,
            String passwordHash,
            String fullName,
            Role role) {
        super(id, createdAt);
        this.username = username;
        this.passwordHash = passwordHash;
        this.fullName = fullName;
        this.role = role;
    }

    public String getUsername() { return username; }
    @JsonIgnore
    public String getPasswordHash() { return passwordHash; }
    public String getFullName() { return fullName; }
    public Role getRole() { return role; }

    @JsonIgnore
    public boolean isLandlord() {
        return role == Role.LANDLORD;
    }

    @JsonIgnore
    public boolean isRenter() {
        return role == Role.RENTER;
    }

    public void changePassword(String newHash) {
        if (newHash == null || newHash.isBlank()) {
            throw new ValidationException("Password is required.");
        }
        this.passwordHash = newHash;
    }

    public void updateFullName(String fullName) {
        if (fullName == null || fullName.isBlank()) {
            throw new ValidationException("Full name is required.");
        }
        this.fullName = fullName.trim();
    }
}
