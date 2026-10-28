package com.techhub.spacegridapplication.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.techhub.spacegridapplication.exception.ConflictException;
import com.techhub.spacegridapplication.exception.ValidationException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * A renter's lease on a unit. The terms are final and can't be edited:
 * to change them, end/terminate and create a new lease, or renew (LeaseService.renewLease).
 *
 * Billing: the lease is split into billing PERIODS by its PaymentTerms (1, 3, 6 or 12 months).
 * Each period is named after its first month ("period start") and costs monthlyRent x its months.
 */
public class LeaseContract extends BaseEntity {

    public static final int EXPIRING_SOON_DAYS = 30;

    private final int unitId;
    private final int renterId;
    private final LocalDate startDate;
    private final LocalDate endDate;
    private final BigDecimal monthlyRent;
    private final PaymentTerms paymentTerms;
    private final Integer previousLeaseId;      // set when this lease is a renewal
    private final String tenantName;            // contact details typed in the lease form
    private final String tenantEmail;
    private final String tenantPhone;
    private LeaseStatus status;
    private LocalDate closedOn;                 // date it actually ended / was terminated / renewed

    // read-only display fields: filled by JdbcLeaseContractDao from the lease_details view, never saved
    private String unitName;
    private String propertyName;
    private Integer propertyId;
    private String renterName;
    private String renterUsername;
    private Integer unitPhotoId;                // the unit's first photo, or null

    /** New lease: starts as ACTIVE. tenantName is required; email and phone are optional. */
    public LeaseContract(int unitId, int renterId, LocalDate startDate, LocalDate endDate, BigDecimal monthlyRent,
                         PaymentTerms paymentTerms, String tenantName, String tenantEmail, String tenantPhone,
                         Integer previousLeaseId) {
        if (startDate == null || endDate == null) {
            throw new ValidationException("Start and end dates are required.");
        }
        if (!endDate.isAfter(startDate)) {
            throw new ValidationException("The end date must be after the start date.");
        }
        if (monthlyRent == null || monthlyRent.signum() < 0) {
            throw new ValidationException("Monthly rent can't be negative.");
        }
        if (tenantName == null || tenantName.isBlank()) {
            throw new ValidationException("The tenant's full name is required.");
        }
        this.unitId = unitId;
        this.renterId = renterId;
        this.startDate = startDate;
        this.endDate = endDate;
        this.monthlyRent = monthlyRent;
        this.paymentTerms = (paymentTerms != null) ? paymentTerms : PaymentTerms.MONTHLY_ADVANCE;
        this.tenantName = tenantName.trim();
        this.tenantEmail = blankToNull(tenantEmail);
        this.tenantPhone = blankToNull(tenantPhone);
        this.previousLeaseId = previousLeaseId;
        this.status = LeaseStatus.ACTIVE;
    }

    /** From database (lease_details view). */
    public LeaseContract(int id, LocalDateTime createdAt, int unitId, int renterId, LocalDate startDate,
                         LocalDate endDate, BigDecimal monthlyRent, PaymentTerms paymentTerms, String tenantName,
                         String tenantEmail, String tenantPhone, Integer previousLeaseId, LeaseStatus status,
                         LocalDate closedOn, String unitName, String propertyName, Integer propertyId,
                         String renterName, String renterUsername, Integer unitPhotoId) {
        super(id, createdAt);
        this.unitId = unitId;
        this.renterId = renterId;
        this.startDate = startDate;
        this.endDate = endDate;
        this.monthlyRent = monthlyRent;
        this.paymentTerms = paymentTerms;
        this.tenantName = tenantName;
        this.tenantEmail = tenantEmail;
        this.tenantPhone = tenantPhone;
        this.previousLeaseId = previousLeaseId;
        this.status = status;
        this.closedOn = closedOn;
        this.unitName = unitName;
        this.propertyName = propertyName;
        this.propertyId = propertyId;
        this.renterName = renterName;
        this.renterUsername = renterUsername;
        this.unitPhotoId = unitPhotoId;
    }

    public int getUnitId() { return unitId; }
    public int getRenterId() { return renterId; }
    public LocalDate getStartDate() { return startDate; }
    public LocalDate getEndDate() { return endDate; }
    public BigDecimal getMonthlyRent() { return monthlyRent; }
    public PaymentTerms getPaymentTerms() { return paymentTerms; }
    public String getTenantName() { return tenantName; }
    public String getTenantEmail() { return tenantEmail; }
    public String getTenantPhone() { return tenantPhone; }
    public Integer getPreviousLeaseId() { return previousLeaseId; }
    public LeaseStatus getStatus() { return status; }
    public LocalDate getClosedOn() { return closedOn; }
    public String getUnitName() { return unitName; }
    public String getPropertyName() { return propertyName; }
    public Integer getPropertyId() { return propertyId; }
    public String getRenterName() { return renterName; }
    public String getRenterUsername() { return renterUsername; }

    /** The unit's first photo ("/api/files/7"), or null; the renter dashboard shows it on the lease card. */
    public String getImageUrl() { return StoredFile.urlOf(unitPhotoId); }

    /** UPCOMING, ACTIVE, EXPIRING_SOON, EXPIRED, ENDED, TERMINATED or RENEWED for the given day. */
    public LeaseState getCurrentState(LocalDate today) {
        switch (status) {
            case ENDED: return LeaseState.ENDED;
            case TERMINATED: return LeaseState.TERMINATED;
            case RENEWED: return LeaseState.RENEWED;
            default: break;                               // ACTIVE: the dates decide
        }
        if (startDate.isAfter(today)) {
            return LeaseState.UPCOMING;
        }
        if (endDate.isBefore(today)) {
            return LeaseState.EXPIRED;                    // still ACTIVE: the landlord should end or renew it
        }
        return daysRemaining(today) <= EXPIRING_SOON_DAYS ? LeaseState.EXPIRING_SOON : LeaseState.ACTIVE;
    }

    /** Today's state, so the lease screens get "currentState" in the JSON. */
    public LeaseState getCurrentState() {
        return getCurrentState(LocalDate.now());
    }

    /** Days from today until the end date (the end date itself counts as 0), never below 0. */
    public long daysRemaining(LocalDate today) {
        return Math.max(0, ChronoUnit.DAYS.between(today, endDate));
    }

    /** Today's days remaining, so the lease screens get "daysRemaining" in the JSON. */
    public long getDaysRemaining() {
        return daysRemaining(LocalDate.now());
    }

    /** Number of billing months (start month through end month), e.g. 2026-06-01 to 2027-05-31 = 12. */
    public long durationInMonths() {
        return ChronoUnit.MONTHS.between(YearMonth.from(startDate), YearMonth.from(endDate)) + 1;
    }

    public boolean isRentedBy(int renterId) {
        return this.renterId == renterId;
    }

    @JsonIgnore
    public boolean isRenewal() {
        return previousLeaseId != null;
    }

    /** Start month through the last month in effect (closedOn, or endDate). */
    public List<YearMonth> billingMonths() {
        LocalDate lastDay = (closedOn != null && closedOn.isBefore(endDate)) ? closedOn : endDate;
        List<YearMonth> months = new ArrayList<>();
        for (YearMonth m = YearMonth.from(startDate); !m.isAfter(YearMonth.from(lastDay)); m = m.plusMonths(1)) {
            months.add(m);
        }
        return months;
    }

    /** First month of every billing period: every month, or every 3rd / 6th / 12th with longer payment terms. */
    public List<YearMonth> billingPeriodStarts() {
        List<YearMonth> months = billingMonths();
        List<YearMonth> starts = new ArrayList<>();
        for (int i = 0; i < months.size(); i += paymentTerms.getMonthsPerPeriod()) {
            starts.add(months.get(i));
        }
        return starts;
    }

    /** How many months the period starting at periodStart covers (the last period can be shorter). */
    public int monthsInPeriod(YearMonth periodStart) {
        List<YearMonth> months = billingMonths();
        int index = months.indexOf(periodStart);
        if (index < 0) {
            return 0;
        }
        return Math.min(paymentTerms.getMonthsPerPeriod(), months.size() - index);
    }

    /** Amount for the period starting at periodStart: monthlyRent x its months. */
    public BigDecimal amountForPeriod(YearMonth periodStart) {
        return monthlyRent.multiply(BigDecimal.valueOf(monthsInPeriod(periodStart)));
    }

    /**
     * Due date of the period starting at periodStart: the same day of the month as startDate
     * (or the last day of shorter months). In advance = in the period's first month;
     * in arrears = in the month after the period.
     */
    public LocalDate dueDateFor(YearMonth periodStart) {
        YearMonth dueMonth = paymentTerms.isInAdvance()
                ? periodStart
                : periodStart.plusMonths(Math.max(1, monthsInPeriod(periodStart)));
        int day = Math.min(startDate.getDayOfMonth(), dueMonth.lengthOfMonth());
        return dueMonth.atDay(day);
    }

    /** Normal end: ACTIVE -> ENDED. */
    public void end(LocalDate today) {
        requireActive("ended");
        this.status = LeaseStatus.ENDED;
        this.closedOn = today;
    }

    /** Early end: ACTIVE -> TERMINATED. */
    public void terminate(LocalDate today) {
        requireActive("terminated");
        this.status = LeaseStatus.TERMINATED;
        this.closedOn = today;
    }

    /** Used by LeaseService.renewLease: ACTIVE -> RENEWED, closedOn = the day before the new lease starts. */
    public void markRenewed(LocalDate lastDay) {
        requireActive("renewed");
        this.status = LeaseStatus.RENEWED;
        this.closedOn = lastDay;
    }

    private void requireActive(String action) {
        if (status != LeaseStatus.ACTIVE) {
            throw new ConflictException("This lease is already " + status.getLabel().toLowerCase()
                    + ", so it can't be " + action + ".");
        }
    }

    private static String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }
}
