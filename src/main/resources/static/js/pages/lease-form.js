/*
 * lease-form.js — script for landlord/lease-form.html
 *
 * 1. const renewId = new URLSearchParams(location.search).get('renew');   // null = new lease
 * 2. New lease:
 *      await api.form('POST', '/api/leases', { unitId, renterUsername, startDate, endDate, monthlyRent });
 *    Renew:
 *      await api.form('POST', `/api/leases/${renewId}/renew`, { newStartDate, newEndDate, newMonthlyRent });
 * 3. On success go to /lease.html?id=${createdLease.id}
 */
document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.requireLogin('LANDLORD');
  // TODO
});
