/*
 * leases.js — script for landlord/leases.html (?propertyId= shows one property's leases)
 *
 * 1. Load: GET /api/leases (all leases on my properties) or GET /api/properties/{id}/leases,
 *    and GET /api/lease-requests for the "Pending Requests" count.
 * 2. Payment status per lease, from its statement (GET /api/leases/{id}/statement):
 *    any OVERDUE period → Overdue; else any DUE → Pending; else Paid.
 * 3. Lease Status = lease.currentState (UPCOMING, ACTIVE, EXPIRING_SOON, EXPIRED = "Ending today", ENDED, TERMINATED, RENEWED).
 *    Filter "Ended automatically" = ENDED with endedAutomatically (LeaseExpiryJob closed it after its end date).
 * 4. Row actions: details modal (with the contract PDF from GET /api/leases/{id}/files),
 *    renew → lease-form.html?renew={id}, terminate (dialog with a reason) → POST /api/leases/{id}/terminate { reason }. Full page: /lease.html?id=
 */
const $ = (id) => document.getElementById(id);

const STATE_STYLE = {
  UPCOMING: 'bg-sky-100 text-sky-700', ACTIVE: 'bg-emerald-100 text-emerald-700',
  EXPIRING_SOON: 'bg-amber-100 text-amber-700', EXPIRED: 'bg-orange-100 text-orange-700',
  ENDED: 'bg-slate-100 text-slate-700', TERMINATED: 'bg-rose-100 text-rose-700', RENEWED: 'bg-violet-100 text-violet-700'
};
const PAYMENT_STYLE = {
  PAID: ['Paid', 'bg-emerald-100 text-emerald-700'],
  PENDING: ['Pending', 'bg-amber-100 text-amber-700'],
  OVERDUE: ['Overdue', 'bg-rose-100 text-rose-700']
};
const TERMS_LABEL = {
  MONTHLY_ADVANCE: 'Monthly in advance', MONTHLY_ARREARS: 'Monthly in arrears', QUARTERLY_ADVANCE: 'Quarterly in advance',
  SEMI_ANNUAL_ADVANCE: 'Semi-annual in advance', ANNUAL_ADVANCE: 'Annual in advance'
};
const ITEMS_PER_PAGE = 5;
const propertyId = Number(new URLSearchParams(location.search).get('propertyId')) || null;

let leases = [];
let filteredLeases = [];
let currentPage = 1;

const badge = (text, style) =>
  `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${style}">${text}</span>`;
const stateBadge = (state) => badge(state === 'EXPIRED' ? 'Ending today' : format.label(state), STATE_STYLE[state]);
const paymentBadge = (status) => badge(PAYMENT_STYLE[status][0], PAYMENT_STYLE[status][1]);

document.addEventListener('DOMContentLoaded', async () => {
  await auth.requireLogin('LANDLORD');
  ['searchInput', 'globalSearch'].forEach((id) => $(id).addEventListener('input', (e) => {
    $('searchInput').value = $('globalSearch').value = e.target.value;      // the two search boxes stay in step
    applyFilters();
  }));
  ['statusFilter', 'paymentFilter', 'sortBy'].forEach((id) => $(id).addEventListener('change', applyFilters));
  $('prevPage').addEventListener('click', () => { currentPage--; renderTable(); });
  $('nextPage').addEventListener('click', () => { currentPage++; renderTable(); });
  $('terminateForm').addEventListener('submit', submitTerminate);
  await loadLeases();
});

async function loadLeases() {
  const [list, requests] = await Promise.all([
    api.get(propertyId ? `/api/properties/${propertyId}/leases` : '/api/leases'),
    api.get('/api/lease-requests')
  ]);
  // one statement per lease, all at once
  const statements = await Promise.all(list.map((l) => api.get(`/api/leases/${l.id}/statement`)));
  leases = list.map((lease, i) => ({ ...lease, paymentStatus: paymentStatusOf(statements[i]) }));

  if (propertyId) {
    $('propertyPill').textContent = leases.length ? `Property: ${leases[0].propertyName}` : 'This property has no leases yet';
    $('propertyPill').classList.remove('hidden');
  }
  const running = leases.filter((l) => ['ACTIVE', 'EXPIRING_SOON'].includes(l.currentState));
  $('metricActive').textContent = running.length;
  $('metricCollections').textContent = format.peso(running.reduce((sum, l) => sum + Number(l.monthlyRent), 0));
  $('metricExpiring').textContent = leases.filter((l) => l.currentState === 'EXPIRING_SOON').length;
  $('metricPending').textContent = requests.filter((r) => r.status === 'PENDING').length;
  applyFilters();
}

function paymentStatusOf(statement) {
  if (statement.some((s) => s.status === 'OVERDUE')) return 'OVERDUE';
  if (statement.some((s) => s.status === 'DUE')) return 'PENDING';
  return 'PAID';
}

function applyFilters() {
  const search = $('searchInput').value.trim().toLowerCase();
  const state = $('statusFilter').value;
  const payment = $('paymentFilter').value;
  const sortBy = $('sortBy').value;
  filteredLeases = leases.filter((l) =>
    (!search || `${l.tenantName} ${l.renterUsername} ${l.propertyName} ${l.unitName}`.toLowerCase().includes(search))
    && (state === 'all' || l.currentState === state || (state === 'ENDED_AUTO' && l.currentState === 'ENDED' && l.endedAutomatically)
      || (state === 'MOVE_OUT' && l.awaitingMoveOut))
    && (payment === 'all' || l.paymentStatus === payment));
  filteredLeases.sort((a, b) => {
    if (sortBy === 'expiring') return String(a.endDate).localeCompare(String(b.endDate));
    if (sortBy === 'rent-high') return b.monthlyRent - a.monthlyRent;
    if (sortBy === 'rent-low') return a.monthlyRent - b.monthlyRent;
    return String(b.createdAt).localeCompare(String(a.createdAt));          // 'recent'
  });
  currentPage = 1;
  renderTable();
}

function renderTable() {
  const total = filteredLeases.length;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE) || 1;
  currentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  $('emptyState').classList.toggle('hidden', total > 0);
  $('showingStart').textContent = total ? start + 1 : 0;
  $('showingEnd').textContent = Math.min(start + ITEMS_PER_PAGE, total);
  $('showingTotal').textContent = total;

  $('leaseTableBody').innerHTML = filteredLeases.slice(start, start + ITEMS_PER_PAGE).map((lease) => {
    const initials = lease.tenantName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
    const active = lease.status === 'ACTIVE';
    return `
      <tr class="hover:bg-slate-50/50 transition">
        <td class="px-6 py-4">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <span class="text-xs font-bold text-indigo-600">${format.escape(initials)}</span>
            </div>
            <div>
              <p class="text-sm font-semibold text-slate-900">${format.escape(lease.tenantName)}</p>
              <p class="text-xs text-slate-500">${format.escape(lease.tenantEmail || lease.renterUsername)}</p>
            </div>
          </div>
        </td>
        <td class="px-6 py-4">
          <a href="units.html?propertyId=${lease.propertyId}" class="block hover:opacity-80 transition">
            <p class="text-sm font-medium text-slate-900">${format.escape(lease.propertyName)}</p>
            <p class="text-xs text-slate-500">${format.escape(lease.unitName)}</p>
          </a>
        </td>
        <td class="px-6 py-4"><p class="text-sm text-slate-700">${format.date(lease.startDate)} - ${format.date(lease.endDate)}</p></td>
        <td class="px-6 py-4"><p class="text-sm font-semibold text-slate-900">${format.peso(lease.monthlyRent)}</p></td>
        <td class="px-6 py-4">${paymentBadge(lease.paymentStatus)}</td>
        <td class="px-6 py-4">${stateBadge(lease.currentState)}</td>
        <td class="px-6 py-4 text-right">
          <div class="flex items-center justify-end gap-1">
            <button onclick="viewLease(${lease.id})" class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition" title="View">
              <i class="fa-solid fa-eye text-sm"></i>
            </button>
            <a href="/lease.html?id=${lease.id}" class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Statement">
              <i class="fa-solid fa-receipt text-sm"></i>
            </a>
            ${active ? `
            <a href="lease-form.html?renew=${lease.id}" class="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Renew">
              <i class="fa-solid fa-rotate text-sm"></i>
            </a>
            <button onclick="terminateLease(${lease.id})" class="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Terminate">
              <i class="fa-solid fa-ban text-sm"></i>
            </button>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');

  $('prevPage').disabled = currentPage === 1;
  $('nextPage').disabled = currentPage === totalPages;
  $('pageNumbers').innerHTML = '';
  for (let i = 1; i <= totalPages; i++) {
    const b = document.createElement('button');
    b.className = `px-3 py-1.5 text-xs font-semibold rounded-lg transition ${currentPage === i ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`;
    b.textContent = i;
    b.onclick = () => { currentPage = i; renderTable(); };
    $('pageNumbers').appendChild(b);
  }
}

async function viewLease(id) {
  const lease = leases.find((l) => l.id === id);
  if (!lease) return;
  $('modalTenant').textContent = `${lease.tenantName} (${lease.renterUsername})`;
  $('modalEmail').textContent = lease.tenantEmail || '—';
  $('modalPhone').textContent = lease.tenantPhone || '—';
  $('modalProperty').textContent = lease.propertyName;
  $('modalUnit').textContent = lease.unitName;
  $('modalTerm').textContent = `${format.date(lease.startDate)} - ${format.date(lease.endDate)}`;
  $('modalRent').textContent = format.peso(lease.monthlyRent);
  $('modalPaymentTerms').textContent = TERMS_LABEL[lease.paymentTerms];
  $('modalStatus').innerHTML = stateBadge(lease.currentState);
  $('modalStatusNote').textContent = lease.currentState === 'TERMINATED' ? `Reason: ${lease.terminationReason || 'not given'}`
    : lease.endedAutomatically ? `Ended automatically on ${format.date(lease.closedOn)}` : '';
  if (lease.awaitingMoveOut) $('modalStatusNote').textContent += ' · Waiting for the move-out confirmation (open Statement & Actions)';
  $('modalPayment').innerHTML = paymentBadge(lease.paymentStatus);
  $('modalLeaseLink').href = `/lease.html?id=${lease.id}`;

  const contract = (await api.get(`/api/leases/${lease.id}/files`))[0];
  const link = $('modalContractLink');
  if (contract) {
    link.href = contract.url;
    link.textContent = 'Open Signed Copy (PDF)';
    link.classList.remove('opacity-50', 'pointer-events-none');
  } else {
    link.removeAttribute('href');
    link.textContent = 'No signed copy yet';
    link.classList.add('opacity-50', 'pointer-events-none');
  }
  $('leaseModal').classList.remove('hidden');
}

function closeLeaseModal() {
  $('leaseModal').classList.add('hidden');
}

/** Early end: opens the dialog; the reason is required (the renter sees it). */
let terminatingId = null;
function terminateLease(id) {
  const lease = leases.find((l) => l.id === id);
  terminatingId = id;
  $('terminateTitle').textContent = `Terminate the lease of ${lease.tenantName} on ${lease.unitName} today?`;
  $('terminateReason').value = '';
  $('terminateError').textContent = '';
  $('terminateDialog').classList.remove('hidden');
  $('terminateReason').focus();
}

function closeTerminate() {
  $('terminateDialog').classList.add('hidden');
}

/** The lease becomes TERMINATED (with the reason) and the unit AVAILABLE again. */
async function submitTerminate(e) {
  e.preventDefault();
  const reason = $('terminateReason').value.trim();
  if (!reason) {
    $('terminateError').textContent = 'Write a reason. The renter will see it.';
    return;
  }
  try {
    await api.form('POST', `/api/leases/${terminatingId}/terminate`, { reason });
    closeTerminate();
    await loadLeases();
  } catch (err) {
    $('terminateError').textContent = err.message;
  }
}
