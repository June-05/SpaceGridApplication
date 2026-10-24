package com.techhub.spacegridapplication.model;

/** Value object: the payment gateway's answer. */
public record PaymentResult(boolean success, String referenceNo, String message) {

    public static PaymentResult approved(String referenceNo) {
        // TODO: return new PaymentResult(true, referenceNo, "Payment approved.")
        throw new UnsupportedOperationException("TODO");
    }

    public static PaymentResult declined(String message) {
        // TODO: return new PaymentResult(false, null, message)
        throw new UnsupportedOperationException("TODO");
    }
}
