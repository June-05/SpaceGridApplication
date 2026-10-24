package com.techhub.spacegridapplication.payment;

import com.techhub.spacegridapplication.model.PaymentMethod;
import com.techhub.spacegridapplication.model.PaymentResult;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/** Simulated payments: approves everything except account numbers ending in "0000". */
@Component
public class FakePaymentGateway implements PaymentGateway {

    @Override
    public PaymentResult charge(BigDecimal amount, PaymentMethod method, String accountNumber) {
        // TODO: declined if accountNumber ends with "0000", otherwise approved(generateReference())
        throw new UnsupportedOperationException("TODO");
    }

    private String generateReference() {
        // TODO: e.g. "SG-20261024-0001"
        throw new UnsupportedOperationException("TODO");
    }
}
