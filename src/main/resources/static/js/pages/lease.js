/*
 * lease.js — script for lease.html (both roles)
 *
 * 1. const id = new URLSearchParams(location.search).get('id');
 * 2. const lease = await api.get(`/api/leases/${id}`);              // currentState, daysRemaining, names...
 *    const statement = await api.get(`/api/leases/${id}/statement`); // [{billingMonth, dueDate, amountDue, status}]
 *    const payments = await api.get(`/api/leases/${id}/payments`);
 * 3. Landlord (user.role === 'LANDLORD'):
 *      draw the grid: gridRenderer.render(el, await api.get(`/api/properties/${propertyId}`), { highlightZoneId: lease.unitId })
 *      buttons: api.form('POST', `/api/leases/${id}/end`) · `/terminate` · Renew → /landlord/lease-form.html?renew=${id}
 * 4. Renter: "Pay" link for months whose status is not PAID → /renter/pay.html?leaseId=${id}&month=${billingMonth}
 */
document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.requireLogin();   // any role: landlord or renter
  // TODO
});
