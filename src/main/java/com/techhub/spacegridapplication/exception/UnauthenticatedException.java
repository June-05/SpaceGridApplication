package com.techhub.spacegridapplication.exception;

/** Nobody is logged in. The page should redirect to login.html. HTTP 401. */
public class UnauthenticatedException extends SpaceGridException {

    public UnauthenticatedException(String message) {
        super(message);
    }

    @Override
    public int getHttpStatus() {
        return 401;
    }
}
