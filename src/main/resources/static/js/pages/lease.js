/*
 * lease.js — script for lease.html?id= (both roles: the lease's landlord and its renter)
 *
 * 1. Load: GET /api/leases/{id} (currentState, daysRemaining, closedOn, terminationReason, endedAutomatically, ...),
 *          GET /api/leases/{id}/statement (one line per billing period),
 *          GET /api/leases/{id}/payments (every attempt), GET /api/leases/{id}/files (the signed copy, PDF),
 *          GET /api/leases (to find the renewal of a RENEWED lease) and GET /api/leases/{id}/property (the grid).
 * 2. Lease Status = lease.currentState, explained in one line, plus a timeline (start → last 30 days → end).
 * 3. "What you can do" depends on the state and the role (see actionsFor):
 *      running (UPCOMING / ACTIVE / EXPIRING_SOON / EXPIRED)
 *        landlord: Renew → /landlord/lease-form.html?renew={id}, Terminate (reason) → POST /api/leases/{id}/terminate
 *                  (EXPIRED only: End now → POST /api/leases/{id}/end; otherwise LeaseExpiryJob ends it)
 *        renter:   Pay rent → /renter/pay.html?leaseId={id}&month={oldest unpaid}
 *      ENDED       landlord: Lease again → /landlord/lease-form.html?again={id} · renter: pay what is left, request again (/?space=)
 *      TERMINATED  both see the reason · renter: pay what is left, browse spaces
 *    An ENDED / TERMINATED lease with awaitingMoveOut still holds its unit: the landlord's main button is
 *    "Confirm moved out" → POST /api/leases/{id}/move-out (the unit becomes AVAILABLE). Unpaid months of a closed
 *    lease show in a red banner for both roles, and "Lease again" asks before going on when something is owed.
 *      RENEWED     link to the renewal
 *    Upload the signed copy (landlord) → POST /api/leases/{id}/files.
 * 4. "Printable agreement" → /contract.html?id= (the generic contract template; the signed scan is the "Signed copy").
 * 5. Opening the page marks its lease notice as seen in the bell (localStorage seenLeaseNotices, see nav.js).
 */
const $ = (id) => document.getElementById(id);
const leaseId = new URLSearchParams(location.search).get('id');

const TERMS_LABEL = {
  MONTHLY_ADVANCE: 'Monthly in advance', MONTHLY_ARREARS: 'Monthly in arrears', QUARTERLY_ADVANCE: 'Quarterly in advance',
  SEMI_ANNUAL_ADVANCE: 'Semi-annual in advance', ANNUAL_ADVANCE: 'Annual in advance'
};
/** Lease state → badge colors and the colors of the one-line explanation. */
const STATE_STYLE = {
  UPCOMING: 'bg-sky-100 text-sky-800', ACTIVE: 'bg-emerald-100 text-emerald-800', EXPIRING_SOON: 'bg-amber-100 text-amber-800',
  EXPIRED: 'bg-orange-100 text-orange-800', ENDED: 'bg-slate-100 text-slate-700', TERMINATED: 'bg-rose-100 text-rose-800',
  RENEWED: 'bg-violet-100 text-violet-800'
};
const LINE_STYLE = {
  UPCOMING: 'bg-sky-50 border-sky-200 text-sky-900', ACTIVE: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  EXPIRING_SOON: 'bg-amber-50 border-amber-200 text-amber-900', EXPIRED: 'bg-orange-50 border-orange-200 text-orange-900',
  ENDED: 'bg-slate-50 border-slate-200 text-slate-800', TERMINATED: 'bg-rose-50 border-rose-200 text-rose-900',
  RENEWED: 'bg-violet-50 border-violet-200 text-violet-900'
};
const STATE_LABEL = { EXPIRING_SOON: 'Expiring soon', EXPIRED: 'Ending today' };
const DUE_STYLE = { PAID: 'bg-emerald-100 text-emerald-800', DUE: 'bg-amber-100 text-amber-800', OVERDUE: 'bg-rose-100 text-rose-800', UPCOMING: 'bg-slate-100 text-slate-600' };
const PAYMENT_STYLE = { PAID: 'bg-emerald-100 text-emerald-800', FAILED: 'bg-rose-100 text-rose-800', PENDING: 'bg-slate-100 text-slate-600' };
const RUNNING = ['UPCOMING', 'ACTIVE', 'EXPIRING_SOON', 'EXPIRED'];
const SOON_DAYS = 30;                                   // LeaseContract.EXPIRING_SOON_DAYS

const BTN = 'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition';
const BTN_MAIN = `${BTN} bg-indigo-600 hover:bg-indigo-700 text-white`;
const BTN_PLAIN = `${BTN} bg-white hover:bg-slate-50 text-slate-700 border border-slate-200`;
const BTN_DANGER = `${BTN} bg-white hover:bg-rose-50 text-rose-600 border border-rose-200`;

let user = null;
let isLandlord = false;

document.addEventListener('DOMContentLoaded', async () => {
  user = await auth.requireLogin();   // any role: landlord or renter
  isLandlord = user.role === 'LANDLORD';
  $('backLink').href = isLandlord ? '/landlord/leases.html' : '/renter/dashboard.html';
  $('backText').textContent = isLandlord ? 'All leases' : 'My leases';
  markNoticeSeen();
  if (isLandlord) {
    $('contractInput').addEventListener('change', uploadContract);
    $('terminateForm').addEventListener('submit', submitTerminate);
    $('terminateCancel').addEventListener('click', () => $('terminateDialog').classList.add('hidden'));
  }
  $('actions').addEventListener('click', (e) => {
    const button = e.target.closest('[data-do]');
    if (!button) return;
    if (button.dataset.do === 'terminate') openTerminate();
    if (button.dataset.do === 'end') endNow();
    if (button.dataset.do === 'moveout') confirmMoveOut();
  });
  $('actions').addEventListener('click', (e) => {          // "Lease again" while the renter still owes money
    const link = e.target.closest('a[data-confirm]');
    if (link && !confirm(link.dataset.confirm)) e.preventDefault();
  });
  try {
    await load();
  } catch (err) {
    $('propertyName').textContent = 'Lease not found';
    $('unitName').textContent = err.message;
  }
});

/** The bell (nav.js) stops showing this lease's "ended / terminated" notice once its page was opened. */
function markNoticeSeen() {
  try {
    const seen = JSON.parse(localStorage.getItem('seenLeaseNotices') || '[]');
    if (!seen.includes(Number(leaseId))) {
      seen.push(Number(leaseId));
      localStorage.setItem('seenLeaseNotices', JSON.stringify(seen.slice(-200)));
    }
  } catch (e) { /* storage blocked: the notice just stays */ }
}

async function load() {
  const [lease, statement, payments, files, all] = await Promise.all([
    api.get(`/api/leases/${leaseId}`),
    api.get(`/api/leases/${leaseId}/statement`),
    api.get(`/api/leases/${leaseId}/payments`),
    api.get(`/api/leases/${leaseId}/files`),
    api.get('/api/leases')
  ]);
  const renewal = all.find((l) => l.previousLeaseId === lease.id) || null;
  const unpaid = statement.filter((s) => s.status !== 'PAID');

  document.title = `${lease.unitName} · ${lease.propertyName} · SpaceGrid`;
  $('propertyName').textContent = lease.propertyName;
  $('unitName').textContent = lease.unitName;
  const state = lease.currentState;
  $('currentState').className = `inline-block mt-1 text-sm font-bold px-3 py-1.5 rounded-lg ${STATE_STYLE[state] || STATE_STYLE.ENDED}`;
  $('currentState').textContent = STATE_LABEL[state] || format.label(state);
  $('statusLine').className = `px-5 py-4 rounded-2xl border text-sm font-semibold ${LINE_STYLE[state] || LINE_STYLE.ENDED}`;
  $('statusLine').textContent = statusText(lease, renewal);

  $('valTerm').textContent = `${format.date(lease.startDate)} - ${format.date(lease.endDate)}`;
  $('valRent').textContent = format.peso(lease.monthlyRent);
  $('valTerms').textContent = TERMS_LABEL[lease.paymentTerms];
  $('valRenter').textContent = `${lease.tenantName} (${lease.renterUsername})`;
  $('valContact').textContent = [lease.tenantEmail, lease.tenantPhone].filter(Boolean).join(' · ') || '—';
  $('valContract').innerHTML = files.length
    ? `<a href="${files[0].url}" target="_blank" class="text-indigo-600 hover:underline">${format.escape(files[0].fileName)}</a>`
    : 'None uploaded';
  $('contractUploadRow').classList.toggle('hidden', !isLandlord);
  $('contractLink').href = `/contract.html?id=${lease.id}`;

  renderBalance(lease, unpaid);
  renderTimeline(lease, renewal);
  renderActions(lease, renewal, unpaid);
  renderStatement(statement, lease);
  renderPayments(payments);
  drawGrid(lease);
}

/** One line that says what the Lease Status means for this lease. */
function statusText(lease, renewal) {
  const days = lease.daysRemaining;
  const dayWord = days === 1 ? 'day' : 'days';
  switch (lease.currentState) {
    case 'UPCOMING': return `Starts on ${format.date(lease.startDate)}. Rent is billed from then.`;
    case 'ACTIVE': return `Active — ${days} ${dayWord} left (until ${format.date(lease.endDate)}).`;
    case 'EXPIRING_SOON': return `Expiring soon — ends in ${days} ${dayWord}, on ${format.date(lease.endDate)}.`
      + (isLandlord ? ' Renew it now if the tenant is staying.' : ' Ask the owner to renew it if you want to stay.');
    case 'EXPIRED': return `The end date (${format.date(lease.endDate)}) has passed. It will close automatically.`;
    case 'ENDED': return (lease.endedAutomatically
      ? `Ended automatically on ${format.date(lease.closedOn)} (its end date).`
      : `Ended on ${format.date(lease.closedOn)}.`) + moveOutText(lease);
    case 'TERMINATED': return `Terminated early on ${format.date(lease.closedOn)}. Reason: ${lease.terminationReason || 'not given'}` + moveOutText(lease);
    case 'RENEWED': return `Renewed: this lease ran until ${format.date(lease.closedOn)}`
      + (renewal ? ` and continues as a new lease from ${format.date(renewal.startDate)}.` : '.');
    default: return '';
  }
}

/** What happens to the unit after a lease closed: waiting for the move-out, or the move-out is confirmed. */
function moveOutText(lease) {
  if (lease.awaitingMoveOut) {
    return isLandlord
      ? ' The unit stays occupied until you confirm the renter has moved out.'
      : ' Please leave the unit and return it. The owner will confirm your move-out.';
  }
  return lease.releasedOn ? ` Move-out confirmed on ${format.date(lease.releasedOn)}.` : '';
}

/** Red banner: unpaid months on a closed lease (they stay payable). */
function renderBalance(lease, unpaid) {
  const closed = lease.currentState === 'ENDED' || lease.currentState === 'TERMINATED';
  const owed = unpaid.reduce((sum, s) => sum + Number(s.amountDue), 0);
  const banner = $('balanceBanner');
  banner.classList.toggle('hidden', !closed || unpaid.length === 0);
  if (!closed || unpaid.length === 0) return;
  const months = `${unpaid.length} ${unpaid.length === 1 ? 'month' : 'months'}`;
  banner.textContent = isLandlord
    ? `Unpaid balance: ${format.peso(owed)} (${months}). The renter can still pay it from their lease page.`
    : `You still owe ${format.peso(owed)} (${months}) on this lease. You can pay it below.`;
}

/** Bar from start to end; the last 30 days are amber; the dark part is the time that has passed. */
function renderTimeline(lease, renewal) {
  const day = (iso) => new Date(String(iso).slice(0, 10) + 'T00:00:00').getTime();
  const start = day(lease.startDate);
  const end = day(lease.endDate);
  const total = Math.max(1, end - start);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const stop = lease.closedOn ? Math.min(day(lease.closedOn), today.getTime()) : today.getTime();
  const pct = (t) => Math.max(0, Math.min(100, ((t - start) / total) * 100));
  const soonStart = end - SOON_DAYS * 86400000;

  $('tlStart').textContent = format.date(lease.startDate);
  $('tlEnd').textContent = format.date(lease.endDate);
  $('tlSoonDate').textContent = `from ${format.date(new Date(Math.max(start, soonStart)).toISOString())}`;
  $('tlSoon').style.width = `${100 - pct(soonStart)}%`;
  $('tlDone').style.width = `${pct(stop)}%`;
  $('tlToday').style.left = `calc(${pct(today.getTime())}% - 2px)`;
  $('tlToday').classList.toggle('hidden', !RUNNING.includes(lease.currentState));

  const closed = $('tlClosed');
  const how = {
    ENDED: lease.endedAutomatically ? 'Ended automatically' : 'Ended by the landlord',
    TERMINATED: 'Terminated early',
    RENEWED: 'Renewed'
  }[lease.currentState];
  closed.classList.toggle('hidden', !how);
  if (how) {
    closed.innerHTML = `<i class="fa-solid fa-flag-checkered mr-1 text-slate-400"></i>${how} on ${format.date(lease.closedOn)}`
      + (renewal ? ` → <a class="text-indigo-600 hover:underline" href="/lease.html?id=${renewal.id}">see the new lease</a>` : '');
  }
}

/** The buttons for this state and role, and a note saying why the others are not there. */
function renderActions(lease, renewal, unpaid) {
  const state = lease.currentState;
  const parts = [];
  let note = '';
  const firstUnpaid = unpaid[0];
  const payLink = firstUnpaid
    ? `<a class="${BTN_MAIN}" href="/renter/pay.html?leaseId=${lease.id}&month=${firstUnpaid.billingMonth}"><i class="fa-solid fa-peso-sign"></i>Pay ${firstUnpaid.billingMonth}</a>`
    : '';

  if (RUNNING.includes(state)) {
    if (isLandlord) {
      parts.push(`<a class="${state === 'EXPIRING_SOON' || state === 'EXPIRED' ? BTN_MAIN : BTN_PLAIN}" href="/landlord/lease-form.html?renew=${lease.id}"><i class="fa-solid fa-rotate"></i>Renew Lease</a>`);
      if (state === 'EXPIRED') parts.push(`<button type="button" data-do="end" class="${BTN_PLAIN}"><i class="fa-solid fa-flag-checkered"></i>End now</button>`);
      parts.push(`<button type="button" data-do="terminate" class="${BTN_DANGER}"><i class="fa-solid fa-ban"></i>Terminate early</button>`);
      note = state === 'EXPIRING_SOON' ? `Ends in ${lease.daysRemaining} days. If you don't renew, it ends by itself after ${format.date(lease.endDate)} and the unit becomes available.`
        : 'Renew = new dates/rent for the same tenant. Terminate = end it today, with a reason the renter sees.';
    } else {
      if (payLink) parts.push(payLink);
      note = state === 'EXPIRING_SOON' ? 'Only the owner can renew a lease. Ask them before it ends.'
        : unpaid.length ? '' : 'All billed months are paid.';
    }
  } else if (state === 'RENEWED') {
    if (renewal) parts.push(`<a class="${BTN_MAIN}" href="/lease.html?id=${renewal.id}"><i class="fa-solid fa-arrow-right"></i>Open the new lease</a>`);
    note = 'A renewed lease is history; the new lease continues it.';
  } else {
    // ENDED or TERMINATED
    if (isLandlord) {
      if (lease.awaitingMoveOut) parts.push(`<button type="button" data-do="moveout" class="${BTN_MAIN}"><i class="fa-solid fa-box-open"></i>Confirm moved out</button>`);
      if (state === 'ENDED') {
        const owed = unpaid.reduce((sum, s) => sum + Number(s.amountDue), 0);
        const ask = unpaid.length ? ` data-confirm="${format.escape(`${lease.tenantName} still owes ${format.peso(owed)} on this lease. Lease again anyway?`)}"` : '';
        parts.push(`<a class="${lease.awaitingMoveOut ? BTN_PLAIN : BTN_MAIN}" href="/landlord/lease-form.html?again=${lease.id}"${ask}><i class="fa-solid fa-file-signature"></i>Lease again to ${format.escape(lease.tenantName)}</a>`);
      }
      parts.push(`<a class="${BTN_PLAIN}" href="/landlord/units.html?propertyId=${lease.propertyId}"><i class="fa-solid fa-cubes"></i>See the units</a>`);
      note = (lease.awaitingMoveOut ? 'The unit stays occupied, and can\'t be leased to someone else, until you confirm the move-out. Leasing it again to the same renter counts as confirmed. ' : '')
        + (unpaid.length ? `${unpaid.length} billed ${unpaid.length === 1 ? 'month is' : 'months are'} still unpaid; the renter can still pay them. ` : '')
        + 'Renew and Terminate are only for leases that are still running.';
    } else {
      if (payLink) parts.push(payLink);
      if (state === 'ENDED' && !lease.awaitingMoveOut) parts.push(`<a class="${BTN_PLAIN}" href="/?space=${lease.propertyId}"><i class="fa-solid fa-repeat"></i>Request this space again</a>`);
      parts.push(`<a class="${BTN_PLAIN}" href="/"><i class="fa-solid fa-magnifying-glass"></i>Browse spaces</a>`);
      note = (lease.awaitingMoveOut ? 'The owner has not confirmed your move-out yet. ' : '')
        + (unpaid.length ? `This lease is closed, but ${unpaid.length} billed ${unpaid.length === 1 ? 'month is' : 'months are'} still unpaid.`
          : 'This lease is closed and fully paid.');
    }
  }
  $('actions').innerHTML = parts.join('');
  $('actionsNote').textContent = note;
}

/** One row per billing period; the renter can pay the oldest unpaid one (the server requires that order). */
function renderStatement(statement, lease) {
  const firstUnpaid = statement.find((s) => s.status !== 'PAID');
  $('statementTable').innerHTML = statement.length === 0
    ? '<tr><td colspan="4" class="px-6 py-4 text-slate-400">Nothing to bill.</td></tr>'
    : statement.map((s) => {
      let action = '<span class="text-slate-400">—</span>';
      if (s.status === 'PAID') {
        action = '<span class="text-slate-400">Cleared</span>';
      } else if (!isLandlord && s === firstUnpaid) {
        action = `<a href="/renter/pay.html?leaseId=${lease.id}&month=${s.billingMonth}" class="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold">Pay Rent</a>`;
      }
      const period = s.months > 1 ? `${s.billingMonth} (${s.months} mo.)` : s.billingMonth;
      return `<tr>
          <td class="px-6 py-2.5" title="Due ${format.date(s.dueDate)}">${period}</td>
          <td class="px-3 py-2.5">${format.peso(s.amountDue)}</td>
          <td class="px-3 py-2.5"><span class="text-xs font-bold px-2 py-0.5 rounded-md ${DUE_STYLE[s.status] || ''}">${format.label(s.status)}</span></td>
          <td class="px-3 py-2.5">${action}</td>
        </tr>`;
    }).join('');
}

function renderPayments(payments) {
  $('paymentHistoryTable').innerHTML = payments.length === 0
    ? '<tr><td colspan="5" class="px-6 py-4 text-slate-400">No payments yet.</td></tr>'
    : payments.map((p) => `<tr>
          <td class="px-6 py-2.5">${format.date(p.paidAt || p.createdAt)}</td>
          <td class="px-3 py-2.5">${p.billingMonth}</td>
          <td class="px-3 py-2.5">${format.label(p.method)}</td>
          <td class="px-3 py-2.5">${format.peso(p.amount)}</td>
          <td class="px-3 py-2.5"><span class="text-xs font-bold px-2 py-0.5 rounded-md ${PAYMENT_STYLE[p.status] || ''}">${format.label(p.status)}</span></td>
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

function openTerminate() {
  $('terminateReason').value = '';
  $('terminateError').textContent = '';
  $('terminateDialog').classList.remove('hidden');
  $('terminateReason').focus();
}

async function submitTerminate(e) {
  e.preventDefault();
  const reason = $('terminateReason').value.trim();
  if (!reason) {
    $('terminateError').textContent = 'Write a reason. The renter will see it.';
    return;
  }
  try {
    await api.form('POST', `/api/leases/${leaseId}/terminate`, { reason });
    $('terminateDialog').classList.add('hidden');
    await load();
  } catch (err) {
    $('terminateError').textContent = err.message;
  }
}

/** The renter has left: the unit becomes available again. */
async function confirmMoveOut() {
  if (!confirm('Confirm that the renter has moved out? The unit becomes available to rent again.')) return;
  try {
    await api.form('POST', `/api/leases/${leaseId}/move-out`);
    await load();
  } catch (err) {
    $('actionError').textContent = err.message;
  }
}

/** Only shown once the end date has passed (EXPIRED): closes it now instead of waiting for the automatic end. */
async function endNow() {
  if (!confirm('End this lease now? The unit becomes available again.')) return;
  try {
    await api.form('POST', `/api/leases/${leaseId}/end`);
    await load();
  } catch (err) {
    $('actionError').textContent = err.message;
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
