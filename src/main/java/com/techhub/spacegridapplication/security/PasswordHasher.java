package com.techhub.spacegridapplication.security;

/** Hashes and checks passwords. Services depend on this interface, not on BCrypt directly. */
public interface PasswordHasher {

    String hash(String rawPassword);

    boolean matches(String rawPassword, String hash);
}
