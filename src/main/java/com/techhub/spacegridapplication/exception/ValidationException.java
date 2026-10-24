package com.techhub.spacegridapplication.exception;

/** Bad input, e.g. a blank name or a negative rent. HTTP 400. */
public class ValidationException extends SpaceGridException {

    public ValidationException(String message) {
        super(message);
    }

    @Override
    public int getHttpStatus() {
        return 400;
    }
}
