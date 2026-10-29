/*
 * requests.js — script for requests.html (both roles)
 *
 * 1. const user = await auth.requireLogin();                      // any role
 * 2. const requests = await api.get('/api/lease-requests');       // renter: own requests · landlord: incoming requests
 *    Each request: id, unitId, renterId, desiredStart, months, message, status, decidedAt, createdAt,
 *                  propertyId, unitName, propertyName, renterName, monthlyRate, suggestedEndDate,
 *                  unitRemoved (true when the landlord deleted the unit: unitId is null, the names are kept)
 * 3. Buttons call (api.form, no fields):
 *      renter,   PENDING  → POST /api/lease-requests/{id}/cancel
 *      landlord, PENDING  → POST /api/lease-requests/{id}/approve  or  /decline
 *    then the list is loaded again.
 * 4. The top bar and the Log Out button come from nav.js. A landlord opens on the Pending filter.
 * 5. A landlord's APPROVED request shows "Create lease", which opens the lease form:
 *      /landlord/lease-form.html?requestId={id}   (lease-form.js can use it to fill in the renter and the dates)
 * 6. Once that lease exists, the request shows "Lease created" + "View lease" instead (both roles).
 *    Nothing in the database links a lease to its request, so it is matched here (see linkLeases):
 *    same renter and unit, lease created after the approval; each lease is used for one request only.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.requireLogin();
  const isLandlord = user.role === 'LANDLORD';

  const list = document.getElementById('requests');
  const error = document.getElementById('error');
  const empty = document.getElementById('empty');
  let all = [];                                  // every request, as loaded
  let leaseOf = new Map();                       // request id → the lease created from it
  let filter = 'all';                            // 'all' or 'PENDING'

  document.getElementById('heading').textContent = isLandlord ? 'Requests for my properties' : 'My lease requests';
  document.getElementById('subtitle').textContent = isLandlord
    ? 'Approve or decline renters who asked to lease your units. After approving, create the lease.'
    : 'Your requests to lease a unit, and what the owner decided.';

  const BADGE = {                                // request status → badge colors
    PENDING: 'bg-amber-100 text-amber-800', APPROVED: 'bg-emerald-100 text-emerald-800',
    DECLINED: 'bg-rose-100 text-rose-800', CANCELLED: 'bg-slate-100 text-slate-600'
  };
  const esc = format.escape;                     // names and messages come from users

  function showToast(text, isError) {
    const toast = document.getElementById('toast');
    toast.textContent = text;
    toast.classList.toggle('bg-rose-600', Boolean(isError));
    toast.classList.toggle('bg-slate-900', !isError);
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
  }

  const BTN = 'px-4 py-2 rounded-xl text-xs font-bold transition';
  function actionsHtml(req) {
    if (req.status === 'PENDING') {
      return isLandlord
        ? `<button class="${BTN} bg-indigo-600 hover:bg-indigo-700 text-white" data-action="approve" data-id="${req.id}" type="button">Approve</button>
           <button class="${BTN} bg-white hover:bg-slate-50 text-slate-700 border border-slate-200" data-action="decline" data-id="${req.id}" type="button">Decline</button>`
        : `<button class="${BTN} bg-white hover:bg-rose-50 text-rose-600 border border-rose-200" data-action="cancel" data-id="${req.id}" type="button">Cancel request</button>`;
    }
    const lease = leaseOf.get(req.id);
    if (lease) {
      return `<a class="${BTN} bg-white hover:bg-slate-50 text-slate-700 border border-slate-200" href="/lease.html?id=${lease.id}">View lease</a>`;
    }
    if (isLandlord && req.status === 'APPROVED' && !req.unitRemoved) {
      return `<a class="${BTN} bg-indigo-600 hover:bg-indigo-700 text-white" href="/landlord/lease-form.html?requestId=${req.id}">Create lease</a>`;
    }
    return '';
  }

  /**
   * Request → lease created from it: same renter and unit, created after the approval.
   * Oldest approvals take the oldest leases first, and a lease is used once, so two approvals
   * of the same unit and renter with only one lease mark only one request.
   */
  function linkLeases(requests, leases) {
    const map = new Map();
    const used = new Set();
    const approved = requests.filter((r) => r.status === 'APPROVED' && r.unitId != null && r.decidedAt)
      .sort((a, b) => String(a.decidedAt).localeCompare(String(b.decidedAt)));
    const byAge = [...leases].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    for (const req of approved) {
      const lease = byAge.find((l) => !used.has(l.id) && l.unitId === req.unitId && l.renterId === req.renterId
        && String(l.createdAt) >= String(req.decidedAt).slice(0, 19));
      if (lease) {
        used.add(lease.id);
        map.set(req.id, lease);
      }
    }
    return map;
  }

  function cardHtml(req) {
    const who = isLandlord ? `<p class="text-sm text-slate-700"><span class="font-semibold">Renter:</span> ${esc(req.renterName)}</p>` : '';
    const note = req.message ? `<p class="text-sm text-slate-600 italic">“${esc(req.message)}”</p>` : '';
    const decided = req.decidedAt ? `<p class="text-xs text-slate-400">${esc(format.label(req.status))} on ${format.date(req.decidedAt)}</p>` : '';
    return `
      <article class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
        <div class="flex items-start justify-between gap-3">
          <h2 class="text-base font-bold text-slate-900">${esc(req.propertyName)} · ${esc(req.unitName)}</h2>
          ${leaseOf.has(req.id)
            ? '<span class="text-xs font-bold px-2.5 py-1 rounded-md bg-indigo-100 text-indigo-800">Lease created</span>'
            : `<span class="text-xs font-bold px-2.5 py-1 rounded-md ${BADGE[req.status] || BADGE.CANCELLED}">${esc(format.label(req.status))}</span>`}
        </div>
        ${who}
        ${req.unitRemoved
          ? '<p class="text-sm text-slate-500">This unit was removed by the owner.</p>'
          : `<p class="text-sm text-slate-700"><span class="font-semibold">Rent:</span> ${format.peso(req.monthlyRate)} / month</p>`}
        <p class="text-sm text-slate-700"><span class="font-semibold">Wants to start:</span> ${format.date(req.desiredStart)} for ${req.months} ${req.months === 1 ? 'month' : 'months'}
           (until ${format.date(req.suggestedEndDate)})</p>
        ${note}
        <p class="text-xs text-slate-400">Requested on ${format.date(req.createdAt)}</p>
        ${decided}
        <div class="flex flex-wrap gap-2 pt-1">${actionsHtml(req)}</div>
      </article>`;
  }

  function render() {
    const shown = filter === 'PENDING' ? all.filter((r) => r.status === 'PENDING') : all;
    list.innerHTML = shown.map(cardHtml).join('');
    empty.classList.toggle('hidden', shown.length > 0);
    empty.textContent = filter === 'PENDING' ? 'Nothing is waiting for a decision.'
      : isLandlord ? 'No one has asked to lease your units yet.'
      : 'You have not requested any space yet. Browse the available spaces to find one.';
    document.querySelectorAll('#filters [data-filter]').forEach((b) => {
      const on = b.dataset.filter === filter;
      b.classList.toggle('bg-indigo-600', on);
      b.classList.toggle('text-white', on);
      b.classList.toggle('bg-white', !on);
      b.classList.toggle('text-slate-700', !on);
    });
  }

  async function load() {
    error.textContent = '';
    try {
      const [requests, leases] = await Promise.all([api.get('/api/lease-requests'), api.get('/api/leases')]);
      all = requests;
      leaseOf = linkLeases(requests, leases);
      // PENDING first (they need a decision), then newest first
      all.sort((a, b) => (a.status === 'PENDING' ? 0 : 1) - (b.status === 'PENDING' ? 0 : 1)
        || String(b.createdAt).localeCompare(String(a.createdAt)));
      render();
    } catch (err) {
      error.textContent = err.message;
    }
  }

  document.getElementById('filters').addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]');
    if (button) { filter = button.dataset.filter; render(); }
  });

  list.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    button.disabled = true;
    try {
      await api.form('POST', `/api/lease-requests/${button.dataset.id}/${button.dataset.action}`);
      showToast(button.dataset.action === 'approve' ? 'Approved. You can now create the lease.' : 'Done.');
      if (button.dataset.action === 'approve') filter = 'all';      // so the "Create lease" button stays visible
    } catch (err) {
      showToast(err.message, true);          // e.g. "This unit is no longer available."
    }
    load();
  });

  filter = isLandlord ? 'PENDING' : 'all';     // a landlord opens straight onto what needs a decision
  load();
});
