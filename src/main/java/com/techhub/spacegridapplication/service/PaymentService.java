package com.techhub.spacegridapplication.service;

import com.techhub.spacegridapplication.dao.PaymentDao;
import com.techhub.spacegridapplication.exception.ConflictException;
import com.techhub.spacegridapplication.exception.ValidationException;
import com.techhub.spacegridapplication.model.DueStatus;
import com.techhub.spacegridapplication.model.LeaseContract;
import com.techhub.spacegridapplication.model.Payment;
import com.techhub.spacegridapplication.model.PaymentMethod;
import com.techhub.spacegridapplication.model.PaymentResult;
import com.techhub.spacegridapplication.model.RentDue;
import com.techhub.spacegridapplication.model.User;
import com.techhub.spacegridapplication.payment.PaymentGateway;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/** Rent statement and (simulated) rent payments. */
@Service
public class PaymentService {

    /** A period counts as DUE (not just UPCOMING) from this many days before its due date. */
    public static final int DUE_WINDOW_DAYS = 7;

    private final PaymentDao paymentDao;
    private final LeaseService leaseService;
    private final PaymentGateway paymentGateway;

    public PaymentService(PaymentDao paymentDao, LeaseService leaseService, PaymentGateway paymentGateway) {
        this.paymentDao = paymentDao;
        this.leaseService = leaseService;
        this.paymentGateway = paymentGateway;
    }

    /**
     * One RentDue per billing period (a month, or 3 / 6 / 12 months with longer payment terms):
     * PAID, OVERDUE (after the due date), DUE (within 7 days of the due date) or UPCOMING.
     */
    public List<RentDue> getStatement(int leaseId, User user, LocalDate today) {
        LeaseContract lease = leaseService.getLeaseFor(leaseId, user);
        Set<YearMonth> paid = paymentDao.findPaidMonths(leaseId);
        List<RentDue> statement = new ArrayList<>();
        for (YearMonth periodStart : lease.billingPeriodStarts()) {
            LocalDate dueDate = lease.dueDateFor(periodStart);
            DueStatus status;
            if (paid.contains(periodStart)) {
                status = DueStatus.PAID;
            } else if (today.isAfter(dueDate)) {
                status = DueStatus.OVERDUE;
            } else if (!today.isBefore(dueDate.minusDays(DUE_WINDOW_DAYS))) {
                status = DueStatus.DUE;
            } else {
                status = DueStatus.UPCOMING;
            }
            statement.add(new RentDue(periodStart, dueDate, lease.amountForPeriod(periodStart), status,
                    lease.monthsInPeriod(periodStart)));
        }
        return statement;
    }

    /**
     * The period must be in the lease, not paid yet, and the oldest unpaid one. Charges the gateway
     * and saves the attempt as PAID or FAILED (a declined payment is returned, not thrown, so the page can say so).
     */
    @Transactional
    public Payment payRent(
            User renter,
            int leaseId,
            YearMonth billingMonth,
            PaymentMethod method,
            String accountNumber) {
        if (accountNumber == null || accountNumber.isBlank()) {
            throw new ValidationException("Enter the account or card number.");
        }
        List<RentDue> statement = getStatement(leaseId, renter, LocalDate.now());   // also checks it's the renter's lease
        RentDue line = statement.stream()
                .filter(due -> due.billingMonth().equals(billingMonth))
                .findFirst()
                .orElseThrow(() -> new ValidationException(billingMonth + " isn't a billing period of this lease."));
        if (!line.isPayable()) {
            throw new ConflictException(billingMonth + " is already paid.");
        }
        RentDue oldestUnpaid = statement.stream().filter(RentDue::isPayable).findFirst().orElse(line);
        if (!oldestUnpaid.billingMonth().equals(billingMonth)) {
            throw new ConflictException("Please pay " + oldestUnpaid.billingMonth() + " first.");
        }

        BigDecimal amount = line.amountDue();
        Payment payment = new Payment(leaseId, renter.getId(), billingMonth, amount, method);
        PaymentResult result = paymentGateway.charge(amount, method, accountNumber.trim());
        if (result.success()) {
            payment.markPaid(result.referenceNo(), LocalDateTime.now());
        } else {
            payment.markFailed();
        }
        return paymentDao.save(payment);
    }

    /** Every attempt for the lease (PAID and FAILED), newest first. */
    public List<Payment> getPaymentHistory(int leaseId, User user) {
        leaseService.getLeaseFor(leaseId, user);
        return paymentDao.findByLeaseId(leaseId);
    }
}
