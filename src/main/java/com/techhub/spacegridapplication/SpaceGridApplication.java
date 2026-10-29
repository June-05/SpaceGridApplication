package com.techhub.spacegridapplication;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Starts SpaceGrid. Must stay in the root package so Spring finds every class in the sub-packages.
 * Then open http://localhost:8080/ in a browser (XAMPP MySQL must be running).
 * @EnableScheduling: lets LeaseExpiryJob run every day.
 */
@SpringBootApplication
@EnableScheduling
public class SpaceGridApplication {

    public static void main(String[] args) {
        SpringApplication.run(SpaceGridApplication.class, args);
    }
}
