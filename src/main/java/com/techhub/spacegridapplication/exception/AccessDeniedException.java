package com.techhub.spacegridapplication.exception;

/** Logged in, but not allowed (e.g. not your property, wrong role). HTTP 403. */
public class AccessDeniedException extends SpaceGridException {

    public AccessDeniedException(String message) {
        super(message);
    }

    @Override
    public int getHttpStatus() {
        return 403;
    }
}
