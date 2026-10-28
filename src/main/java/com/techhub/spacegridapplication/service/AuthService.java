package com.techhub.spacegridapplication.service;

import com.techhub.spacegridapplication.dao.UserDao;
import com.techhub.spacegridapplication.exception.ConflictException;
import com.techhub.spacegridapplication.exception.ValidationException;
import com.techhub.spacegridapplication.model.Role;
import com.techhub.spacegridapplication.model.User;
import com.techhub.spacegridapplication.security.PasswordHasher;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Register and log in. */
@Service
public class AuthService {

    private final UserDao userDao;
    private final PasswordHasher passwordHasher;

    public AuthService(UserDao userDao, PasswordHasher passwordHasher) {
        this.userDao = userDao;
        this.passwordHasher = passwordHasher;
    }

    public static final int MIN_PASSWORD_LENGTH = 8;

    /**
     * Username taken -> ConflictException; password shorter than 8 characters -> ValidationException.
     * Usernames are 3-50 letters, digits, dots, dashes or underscores (e.g. maria.santos).
     */
    @Transactional
    public User register(String username, String rawPassword, String fullName, Role role) {
        String name = (username == null) ? "" : username.trim();
        if (!name.matches("[A-Za-z0-9._-]{3,50}")) {
            throw new ValidationException("Username must be 3 to 50 letters, numbers, dots, dashes or underscores.");
        }
        if (rawPassword == null || rawPassword.length() < MIN_PASSWORD_LENGTH) {
            throw new ValidationException("Password must be at least " + MIN_PASSWORD_LENGTH + " characters.");
        }
        if (userDao.existsByUsername(name)) {
            throw new ConflictException("Username is already taken.");
        }
        User user = new User(name, passwordHasher.hash(rawPassword), fullName, role);   // checks full name and role
        return userDao.save(user);
    }

    /** Wrong username or password -> one generic ValidationException message. */
    public User login(String username, String rawPassword) {
        User user = (username == null) ? null : userDao.findByUsername(username.trim()).orElse(null);
        if (user == null || rawPassword == null || !passwordHasher.matches(rawPassword, user.getPasswordHash())) {
            throw new ValidationException("Invalid username or password.");   // same message either way
        }
        return user;
    }
}
