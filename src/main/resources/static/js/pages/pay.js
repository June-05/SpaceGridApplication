/*
 * pay.js — script for renter/pay.html?leaseId=&month=   (month like "2026-11": the first month of a billing period)
 *
 * 1. The amount comes from GET /api/leases/{leaseId}/statement (the line for that period).
 *    Without ?month= the oldest unpaid period is used (the server only accepts that one anyway).
 * 2. Pay: POST /api/leases/{leaseId}/payments { billingMonth, method, accountNumber }
 *    payment.status 'PAID' → show payment.referenceNo; 'FAILED' → "Payment declined" (account numbers ending in 0000).
 */
const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', async () => {
  await auth.requireLogin('RENTER');
  const query = new URLSearchParams(location.search);
  const leaseId = query.get('leaseId');
  if (!leaseId) {
    $('error').textContent = 'Open this page from one of your leases.';
    $('payForm').querySelector('button').disabled = true;
    return;
  }

  const statement = await api.get(`/api/leases/${leaseId}/statement`);
  const unpaid = statement.filter((s) => s.status !== 'PAID');
  const line = statement.find((s) => s.billingMonth === query.get('month')) || unpaid[0];
  if (!line || line.status === 'PAID') {
    $('amountInfo').textContent = 'Everything on this lease is paid. Thank you!';
    $('payForm').querySelector('button').disabled = true;
    return;
  }
  $('billingMonth').value = line.billingMonth;
  $('billingMonth').readOnly = true;              // the period is chosen on the lease page
  $('amountInfo').textContent = `Amount due: ${format.peso(line.amountDue)}`
    + (line.months > 1 ? ` (${line.months} months)` : '') + ` · due ${format.date(line.dueDate)}`;

  $('payForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    $('error').textContent = '';
    $('result').textContent = '';
    const button = $('payForm').querySelector('button');
    button.disabled = true;
    try {
      const payment = await api.form('POST', `/api/leases/${leaseId}/payments`, {
        billingMonth: line.billingMonth,
        method: $('method').value,
        accountNumber: $('accountNumber').value.trim()
      });
      if (payment.status === 'PAID') {
        $('result').innerHTML = `Payment received. Reference no. <strong>${format.escape(payment.referenceNo)}</strong>. `
          + `<a href="/lease.html?id=${leaseId}">Back to the lease</a>`;
        return;                                   // keep the button disabled: this period is paid
      }
      $('error').textContent = 'Payment declined. Check the account number and try again.';
    } catch (err) {
      $('error').textContent = err.message;       // e.g. "Please pay 2026-10 first."
    }
    button.disabled = false;
  });
});
