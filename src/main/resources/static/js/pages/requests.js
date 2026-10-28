/*
 * requests.js — script for requests.html (both roles)
 *
 * 1. const user = await auth.requireLogin();                      // any role
 * 2. const requests = await api.get('/api/lease-requests');       // renter: own requests · landlord: incoming requests
 *    Each request: id, unitId, renterId, desiredStart, months, message, status, decidedAt, createdAt,
 *                  propertyId, unitName, propertyName, renterName, monthlyRate, suggestedEndDate
 * 3. Buttons call (api.form, no fields):
 *      renter,   PENDING  → POST /api/lease-requests/{id}/cancel
 *      landlord, PENDING  → POST /api/lease-requests/{id}/approve  or  /decline
 *    then the list is loaded again.
 * 4. A landlord's APPROVED request shows "Create lease", which opens the lease form:
 *      /landlord/lease-form.html?requestId={id}   (lease-form.js can use it to fill in the renter and the dates)
 */
document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.requireLogin();
  const isLandlord = user.role === 'LANDLORD';

  const list = document.getElementById('requests');
  const error = document.getElementById('error');
  const empty = document.getElementById('empty');

  document.getElementById('dashboardLink').href = auth.home(user);
  document.getElementById('btnLogout').onclick = () => auth.logout();
  document.getElementById('subtitle').textContent = isLandlord ? 'Landlord Workspace' : 'Renter Workspace';
  document.getElementById('heading').textContent = isLandlord ? 'Requests for my properties' : 'My lease requests';

  /** Escape text before putting it into innerHTML (names and messages come from users). */
  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function showToast(text, isError) {
    const toast = document.getElementById('toast');
    toast.textContent = text;
    toast.classList.toggle('is-error', Boolean(isError));
    toast.classList.add('is-visible');
    setTimeout(() => toast.classList.remove('is-visible'), 3000);
  }

  function actionsHtml(req) {
    if (req.status === 'PENDING') {
      return isLandlord
        ? `<button class="btn btn-primary" data-action="approve" data-id="${req.id}" type="button">Approve</button>
           <button class="btn" data-action="decline" data-id="${req.id}" type="button">Decline</button>`
        : `<button class="btn" data-action="cancel" data-id="${req.id}" type="button">Cancel request</button>`;
    }
    if (isLandlord && req.status === 'APPROVED') {
      return `<a class="btn btn-primary" href="/landlord/lease-form.html?requestId=${req.id}">Create lease</a>`;
    }
    return '';
  }

  function cardHtml(req) {
    const who = isLandlord ? `<p><strong>Renter:</strong> ${esc(req.renterName)}</p>` : '';
    const note = req.message ? `<p class="request-message">“${esc(req.message)}”</p>` : '';
    const decided = req.decidedAt ? `<p class="subtitle">${esc(format.label(req.status))} on ${format.date(req.decidedAt)}</p>` : '';
    return `
      <article class="card request-card">
        <div class="lease-header">
          <h2>${esc(req.propertyName)} · ${esc(req.unitName)}</h2>
          ${format.badge('request-', req.status)}
        </div>
        ${who}
        <p><strong>Rent:</strong> ${format.peso(req.monthlyRate)} / month</p>
        <p><strong>Wants to start:</strong> ${format.date(req.desiredStart)} for ${req.months} ${req.months === 1 ? 'month' : 'months'}
           (until ${format.date(req.suggestedEndDate)})</p>
        ${note}
        <p class="subtitle">Requested on ${format.date(req.createdAt)}</p>
        ${decided}
        <div class="card-actions">${actionsHtml(req)}</div>
      </article>`;
  }

  async function load() {
    error.textContent = '';
    try {
      const requests = await api.get('/api/lease-requests');
      list.innerHTML = requests.map(cardHtml).join('');
      empty.hidden = requests.length > 0;
      empty.textContent = isLandlord
        ? 'No one has asked to lease your units yet.'
        : 'You have not requested any space yet. Browse the available spaces to find one.';
    } catch (err) {
      error.textContent = err.message;
    }
  }

  list.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    button.disabled = true;
    try {
      await api.form('POST', `/api/lease-requests/${button.dataset.id}/${button.dataset.action}`);
      showToast('Done.');
    } catch (err) {
      showToast(err.message, true);          // e.g. "This unit is no longer available."
    }
    load();
  });

  load();
});
