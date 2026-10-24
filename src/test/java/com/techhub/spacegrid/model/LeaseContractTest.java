package com.techhub.spacegridapplication.model;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

/** Lease states, dates and billing of LeaseContract. No database needed: create the objects in memory and check their behavior. */
@Disabled("Write these tests after the model classes are implemented")
class LeaseContractTest {

    @Test
    void state_beforeStart_isUpcoming() {
        // TODO: starts Dec 1, today Nov 20 → UPCOMING
    }

    @Test
    void state_25DaysLeft_isExpiringSoon() {
        // TODO: within 30 days of the end → EXPIRING_SOON
    }

    @Test
    void state_pastEndStillActive_isExpired() {
        // TODO: end date passed, still ACTIVE → EXPIRED
    }

    @Test
    void endDateBeforeStart_isRejected() {
        // TODO: constructor throws ValidationException
    }

    @Test
    void billingMonths_coversWholeLease() {
        // TODO: Jun 2026 – May 2027 → 12 months
    }

    @Test
    void dueDate_on31st_movesToLastDayOfShortMonths() {
        // TODO: lease starting Jan 31 is due Feb 28
    }

    @Test
    void renewed_billingStopsAtClosedOn() {
        // TODO: billing stops at the closedOn month
    }

    @Test
    void end_onlyWorksWhenActive() {
        // TODO: ending an ENDED lease throws
    }
}
