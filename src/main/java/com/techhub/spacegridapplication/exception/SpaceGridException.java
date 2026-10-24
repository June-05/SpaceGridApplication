package com.techhub.spacegridapplication.exception;

/** Parent of all SpaceGrid errors. Each subclass maps to one HTTP status code. */
public abstract class SpaceGridException extends RuntimeException {

    protected SpaceGridException(String message) {
        super(message);
    }

    /** HTTP status sent to the browser by GlobalExceptionHandler. */
    public abstract int getHttpStatus();
}
