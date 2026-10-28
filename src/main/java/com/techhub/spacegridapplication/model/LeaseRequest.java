package com.techhub.spacegridapplication.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.techhub.spacegridapplication.exception.ConflictException;
import com.techhub.spacegridapplication.exception.ValidationException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * A renter's request to lease an AVAILABLE unit found on the homepage.
 * The landlord approves or declines it; only a PENDING request can change.
 * Approving does not create the lease: the landlord does that with the normal lease form.
 */
public class LeaseRequest extends BaseEntity {

    public static final int MAX_MONTHS = 60;
    public static final int MAX_MESSAGE_LENGTH = 500;

    private final int unitId;
    private final int renterId;
    private final LocalDate desiredStart;
    private final int months;
    private final String message;               // optional, null when empty
    private RequestStatus status;
    private LocalDateTime decidedAt;             // set when approved / declined / cancelled

    // read-only display fields: filled by JdbcLeaseRequestDao from the lease_request_details view, never saved
    private int propertyId;
    private int landlordId;
    private String unitName;
    private String propertyName;
    private String renterName;
    private BigDecimal monthlyRate;

    /** New request: starts as PENDING. */
    public LeaseRequest(int unitId, int renterId, LocalDate desiredStart, int months, String message) {
        if (desiredStart == null) {
            throw new ValidationException("Choose when you want to start.");
        }
        if (desiredStart.isBefore(LocalDate.now())) {
            throw new ValidationException("The start date can't be in the past.");
        }
        if (months < 1 || months > MAX_MONTHS) {
            throw new ValidationException("The lease length must be between 1 and " + MAX_MONTHS + " months.");
        }
        String trimmed = (message == null || message.isBlank()) ? null : message.trim();
        if (trimmed != null && trimmed.length() > MAX_MESSAGE_LENGTH) {
            throw new ValidationException("The message can be at most " + MAX_MESSAGE_LENGTH + " characters.");
        }
        this.unitId = unitId;
        this.renterId = renterId;
        this.desiredStart = desiredStart;
        this.months = months;
        this.message = trimmed;
        this.status = RequestStatus.PENDING;
    }

    /** From database (lease_request_details view). */
    public LeaseRequest(int id, LocalDateTime createdAt, int unitId, int renterId, LocalDate desiredStart,
                        int months, String message, RequestStatus status, LocalDateTime decidedAt,
                        int propertyId, int landlordId, String unitName, String propertyName,
                        String renterName, BigDecimal monthlyRate) {
        super(id, createdAt);
        this.unitId = unitId;
        this.renterId = renterId;
        this.desiredStart = desiredStart;
        this.months = months;
        this.message = message;
        this.status = status;
        this.decidedAt = decidedAt;
        this.propertyId = propertyId;
        this.landlordId = landlordId;
        this.unitName = unitName;
        this.propertyName = propertyName;
        this.renterName = renterName;
        this.monthlyRate = monthlyRate;
    }

    public int getUnitId() { return unitId; }
    public int getRenterId() { return renterId; }
    public LocalDate getDesiredStart() { return desiredStart; }
    public int getMonths() { return months; }
    public String getMessage() { return message; }
    public RequestStatus getStatus() { return status; }
    public LocalDateTime getDecidedAt() { return decidedAt; }
    public int getPropertyId() { return propertyId; }
    public int getLandlordId() { return landlordId; }
    public String getUnitName() { return unitName; }
    public String getPropertyName() { return propertyName; }
    public String getRenterName() { return renterName; }
    public BigDecimal getMonthlyRate() { return monthlyRate; }

    /** Last day of the lease the renter asked for: start 2026-11-15 for 12 months → 2027-11-14. */
    public LocalDate getSuggestedEndDate() {
        return desiredStart.plusMonths(months).minusDays(1);
    }

    @JsonIgnore
    public boolean isFromRenter(int userId) {
        return renterId == userId;
    }

    @JsonIgnore
    public boolean isForLandlord(int userId) {
        return landlordId == userId;
    }

    /** Landlord accepts the request. The unit stays AVAILABLE until the lease is created. */
    public void approve() {
        decide(RequestStatus.APPROVED);
    }

    public void decline() {
        decide(RequestStatus.DECLINED);
    }

    /** The renter withdraws the request. */
    public void cancel() {
        decide(RequestStatus.CANCELLED);
    }

    private void decide(RequestStatus newStatus) {
        if (status != RequestStatus.PENDING) {
            throw new ConflictException("This request was already " + status.getLabel().toLowerCase() + ".");
        }
        this.status = newStatus;
        this.decidedAt = LocalDateTime.now();
    }
}
