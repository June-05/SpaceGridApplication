package com.techhub.spacegridapplication.payment;

import com.techhub.spacegridapplication.model.PaymentMethod;
import com.techhub.spacegridapplication.model.PaymentResult;

import java.math.BigDecimal;

/** The payment step. FakePaymentGateway simulates it; a real provider can implement this later. */
public interface PaymentGateway {

    PaymentResult charge(BigDecimal amount, PaymentMethod method, String accountNumber);
}
