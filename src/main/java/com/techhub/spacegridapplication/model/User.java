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
    private String email;               // optional (null = not given)
    private String phone;               // optional
    private Role role;

    public static final int EMAIL_MAX_LENGTH = 100;
    public static final int PHONE_MAX_LENGTH = 30;

    /** New account (not saved yet). email and phone are optional (blank = not given). */
    public User(String username, String passwordHash, String fullName, String email, String phone, Role role) {
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
        this.email = cleanEmail(email);
        this.phone = cleanPhone(phone);
        this.role = role;
    }

    /** From database. */
    public User(
            int id,
            LocalDateTime createdAt,
            String username,
            String passwordHash,
            String fullName,
            String email,
            String phone,
            Role role) {
        super(id, createdAt);
        this.username = username;
        this.passwordHash = passwordHash;
        this.fullName = fullName;
        this.email = email;
        this.phone = phone;
        this.role = role;
    }

    public String getUsername() { return username; }
    @JsonIgnore
    public String getPasswordHash() { return passwordHash; }
    public String getFullName() { return fullName; }
    public String getEmail() { return email; }
    public String getPhone() { return phone; }
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

    /** True when both email and phone are given (a renter needs this before requesting a lease). */
    @JsonIgnore
    public boolean hasContact() {
        return email != null && phone != null;
    }

    /** Replaces both; blank = remove. Invalid text -> ValidationException (nothing is changed). */
    public void updateContact(String email, String phone) {
        String cleanEmail = cleanEmail(email);
        String cleanPhone = cleanPhone(phone);
        this.email = cleanEmail;
        this.phone = cleanPhone;
    }

    /** Blank -> null; otherwise something@domain.tld, at most 100 characters. */
    public static String cleanEmail(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String email = value.trim();
        if (email.length() > EMAIL_MAX_LENGTH || !email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) {
            throw new ValidationException("Enter a valid email address, like name@example.com.");
        }
        return email;
    }

    /** Blank -> null; otherwise at least 10 digits/spaces/dashes/brackets with an optional leading +, at most 30 characters. */
    public static String cleanPhone(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String phone = value.trim();
        if (phone.length() > PHONE_MAX_LENGTH || !phone.matches("[+]?[\\d\\s\\-()]{10,}")) {
            throw new ValidationException("Enter a valid phone number, like +63 917 555 0101.");
        }
        return phone;
    }

    public void updateFullName(String fullName) {
        if (fullName == null || fullName.isBlank()) {
            throw new ValidationException("Full name is required.");
        }
        this.fullName = fullName.trim();
    }
}
