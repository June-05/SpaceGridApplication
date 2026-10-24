package com.techhub.spacegridapplication.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.techhub.spacegridapplication.exception.ValidationException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.List;

/**
 * A renter's lease on a unit. The terms are final and can't be edited:
 * to change them, end/terminate and create a new lease, or renew (LeaseService.renewLease).
 */
public class LeaseContract extends BaseEntity {

    public static final int EXPIRING_SOON_DAYS = 30;

    private final int unitId;
    private final int renterId;
    private final LocalDate startDate;
    private final LocalDate endDate;
    private final BigDecimal monthlyRent;
    private final Integer previousLeaseId;      // set when this lease is a renewal
    private LeaseStatus status;
    private LocalDate closedOn;                 // date it actually ended / was terminated / renewed

    // read-only display fields: filled by JdbcLeaseContractDao from the lease_details view, never saved
    private String unitName;
    private String propertyName;
    private String renterName;

    /** New lease: starts as ACTIVE. */
    public LeaseContract(int unitId, int renterId, LocalDate startDate, LocalDate endDate,
                         BigDecimal monthlyRent, Integer previousLeaseId) {
        if (startDate == null || endDate == null) {
            throw new ValidationException("Start and end dates are required.");
        }
        if (!endDate.isAfter(startDate)) {
            throw new ValidationException("The end date must be after the start date.");
        }
        if (monthlyRent == null || monthlyRent.signum() < 0) {
            throw new ValidationException("Monthly rent can't be negative.");
        }
        this.unitId = unitId;
        this.renterId = renterId;
        this.startDate = startDate;
        this.endDate = endDate;
        this.monthlyRent = monthlyRent;
        this.previousLeaseId = previousLeaseId;
        this.status = LeaseStatus.ACTIVE;
    }

    /** From database (lease_details view). */
    public LeaseContract(int id, LocalDateTime createdAt, int unitId, int renterId, LocalDate startDate,
                         LocalDate endDate, BigDecimal monthlyRent, Integer previousLeaseId, LeaseStatus status,
                         LocalDate closedOn, String unitName, String propertyName, String renterName) {
        super(id, createdAt);
        this.unitId = unitId;
        this.renterId = renterId;
        this.startDate = startDate;
        this.endDate = endDate;
        this.monthlyRent = monthlyRent;
        this.previousLeaseId = previousLeaseId;
        this.status = status;
        this.closedOn = closedOn;
        this.unitName = unitName;
        this.propertyName = propertyName;
        this.renterName = renterName;
    }

    public int getUnitId() { return unitId; }
    public int getRenterId() { return renterId; }
    public LocalDate getStartDate() { return startDate; }
    public LocalDate getEndDate() { return endDate; }
    public BigDecimal getMonthlyRent() { return monthlyRent; }
    public Integer getPreviousLeaseId() { return previousLeaseId; }
    public LeaseStatus getStatus() { return status; }
    public LocalDate getClosedOn() { return closedOn; }
    public String getUnitName() { return unitName; }
    public String getPropertyName() { return propertyName; }
    public String getRenterName() { return renterName; }

    /** UPCOMING, ACTIVE, EXPIRING_SOON, EXPIRED, ENDED, TERMINATED or RENEWED for the given day. */
    public LeaseState getCurrentState(LocalDate today) {
        // TODO: see the LeaseState rules in the Phase 1 spec
        throw new UnsupportedOperationException("TODO");
    }

    /** Today's state, so the lease screens get "currentState" in the JSON. */
    public LeaseState getCurrentState() {
        // TODO: return getCurrentState(LocalDate.now())
        throw new UnsupportedOperationException("TODO");
    }

    public long daysRemaining(LocalDate today) {
        // TODO: days until endDate, 0 once it's over
        throw new UnsupportedOperationException("TODO");
    }

    /** Today's days remaining, so the lease screens get "daysRemaining" in the JSON. */
    public long getDaysRemaining() {
        // TODO: return daysRemaining(LocalDate.now())
        throw new UnsupportedOperationException("TODO");
    }

    public long durationInMonths() {
        // TODO
        throw new UnsupportedOperationException("TODO");
    }

    public boolean isRentedBy(int renterId) {
        // TODO
        throw new UnsupportedOperationException("TODO");
    }

    @JsonIgnore
    public boolean isRenewal() {
        // TODO: previousLeaseId != null
        throw new UnsupportedOperationException("TODO");
    }

    /** Start month through the last month in effect (closedOn, or endDate). */
    public List<YearMonth> billingMonths() {
        // TODO
        throw new UnsupportedOperationException("TODO");
    }

    /** Same day of the month as startDate (or the last day of shorter months). */
    public LocalDate dueDateFor(YearMonth month) {
        // TODO
        throw new UnsupportedOperationException("TODO");
    }

    /** Normal end: ACTIVE -> ENDED. */
    public void end(LocalDate today) {
        // TODO: only when ACTIVE; status = ENDED; closedOn = today
    }

    /** Early end: ACTIVE -> TERMINATED. */
    public void terminate(LocalDate today) {
        // TODO: only when ACTIVE; status = TERMINATED; closedOn = today
    }

    /** Used by LeaseService.renewLease: ACTIVE -> RENEWED, closedOn = the day before the new lease starts. */
    public void markRenewed(LocalDate lastDay) {
        // TODO
    }
}
