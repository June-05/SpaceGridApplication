package com.techhub.spacegridapplication.model;

import com.fasterxml.jackson.annotation.JsonIgnore;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;

/** Value object: one line of a renter's rent statement. Built by PaymentService.getStatement(). */
public record RentDue(YearMonth billingMonth, LocalDate dueDate, BigDecimal amountDue, DueStatus status) {

    /** True if this month can be paid (status is not PAID). */
    @JsonIgnore
    public boolean isPayable() {
        // TODO
        throw new UnsupportedOperationException("TODO");
    }
}
