package com.techhub.spacegridapplication.dao;

import com.techhub.spacegridapplication.model.Payment;
import java.time.YearMonth;
import java.util.List;
import java.util.Set;

public interface PaymentDao extends CrudDao<Payment> {

List<Payment> findByLeaseId(int leaseId);

Set<YearMonth> findPaidMonths(int leaseId);
}
