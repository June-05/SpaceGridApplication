package com.techhub.spacegridapplication.service;

import com.techhub.spacegridapplication.dao.PaymentDao;
import com.techhub.spacegridapplication.model.Payment;
import com.techhub.spacegridapplication.model.PaymentMethod;
import com.techhub.spacegridapplication.model.RentDue;
import com.techhub.spacegridapplication.model.User;
import com.techhub.spacegridapplication.payment.PaymentGateway;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

/** Rent statement and (simulated) rent payments. */
@Service
public class PaymentService {

    private final PaymentDao paymentDao;
    private final LeaseService leaseService;
    private final PaymentGateway paymentGateway;

    public PaymentService(PaymentDao paymentDao, LeaseService leaseService, PaymentGateway paymentGateway) {
        this.paymentDao = paymentDao;
        this.leaseService = leaseService;
        this.paymentGateway = paymentGateway;
    }

    /** One RentDue per billing month: PAID, OVERDUE, DUE (within 7 days of the due date) or UPCOMING. */
    public List<RentDue> getStatement(int leaseId, User user, LocalDate today) {
        // TODO
        throw new UnsupportedOperationException("TODO");
    }

    /** Month must be in the lease, not paid yet, and the oldest unpaid month. Charge the gateway, save PAID or FAILED. */
    @Transactional
    public Payment payRent(
            User renter,
            int leaseId,
            YearMonth billingMonth,
            PaymentMethod method,
            String accountNumber) {
        // TODO
        throw new UnsupportedOperationException("TODO");
    }

    public List<Payment> getPaymentHistory(int leaseId, User user) {
        // TODO
        throw new UnsupportedOperationException("TODO");
    }
}
