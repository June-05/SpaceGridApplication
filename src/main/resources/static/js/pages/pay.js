/*
 * pay.js — script for renter/pay.html
 *
 * 1. const q = new URLSearchParams(location.search);
 *    const leaseId = q.get('leaseId'), month = q.get('month');   // month like "2026-11"
 * 2. Show the amount (from GET /api/leases/${leaseId}/statement, the item for that month).
 * 3. Pay:
 *      const payment = await api.form('POST', `/api/leases/${leaseId}/payments`,
 *                                     { billingMonth: month, method, accountNumber });
 *    payment.status === 'PAID' → show payment.referenceNo; 'FAILED' → show "Payment declined".
 */
document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.requireLogin('RENTER');
  // TODO
});
