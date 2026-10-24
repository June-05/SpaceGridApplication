package com.techhub.spacegridapplication;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Starts SpaceGrid. Must stay in the root package so Spring finds every class in the sub-packages.
 * Then open http://localhost:8080/ in a browser (XAMPP MySQL must be running).
 */
@SpringBootApplication
public class SpaceGridApplication {

    public static void main(String[] args) {
        SpringApplication.run(SpaceGridApplication.class, args);
    }
}
