/*
 * leases.js — script for landlord/leases.html
 *
 * 1. const leases = await api.get('/api/leases');
 * 2. One row per lease: unitName, propertyName, renterName, startDate–endDate, monthlyRent,
 *    badge with format.cssClass('state-', lease.currentState); highlight EXPIRING_SOON and EXPIRED.
 * 3. Row click → /lease.html?id=${lease.id}
 */
document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.requireLogin('LANDLORD');
  // TODO
});
