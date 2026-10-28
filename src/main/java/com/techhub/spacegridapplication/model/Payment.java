package com.techhub.spacegridapplication.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.techhub.spacegridapplication.exception.ValidationException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.YearMonth;

/** One payment attempt for one billing month. Stores its own amount. */
public class Payment extends BaseEntity {

    private int leaseId;
    private int renterId;
    private YearMonth billingMonth;
    private BigDecimal amount;
    private PaymentMethod method;
    private PaymentStatus status;
    private String referenceNo;
    private LocalDateTime paidAt;

    /** New payment attempt: starts as PENDING. */
    public Payment(
            int leaseId,
            int renterId,
            YearMonth billingMonth,
            BigDecimal amount,
            PaymentMethod method) {
        if (billingMonth == null) {
            throw new ValidationException("Billing month is required.");
        }
        if (amount == null || amount.signum() <= 0) {
            throw new ValidationException("Amount must be greater than 0.");
        }
        if (method == null) {
            throw new ValidationException("Payment method is required.");
        }
        this.leaseId = leaseId;
        this.renterId = renterId;
        this.billingMonth = billingMonth;
        this.amount = amount;
        this.method = method;
        this.status = PaymentStatus.PENDING;
    }

    /** From database. */
    public Payment(int id, LocalDateTime createdAt, int leaseId, int renterId, YearMonth billingMonth,
                   BigDecimal amount, PaymentMethod method, PaymentStatus status, String referenceNo,
                   LocalDateTime paidAt) {
        super(id, createdAt);
        this.leaseId = leaseId;
        this.renterId = renterId;
        this.billingMonth = billingMonth;
        this.amount = amount;
        this.method = method;
        this.status = status;
        this.referenceNo = referenceNo;
        this.paidAt = paidAt;
    }

    public int getLeaseId() { return leaseId; }
    public int getRenterId() { return renterId; }
    public YearMonth getBillingMonth() { return billingMonth; }
    public BigDecimal getAmount() { return amount; }
    public PaymentMethod getMethod() { return method; }
    public PaymentStatus getStatus() { return status; }
    public String getReferenceNo() { return referenceNo; }
    public LocalDateTime getPaidAt() { return paidAt; }

    public void markPaid(String referenceNo, LocalDateTime paidAt) {
        requirePending();
        if (referenceNo == null || referenceNo.isBlank() || paidAt == null) {
            throw new ValidationException("A paid payment needs a reference number and a time.");
        }
        this.status = PaymentStatus.PAID;
        this.referenceNo = referenceNo;
        this.paidAt = paidAt;
    }

    public void markFailed() {
        requirePending();
        this.status = PaymentStatus.FAILED;
    }

    @JsonIgnore
    public boolean isPaid() {
        return status == PaymentStatus.PAID;
    }

    private void requirePending() {
        if (status != PaymentStatus.PENDING) {
            throw new IllegalStateException("This payment is already " + status.getLabel().toLowerCase() + ".");
        }
    }
}
