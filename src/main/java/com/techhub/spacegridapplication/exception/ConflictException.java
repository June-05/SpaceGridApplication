package com.techhub.spacegridapplication.exception;

/** The action breaks a rule, e.g. username taken, unit already leased. HTTP 409. */
public class ConflictException extends SpaceGridException {

    public ConflictException(String message) {
        super(message);
    }

    @Override
    public int getHttpStatus() {
        return 409;
    }
}
