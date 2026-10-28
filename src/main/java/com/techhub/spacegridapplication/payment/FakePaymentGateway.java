package com.techhub.spacegridapplication.payment;

import com.techhub.spacegridapplication.model.PaymentMethod;
import com.techhub.spacegridapplication.model.PaymentResult;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

/** Simulated payments: approves everything except account numbers ending in "0000". */
@Component
public class FakePaymentGateway implements PaymentGateway {

    @Override
    public PaymentResult charge(BigDecimal amount, PaymentMethod method, String accountNumber) {
        if (accountNumber == null || accountNumber.trim().endsWith("0000")) {
            return PaymentResult.declined("Payment declined by " + method.getLabel() + ".");
        }
        return PaymentResult.approved(generateReference());
    }

    /** e.g. "SG-20261024-7F3A9C": today's date + 6 random characters (payments.reference_no is UNIQUE). */
    private String generateReference() {
        String date = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
        String random = UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase();
        return "SG-" + date + "-" + random;
    }
}
