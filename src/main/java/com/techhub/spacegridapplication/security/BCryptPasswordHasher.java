package com.techhub.spacegridapplication.security;

import org.mindrot.jbcrypt.BCrypt;
import org.springframework.stereotype.Component;

/** PasswordHasher using jBCrypt (org.mindrot.jbcrypt.BCrypt). */
@Component
public class BCryptPasswordHasher implements PasswordHasher {

    @Override
    public String hash(String rawPassword) {
        return BCrypt.hashpw(rawPassword, BCrypt.gensalt());
    }

    @Override
    public boolean matches(String rawPassword, String hash) {
        try {
            return BCrypt.checkpw(rawPassword, hash);
        } catch (IllegalArgumentException badHash) {     // not a BCrypt hash
            return false;
        }
    }
}
