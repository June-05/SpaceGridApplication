/*
 * renter-dashboard.js — script for renter/dashboard.html (the renter's "My Leases")
 *
 * 1. await auth.requireLogin('RENTER'), then GET /api/leases (own leases) and GET /api/lease-requests
 *    (PENDING ones → the amber "waiting for the owner" link). Per lease: GET /api/leases/{id}/statement.
 * 2. Tiles: active leases, next payment (earliest DUE / OVERDUE line of all leases), overdue months.
 * 3. Cards: "Current" (UPCOMING, ACTIVE, EXPIRING_SOON, EXPIRED) and "Past leases" (ENDED, TERMINATED, RENEWED).
 *    Image: the unit's photo (lease.imageUrl) or else the layout with this unit outlined
 *    (GET /api/leases/{id}/property → gridRenderer.thumbnail). Pay → /renter/pay.html?leaseId=&month= (oldest unpaid).
 *    Names come from landlords, so they go into the page through format.escape.
 * 4. The search box filters the cards in the browser.
 */
const $ = (id) => document.getElementById(id);

const RUNNING = ['UPCOMING', 'ACTIVE', 'EXPIRING_SOON', 'EXPIRED'];
const STATE_STYLE = {                       // same colors and labels as lease.js
  UPCOMING: 'bg-sky-100 text-sky-800', ACTIVE: 'bg-emerald-100 text-emerald-800', EXPIRING_SOON: 'bg-amber-100 text-amber-800',
  EXPIRED: 'bg-orange-100 text-orange-800', ENDED: 'bg-slate-100 text-slate-700', TERMINATED: 'bg-rose-100 text-rose-800',
  RENEWED: 'bg-violet-100 text-violet-800'
};
const STATE_LABEL = { EXPIRING_SOON: 'Expiring soon', EXPIRED: 'Ending today' };
const DUE_STYLE = { DUE: 'bg-amber-100 text-amber-800', OVERDUE: 'bg-rose-100 text-rose-800' };

let entries = [];                           // { lease, unpaid: [statement lines not PAID] }

document.addEventListener('DOMContentLoaded', async () => {
  await auth.requireLogin('RENTER');
  $('leaseSearchInput').addEventListener('input', applySearch);
  try {
    await load();
  } catch (err) {
    $('error').textContent = err.message;
  }
});

async function load() {
  const [leases, requests] = await Promise.all([api.get('/api/leases'), api.get('/api/lease-requests').catch(() => [])]);
  const pending = requests.filter((r) => r.status === 'PENDING').length;
  $('pendingCardText').textContent = `${pending} ${pending === 1 ? 'request is' : 'requests are'} waiting for the owner's answer`;
  $('pendingCard').classList.toggle('hidden', pending === 0);

  entries = await Promise.all(leases.map(async (lease) => {
    let statement = [];
    try { statement = await api.get(`/api/leases/${lease.id}/statement`); } catch (err) { /* card shows no amount */ }
    return { lease, unpaid: statement.filter((s) => s.status !== 'PAID') };
  }));
  renderTiles();
  renderCards();
}

function renderTiles() {
  const running = entries.filter((e) => RUNNING.includes(e.lease.currentState));
  $('tileActive').textContent = running.length;
  const lines = entries.flatMap((e) => e.unpaid.filter((s) => s.status === 'DUE' || s.status === 'OVERDUE').map((s) => ({ ...s, lease: e.lease })));
  lines.sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  const next = lines[0];
  $('tileNext').textContent = next ? format.peso(next.amountDue) : 'Nothing due';
  $('tileNextNote').textContent = next
    ? `${next.lease.propertyName} · ${next.lease.unitName} · ${next.status === 'OVERDUE' ? 'overdue since' : 'due'} ${format.date(next.dueDate)}`
    : 'You are all paid up.';
  const overdue = lines.filter((s) => s.status === 'OVERDUE').length;
  $('tileOverdue').textContent = overdue;
  $('tileOverdue').classList.toggle('text-rose-600', overdue > 0);
  $('tileOverdueBox').classList.toggle('border-rose-200', overdue > 0);
}

/** One line under the badge: what the state means for the renter. */
function stateLine(lease) {
  const days = lease.daysRemaining;
  switch (lease.currentState) {
    case 'UPCOMING': return `Starts on ${format.date(lease.startDate)}`;
    case 'ACTIVE': return `${days} ${days === 1 ? 'day' : 'days'} left`;
    case 'EXPIRING_SOON': return `Ends in ${days} ${days === 1 ? 'day' : 'days'} — ask the owner to renew`;
    case 'EXPIRED': return 'The end date has passed; it closes automatically';
    case 'ENDED': return `Ended on ${format.date(lease.closedOn)}`;
    case 'TERMINATED': return `Terminated: ${lease.terminationReason || 'no reason given'}`;
    case 'RENEWED': return `Renewed on ${format.date(lease.closedOn)}`;
    default: return '';
  }
}

function cardHtml({ lease, unpaid }) {
  const state = lease.currentState;
  const first = unpaid[0];
  const search = `${lease.propertyName} ${lease.unitName}`.toLowerCase();
  const image = lease.imageUrl
    ? `<img src="${lease.imageUrl}" alt="" class="absolute inset-0 w-full h-full object-cover">`
    : `<div data-thumb="${lease.id}" class="grid-thumb absolute inset-0 p-3"></div>
       <i data-placeholder="${lease.id}" class="fa-solid fa-image text-3xl text-slate-300"></i>`;
  const due = first
    ? `<div class="flex items-center justify-between text-xs">
         <span class="text-slate-500">Next due: <span class="font-bold text-slate-900">${format.peso(first.amountDue)}</span> · ${format.date(first.dueDate)}</span>
         ${DUE_STYLE[first.status] ? `<span class="font-bold px-2 py-0.5 rounded-md ${DUE_STYLE[first.status]}">${format.label(first.status)}</span>` : ''}
       </div>`
    : '<p class="text-xs text-emerald-700 font-semibold"><i class="fa-solid fa-check mr-1"></i>All paid</p>';
  const pay = first
    ? `<a href="/renter/pay.html?leaseId=${lease.id}&month=${first.billingMonth}" class="flex-1 py-2 text-center bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition">Pay ${format.peso(first.amountDue)}</a>`
    : '';
  return `
    <article data-lease-id="${lease.id}" data-search="${format.escape(search)}" class="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
      <div class="relative h-36 bg-slate-100 flex items-center justify-center">${image}</div>
      <div class="p-4 space-y-3 flex-1 flex flex-col">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 class="text-sm font-bold text-slate-900 truncate">${format.escape(lease.propertyName)}</h3>
            <p class="text-xs text-slate-500 truncate">${format.escape(lease.unitName)}</p>
          </div>
          <span class="flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md ${STATE_STYLE[state] || STATE_STYLE.ENDED}">${STATE_LABEL[state] || format.label(state)}</span>
        </div>
        <p class="text-xs text-slate-600">${format.escape(stateLine(lease))}</p>
        ${due}
        <div class="flex items-center gap-2 pt-1 mt-auto">
          <a href="/lease.html?id=${lease.id}" class="flex-1 py-2 text-center bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition">View lease</a>
          ${pay}
        </div>
      </div>
    </article>`;
}

function renderCards() {
  const current = entries.filter((e) => RUNNING.includes(e.lease.currentState));
  const past = entries.filter((e) => !RUNNING.includes(e.lease.currentState));
  $('emptyState').classList.toggle('hidden', entries.length > 0);
  $('currentSection').classList.toggle('hidden', entries.length === 0);
  $('leases').innerHTML = current.map(cardHtml).join('');
  $('noCurrent').classList.toggle('hidden', current.length > 0 || entries.length === 0);
  $('pastSection').classList.toggle('hidden', past.length === 0);
  $('pastCount').textContent = past.length;
  $('pastLeases').innerHTML = past.map(cardHtml).join('');
  drawLayouts();
}

/** Cards without a unit photo: the property's layout with this renter's unit outlined. */
function drawLayouts() {
  document.querySelectorAll('[data-thumb]').forEach(async (box) => {
    const id = Number(box.dataset.thumb);
    const entry = entries.find((e) => e.lease.id === id);
    try {
      const layout = gridRenderer.fromProperty(await api.get(`/api/leases/${id}/property`));
      if (!gridRenderer.hasSpots(layout) || !box.isConnected) return;
      gridRenderer.thumbnail(box, layout, { highlightZoneId: entry.lease.unitId, fallbackWidth: 320, fallbackHeight: 120 });
      const icon = document.querySelector(`[data-placeholder="${id}"]`);
      if (icon) icon.remove();
    } catch (err) { /* keep the plain placeholder */ }
  });
}

function applySearch() {
  const query = $('leaseSearchInput').value.trim().toLowerCase();
  let shown = 0;
  document.querySelectorAll('[data-lease-id]').forEach((card) => {
    const match = !query || card.dataset.search.includes(query);
    card.classList.toggle('hidden', !match);
    if (match) shown++;
  });
  if (query && shown > 0) $('pastSection').open = true;       // matches in the past section are visible too
  $('noMatch').classList.toggle('hidden', !query || shown > 0 || entries.length === 0);
}
