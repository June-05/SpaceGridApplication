package com.techhub.spacegridapplication.service;

import com.techhub.spacegridapplication.dao.UserDao;
import com.techhub.spacegridapplication.exception.ValidationException;
import com.techhub.spacegridapplication.model.Role;
import com.techhub.spacegridapplication.model.User;
import com.techhub.spacegridapplication.security.PasswordHasher;

import org.springframework.stereotype.Service;

/** Register and log in. */
@Service
public class AuthService {

    private final UserDao userDao;
    private final PasswordHasher passwordHasher;

    public AuthService(UserDao userDao, PasswordHasher passwordHasher) {
        this.userDao = userDao;
        this.passwordHasher = passwordHasher;
    }

    /** Username taken -> ConflictException; password shorter than 8 characters -> ValidationException. */
    public User register(String username, String rawPassword, String fullName, Role role) {
        // TODO
        throw new UnsupportedOperationException("TODO");
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
