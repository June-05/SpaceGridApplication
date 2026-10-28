package com.techhub.spacegridapplication;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

/** Checks that the whole application starts. Write/enable after all controllers, services and DAOs exist. */
@SpringBootTest
@Disabled("Enable after the services and DAOs are implemented (XAMPP must be running)")
class SpaceGridApplicationTests {

    @Test
    void contextLoads() {
        // Passes if Spring starts without errors (missing annotations, bad properties, URL conflicts...)
    }
}
