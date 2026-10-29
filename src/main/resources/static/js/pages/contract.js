/*
 * contract.js — script for contract.html?id= (the printable lease agreement; the lease's landlord or its renter)
 *
 * 1. Load: GET /api/leases/{id} (terms, tenant, dates, state) and GET /api/leases/{id}/property (address).
 *    Nothing is saved: the page only fills a generic template. "Print / Save as PDF" calls window.print();
 *    the CSS in contract.html hides the top bar and buttons when printing.
 * 2. Payment terms → months per period / in advance or arrears (same rule as PaymentTerms.java).
 * 3. The signed scan is uploaded on lease.html ("Signed copy").
 */
const $ = (id) => document.getElementById(id);
const leaseId = new URLSearchParams(location.search).get('id');

/** PaymentTerms → [label, months per period, in advance] */
const TERMS = {
  MONTHLY_ADVANCE: ['monthly, in advance', 1, true], MONTHLY_ARREARS: ['monthly, in arrears', 1, false],
  QUARTERLY_ADVANCE: ['quarterly, in advance', 3, true], SEMI_ANNUAL_ADVANCE: ['every six months, in advance', 6, true],
  ANNUAL_ADVANCE: ['yearly, in advance', 12, true]
};

function ordinal(n) {
  const v = n % 100;
  const s = ['th', 'st', 'nd', 'rd'];
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function monthsBetween(startIso, endIso) {
  const a = new Date(startIso + 'T00:00:00');
  const b = new Date(endIso + 'T00:00:00');
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1;   // LeaseContract.durationInMonths
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.requireLogin();           // any role: landlord or renter
  $('backLink').href = `/lease.html?id=${leaseId}`;
  $('printBtn').addEventListener('click', () => window.print());
  try {
    const [lease, property] = await Promise.all([
      api.get(`/api/leases/${leaseId}`),
      api.get(`/api/leases/${leaseId}/property`)
    ]);
    fill(lease, property);
  } catch (err) {
    $('error').textContent = err.message;
  }
});

function fill(lease, property) {
  const [termsLabel, perPeriod, inAdvance] = TERMS[lease.paymentTerms] || TERMS.MONTHLY_ADVANCE;
  const months = monthsBetween(lease.startDate, lease.endDate);
  const startDay = Number(lease.startDate.slice(8, 10));
  const amount = Number(lease.monthlyRent) * perPeriod;

  document.title = `Lease Agreement · ${lease.unitName} · ${lease.propertyName} · SpaceGrid`;
  $('refLine').textContent = `Lease no. ${lease.id}${lease.previousLeaseId ? ` (renews lease no. ${lease.previousLeaseId})` : ''}`;
  $('cDate').textContent = format.date(lease.createdAt);
  $('cProperty').textContent = lease.propertyName;
  $('cProperty2').textContent = lease.propertyName;
  $('cTenant').textContent = lease.tenantName;
  $('cUsername').textContent = lease.renterUsername;
  $('cContact').textContent = [lease.tenantEmail, lease.tenantPhone].filter(Boolean).join(', ') || 'no contact details given';
  $('cUnit').textContent = lease.unitName;
  $('cAddress').textContent = property.fullAddress || '—';
  $('cStart').textContent = format.date(lease.startDate);
  $('cEnd').textContent = format.date(lease.endDate);
  $('cMonths').textContent = `${months} ${months === 1 ? 'month' : 'months'}`;
  $('cRent').textContent = format.peso(lease.monthlyRent);
  $('cTerms').textContent = termsLabel;
  $('cPeriod').textContent = perPeriod === 1
    ? `${format.peso(amount)} each month, ${inAdvance ? 'at the start of the month' : 'after the month has passed'}.`
    : `${format.peso(amount)} every ${perPeriod} months, ${inAdvance ? 'at the start of each period' : 'after each period'}.`;
  $('cDueDay').textContent = ordinal(startDay);
  $('sigTenant').textContent = `Tenant: ${lease.tenantName}`;

  // A closed lease is still printable: say how it closed so the copy isn't mistaken for a running one.
  const closed = { ENDED: 'Ended', TERMINATED: 'Terminated early', RENEWED: 'Renewed' }[lease.currentState];
  if (closed) {
    $('statusLine').textContent = `${closed} on ${format.date(lease.closedOn)}`;
    $('statusLine').classList.remove('hidden');
  }
  $('paper').classList.remove('hidden');
}
