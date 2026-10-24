package com.techhub.spacegridapplication.security;

import com.techhub.spacegridapplication.dao.UserDao;
import com.techhub.spacegridapplication.exception.AccessDeniedException;
import com.techhub.spacegridapplication.exception.UnauthenticatedException;
import com.techhub.spacegridapplication.model.Role;
import com.techhub.spacegridapplication.model.User;

import jakarta.servlet.http.HttpSession;

import org.springframework.stereotype.Component;

/**
 * Remembers who is logged in. Only the user's id is stored in the HttpSession;
 * the browser keeps the session cookie automatically, so pages never send a user id themselves.
 */
@Component
public class SessionManager {

    private static final String SESSION_KEY = "userId";

    private final UserDao userDao;

    public SessionManager(UserDao userDao) {
        this.userDao = userDao;
    }

    public void login(HttpSession session, User user) {
        session.setAttribute(SESSION_KEY, user.getId());
    }

    public void logout(HttpSession session) {
        session.invalidate();
    }

    /** The logged-in user, or UnauthenticatedException (401) if nobody is logged in. */
    public User currentUser(HttpSession session) {
        Object value = session.getAttribute(SESSION_KEY);
        if (!(value instanceof Integer userId)) {
            throw new UnauthenticatedException("Please log in first.");
        }
        return userDao.findById(userId).orElseThrow(() -> {
            session.invalidate();                        // the account no longer exists
            return new UnauthenticatedException("Please log in again.");
        });
    }

    /** The logged-in user if they have this role, otherwise AccessDeniedException (403). */
    public User requireRole(HttpSession session, Role role) {
        User user = currentUser(session);
        if (user.getRole() != role) {
            throw new AccessDeniedException("This page is only for " + role.getLabel().toLowerCase() + "s.");
        }
        return user;
    }
}
