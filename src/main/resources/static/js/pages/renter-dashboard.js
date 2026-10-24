/*
 * renter-dashboard.js — script for renter/dashboard.html
 *
 * 1. const leases = await api.get('/api/leases');            // only this renter's leases
 * 2. For each lease show propertyName, unitName, currentState badge, daysRemaining.
 * 3. Next amount due: const st = await api.get(`/api/leases/${lease.id}/statement`);
 *    the first item with status 'OVERDUE' or 'DUE'.
 * 4. Link each lease to /lease.html?id=${lease.id}
 */
document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.requireLogin('RENTER');
  // TODO
});
