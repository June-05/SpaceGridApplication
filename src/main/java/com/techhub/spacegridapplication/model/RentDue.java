package com.techhub.spacegridapplication.model;

import com.fasterxml.jackson.annotation.JsonIgnore;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;

/**
 * Value object: one line of a renter's rent statement. Built by PaymentService.getStatement().
 * billingMonth = first month of the billing period; months = how many months it covers (1, 3, 6 or 12).
 */
public record RentDue(YearMonth billingMonth, LocalDate dueDate, BigDecimal amountDue, DueStatus status, int months) {

    /** True if this period can be paid (status is not PAID). */
    @JsonIgnore
    public boolean isPayable() {
        return status != DueStatus.PAID;
    }
}
