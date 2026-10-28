/*
 * lease.js — script for lease.html?id= (both roles: the lease's landlord and its renter)
 *
 * 1. Load: GET /api/leases/{id} (currentState, daysRemaining, names, contact, payment terms),
 *          GET /api/leases/{id}/statement (one line per billing period),
 *          GET /api/leases/{id}/payments (every attempt), GET /api/leases/{id}/files (the contract PDF)
 *          and GET /api/leases/{id}/property (the grid, with this unit highlighted).
 * 2. Landlord: Renew → /landlord/lease-form.html?renew={id}; End / Terminate → POST /api/leases/{id}/end | /terminate;
 *    upload the contract → POST /api/leases/{id}/files.
 * 3. Renter: "Pay Rent" on the oldest unpaid period → /renter/pay.html?leaseId={id}&month={billingMonth}
 */
const $ = (id) => document.getElementById(id);
const leaseId = new URLSearchParams(location.search).get('id');

const TERMS_LABEL = {
  MONTHLY_ADVANCE: 'Monthly in advance', MONTHLY_ARREARS: 'Monthly in arrears', QUARTERLY_ADVANCE: 'Quarterly in advance',
  SEMI_ANNUAL_ADVANCE: 'Semi-annual in advance', ANNUAL_ADVANCE: 'Annual in advance'
};
/** Payment attempt status → the statement's colors (zones.css): paid green, failed red, pending grey. */
const PAYMENT_BADGE = { PAID: 'due-paid', FAILED: 'due-overdue', PENDING: 'due-upcoming' };

let user = null;

document.addEventListener('DOMContentLoaded', async () => {
  user = await auth.requireLogin();   // any role: landlord or renter
  $('btnLogout').addEventListener('click', () => auth.logout());
  $('backLink').href = user.role === 'LANDLORD' ? '/landlord/leases.html' : '/renter/dashboard.html';
  if (user.role === 'LANDLORD') {
    $('btnEnd').addEventListener('click', () => closeLease('end', 'End this lease? The unit becomes available again.'));
    $('btnTerminate').addEventListener('click', () => closeLease('terminate', 'Terminate this lease early, today? The unit becomes available again.'));
    $('contractInput').addEventListener('change', uploadContract);
  } else {
    $('landlordActions').remove();            // renters only see the lease
  }
  try {
    await load();
  } catch (err) {
    $('propertyName').textContent = 'Lease not found';
    $('unitName').textContent = err.message;
  }
});

async function load() {
  const [lease, statement, payments, files] = await Promise.all([
    api.get(`/api/leases/${leaseId}`),
    api.get(`/api/leases/${leaseId}/statement`),
    api.get(`/api/leases/${leaseId}/payments`),
    api.get(`/api/leases/${leaseId}/files`)
  ]);
  document.title = `${lease.unitName} · ${lease.propertyName} · SpaceGrid`;
  $('propertyName').textContent = lease.propertyName;
  $('unitName').textContent = `${lease.unitName} Overview`;
  $('currentState').innerHTML = format.badge('state-', lease.currentState);
  $('valProperty').textContent = lease.propertyName;
  $('valUnit').textContent = lease.unitName;
  $('valTerm').textContent = `${format.date(lease.startDate)} - ${format.date(lease.endDate)}`;
  $('valRent').textContent = format.peso(lease.monthlyRent);
  $('valTerms').textContent = TERMS_LABEL[lease.paymentTerms];
  $('valRenter').textContent = `${lease.tenantName} (${lease.renterUsername})`;
  $('valContact').textContent = [lease.tenantEmail, lease.tenantPhone].filter(Boolean).join(' · ') || '—';
  $('daysRemaining').textContent = `${lease.daysRemaining} days`;
  $('valContract').innerHTML = files.length
    ? `<a href="${files[0].url}" target="_blank">${format.escape(files[0].fileName)}</a>`
    : 'None uploaded';

  if (user.role === 'LANDLORD') {
    const active = lease.status === 'ACTIVE';
    $('btnRenew').href = `/landlord/lease-form.html?renew=${lease.id}`;
    $('landlordActions').style.display = active ? '' : 'none';
    $('contractUploadRow').hidden = false;
  }
  renderStatement(statement, lease);
  renderPayments(payments);
  drawGrid(lease);
}

/** One row per billing period; the renter can pay the oldest unpaid one (the server requires that order). */
function renderStatement(statement, lease) {
  const firstUnpaid = statement.find((s) => s.status !== 'PAID');
  $('statementTable').innerHTML = statement.length === 0
    ? '<tr><td colspan="4" class="text-muted">Nothing to bill.</td></tr>'
    : statement.map((s) => {
      let action = '<span class="text-muted">—</span>';
      if (s.status === 'PAID') {
        action = '<span class="text-muted">Cleared</span>';
      } else if (user.role === 'RENTER' && s === firstUnpaid) {
        action = `<a href="/renter/pay.html?leaseId=${lease.id}&month=${s.billingMonth}" class="btn btn-sm btn-primary">Pay Rent</a>`;
      }
      const period = s.months > 1 ? `${s.billingMonth} (${s.months} mo.)` : s.billingMonth;
      return `<tr>
          <td title="Due ${format.date(s.dueDate)}">${period}</td>
          <td>${format.peso(s.amountDue)}</td>
          <td>${format.badge('due-', s.status)}</td>
          <td>${action}</td>
        </tr>`;
    }).join('');
}

function renderPayments(payments) {
  $('paymentHistoryTable').innerHTML = payments.length === 0
    ? '<tr><td colspan="5" class="text-muted">No payments yet.</td></tr>'
    : payments.map((p) => `<tr>
          <td>${format.date(p.paidAt || p.createdAt)}</td>
          <td>${p.billingMonth}</td>
          <td>${format.label(p.method)}</td>
          <td>${format.peso(p.amount)}</td>
          <td><span class="badge ${PAYMENT_BADGE[p.status]}">${format.label(p.status)}</span></td>
        </tr>`).join('');
}

/** Read-only grid with this unit outlined (grid-renderer.js). */
async function drawGrid(lease) {
  try {
    const property = await api.get(`/api/leases/${lease.id}/property`);
    gridRenderer.render($('gridHost'), gridRenderer.fromProperty(property), { mode: 'view', highlightZoneId: lease.unitId });
  } catch (err) {
    $('gridHost').textContent = 'The grid could not be shown.';
  }
}

async function closeLease(action, question) {
  if (!confirm(question)) return;
  try {
    await api.form('POST', `/api/leases/${leaseId}/${action}`);
    await load();
  } catch (err) {
    $('actionError').textContent = err.message;   // e.g. "This lease runs until ... To end it before then, terminate it."
  }
}

async function uploadContract(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = new FormData();
    data.append('file', file);
    await api.upload(`/api/leases/${leaseId}/files`, data);
    await load();
  } catch (err) {
    $('actionError').textContent = err.message;
  }
  e.target.value = '';
}
