package com.techhub.spacegridapplication.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.LocalDate;

/**
 * Ends leases automatically after their end date (LeaseService.expireLeases).
 * Runs once when the app starts (it isn't always running at midnight) and every day at 00:05.
 * Needs @EnableScheduling on SpaceGridApplication.
 */
@Component
public class LeaseExpiryJob {

    private static final Logger log = LoggerFactory.getLogger(LeaseExpiryJob.class);

    private final LeaseService leaseService;

    public LeaseExpiryJob(LeaseService leaseService) {
        this.leaseService = leaseService;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        run();
    }

    @Scheduled(cron = "0 5 0 * * *")
    public void daily() {
        run();
    }

    private void run() {
        int ended = leaseService.expireLeases(LocalDate.now());
        if (ended > 0) {
            log.info("Ended {} expired lease(s) automatically.", ended);
        }
    }
}
