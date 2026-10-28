package com.techhub.spacegridapplication.model;

/** Value object: the payment gateway's answer. */
public record PaymentResult(boolean success, String referenceNo, String message) {

    public static PaymentResult approved(String referenceNo) {
        return new PaymentResult(true, referenceNo, "Payment approved.");
    }

    public static PaymentResult declined(String message) {
        return new PaymentResult(false, null, message);
    }
}
