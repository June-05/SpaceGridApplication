package com.techhub.spacegridapplication.exception;

/** The id doesn't exist. HTTP 404. */
public class NotFoundException extends SpaceGridException {

    public NotFoundException(String message) {
        super(message);
    }

    @Override
    public int getHttpStatus() {
        return 404;
    }
}
