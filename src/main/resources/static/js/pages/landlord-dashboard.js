/*
 * landlord-dashboard.js — script for landlord/dashboard.html (the landlord's portfolio)
 *
 * 1. Load: GET /api/properties (each with its zones, so units can be counted) and GET /api/leases.
 *    Per property: units (not archived), leased = OCCUPIED units, occupancy %, monthly income = rent of its ACTIVE leases.
 * 2. Search, type checkboxes, minimum occupancy, "Published only" and sorting run in the browser; 6 cards per page.
 * 3. Click a card → modal with links to units.html?propertyId=, property-grid.html?id=, property-form.html?id=,
 *    leases.html?propertyId=, and Publish / Archive (POST /api/properties/{id}/publish | /archive).
 */
const $ = (id) => document.getElementById(id);

const TYPE_LABELS = {
  APARTMENT: 'Apartment', CONDOMINIUM: 'Condominium', TOWNHOUSE: 'Townhouse',
  COMMERCIAL: 'Commercial Lot', NIGHT_MARKET: 'Night Market', OPEN_SPACE: 'Open Space / Plaza'
};
const STATUS_BADGE = {                      // property status → badge text and color
  ACTIVE: ['Active', 'bg-emerald-500'], DRAFT: ['Draft', 'bg-amber-500'], ARCHIVED: ['Archived', 'bg-slate-500']
};
const ITEMS_PER_PAGE = 6;

let portfolio = [];        // one entry per property: { property, units, leased, occupancy, revenue }
let filtered = [];
let currentPage = 1;
let openId = null;         // property shown in the modal

document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.requireLogin('LANDLORD');
  showUser(user);
  buildTypeFilters();
  setupControls();
  await loadPortfolio();
});

function showUser(user) {
  $('userFullName').textContent = user.fullName;
  $('userShortName').textContent = user.fullName.split(' ')[0];
  $('userInitials').textContent = user.fullName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

/** One checkbox per property type (all ticked), with a count next to it. */
function buildTypeFilters() {
  $('typeFilters').innerHTML = Object.entries(TYPE_LABELS).map(([type, label]) => `
    <label class="flex items-center justify-between group cursor-pointer">
      <div class="flex items-center gap-2.5">
        <input type="checkbox" value="${type}" checked class="filter-type w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300">
        <span class="text-sm text-slate-700 font-medium">${label}</span>
      </div>
      <span id="count-${type}" class="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-semibold">0</span>
    </label>`).join('');
}

async function loadPortfolio() {
  const [properties, leases] = await Promise.all([api.get('/api/properties'), api.get('/api/leases')]);
  portfolio = properties.map((property) => {
    const units = property.zones.filter((z) => z.rentable && z.status !== 'ARCHIVED');
    const leased = units.filter((u) => u.status === 'OCCUPIED').length;
    const revenue = leases
      .filter((l) => l.propertyId === property.id && l.status === 'ACTIVE')
      .reduce((sum, l) => sum + Number(l.monthlyRent), 0);
    return { property, units: units.length, leased, revenue,
             occupancy: units.length ? Math.round((leased / units.length) * 100) : 0 };
  });
  for (const type of Object.keys(TYPE_LABELS)) {
    $(`count-${type}`).textContent = portfolio.filter((p) => p.property.propertyType === type).length;
  }
  $('totalOwnedHeader').textContent = `${portfolio.length} total owned ${portfolio.length === 1 ? 'property' : 'properties'}`;
  applyFilters();
}

function setupControls() {
  $('occupancySlider').addEventListener('input', (e) => { $('sliderValueBadge').textContent = `${e.target.value}% / 100%`; });
  $('applyFiltersBtn').addEventListener('click', applyFilters);
  $('resetFiltersBtn').addEventListener('click', resetAllFilters);
  $('searchBtn').addEventListener('click', applyFilters);
  $('searchInput').addEventListener('keyup', (e) => { if (e.key === 'Enter') applyFilters(); });
  $('sortSelect').addEventListener('change', applyFilters);
  $('activeToggle').addEventListener('change', applyFilters);
  $('typeFilters').addEventListener('change', applyFilters);

  // user menu
  $('userDropdownBtn').addEventListener('click', (e) => { e.stopPropagation(); $('userMenu').classList.toggle('hidden'); });
  $('userMenu').addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', () => $('userMenu').classList.add('hidden'));

  $('propertiesGrid').addEventListener('click', (e) => {
    const card = e.target.closest('[data-property-id]');
    if (card && !e.target.closest('a')) openManageModal(Number(card.dataset.propertyId));
  });
  $('modalPublishBtn').addEventListener('click', () => changeStatus('publish'));
  $('modalArchiveBtn').addEventListener('click', () => changeStatus('archive'));
}

function applyFilters() {
  const search = $('searchInput').value.trim().toLowerCase();
  const minOccupancy = Number($('occupancySlider').value);
  const publishedOnly = $('activeToggle').checked;
  const types = [...document.querySelectorAll('.filter-type:checked')].map((cb) => cb.value);
  const sortBy = $('sortSelect').value;

  filtered = portfolio.filter(({ property, occupancy }) => {
    const text = `${property.name} ${property.fullAddress} SG-PROP-${property.id}`.toLowerCase();
    return (!search || text.includes(search))
      && types.includes(property.propertyType)
      && occupancy >= minOccupancy
      && (!publishedOnly || property.status === 'ACTIVE');
  });
  filtered.sort((a, b) => {
    if (sortBy === 'revenue-desc') return b.revenue - a.revenue;
    if (sortBy === 'occupancy-desc') return b.occupancy - a.occupancy;
    if (sortBy === 'occupancy-asc') return a.occupancy - b.occupancy;
    return String(b.property.createdAt).localeCompare(String(a.property.createdAt));   // 'recent'
  });

  $('pillTypes').textContent = types.length === Object.keys(TYPE_LABELS).length ? 'Type: All'
    : types.length === 0 ? 'Type: None' : 'Type: ' + types.map((t) => TYPE_LABELS[t]).join(', ');
  $('pillOccupancy').textContent = `Min. Occupancy: ≥ ${minOccupancy}%`;
  currentPage = 1;
  renderProperties();
  renderPagination();
}

function resetAllFilters() {
  $('searchInput').value = '';
  $('sortSelect').value = 'revenue-desc';
  $('occupancySlider').value = '0';
  $('sliderValueBadge').textContent = '0% / 100%';
  $('activeToggle').checked = false;
  document.querySelectorAll('.filter-type').forEach((cb) => { cb.checked = true; });
  applyFilters();
}

function renderProperties() {
  const grid = $('propertiesGrid');
  const empty = filtered.length === 0;
  $('emptyState').classList.toggle('hidden', !empty);
  $('paginationContainer').style.display = empty ? 'none' : 'flex';
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  grid.innerHTML = filtered.slice(start, start + ITEMS_PER_PAGE).map(cardHtml).join('');
}

function cardHtml({ property, units, leased, occupancy, revenue }) {
  const [statusText, statusColor] = STATUS_BADGE[property.status];
  const photo = property.coverPhotoUrl ? `background-image: url('${property.coverPhotoUrl}'); background-size: cover; background-position: center;` : '';
  const color = occupancy >= 90 ? 'emerald' : occupancy >= 70 ? 'amber' : 'rose';
  return `
    <div data-property-id="${property.id}" class="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition cursor-pointer">
      <div class="h-36 bg-gradient-to-br from-slate-700 to-slate-900 relative" style="${photo}">
        <div class="absolute inset-0 bg-black/30"></div>
        <div class="absolute top-3 left-3">
          <span class="bg-white/90 text-slate-900 text-xs font-bold px-2.5 py-1 rounded-md">${TYPE_LABELS[property.propertyType]}</span>
        </div>
        <div class="absolute top-3 right-3">
          <span class="${statusColor} text-white text-xs font-semibold px-2.5 py-1 rounded-md">${statusText}</span>
        </div>
        ${property.coverPhotoUrl ? '' : '<i class="fa-solid fa-image absolute inset-0 m-auto w-fit h-fit text-3xl text-white/30"></i>'}
      </div>
      <div class="p-4 space-y-3">
        <div>
          <h3 class="font-bold text-slate-900 text-sm line-clamp-1">${format.escape(property.name)}</h3>
          <p class="text-xs text-slate-500 mt-0.5"><i class="fa-solid fa-location-dot text-slate-400 mr-1"></i>${format.escape(property.city)}, ${format.escape(property.region)}</p>
        </div>
        <div class="flex items-center justify-between text-xs">
          <div>
            <p class="text-slate-400 font-medium">Monthly Income</p>
            <p class="text-slate-900 font-bold">${format.peso(revenue)}</p>
          </div>
          <div class="text-right">
            <p class="text-slate-400 font-medium">Occupancy (${leased}/${units} units)</p>
            <p class="text-${color}-600 font-bold">${occupancy}%</p>
          </div>
        </div>
        <div class="w-full bg-slate-100 rounded-full h-1.5">
          <div class="bg-indigo-600 h-1.5 rounded-full" style="width: ${occupancy}%"></div>
        </div>
        <a href="units.html?propertyId=${property.id}" class="block w-full text-center py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition border border-slate-200">
          Manage Property
        </a>
      </div>
    </div>`;
}

function renderPagination() {
  const total = filtered.length;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE) || 1;
  $('showingStart').textContent = total === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  $('showingEnd').textContent = Math.min(currentPage * ITEMS_PER_PAGE, total);
  $('showingTotal').textContent = total;

  const buttons = $('paginationButtons');
  buttons.innerHTML = '';
  const add = (html, page, disabled, active) => {
    const b = document.createElement('button');
    b.className = `px-3 py-1.5 text-xs font-semibold rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed ${active ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`;
    b.innerHTML = html;
    b.disabled = disabled;
    b.onclick = () => { currentPage = page; renderProperties(); renderPagination(); };
    buttons.appendChild(b);
  };
  add('<i class="fa-solid fa-chevron-left mr-1"></i> Previous', currentPage - 1, currentPage === 1);
  for (let i = 1; i <= totalPages; i++) add(String(i), i, false, i === currentPage);
  add('Next <i class="fa-solid fa-chevron-right ml-1"></i>', currentPage + 1, currentPage === totalPages);
}

function openManageModal(propertyId) {
  const entry = portfolio.find((p) => p.property.id === propertyId);
  if (!entry) return;
  const { property, units, leased, occupancy, revenue } = entry;
  openId = propertyId;
  const leaseText = occupancy >= 100 ? 'Fully Leased' : occupancy >= 70 ? 'Partially Leased' : 'Low Occupancy';
  const leaseColor = occupancy >= 100 ? 'bg-emerald-500' : occupancy >= 70 ? 'bg-amber-500' : 'bg-rose-500';

  $('modalTypeBadge').textContent = TYPE_LABELS[property.propertyType];
  $('modalTitle').textContent = property.name;
  $('modalLocation').innerHTML = '<i class="fa-solid fa-location-dot text-slate-400 mr-1"></i>' + format.escape(property.fullAddress);
  $('modalRevenue').textContent = format.peso(revenue);
  $('modalLeased').textContent = `${leased} / ${units} Units (${occupancy}%)`;
  $('modalOperating').textContent = STATUS_BADGE[property.status][0];
  $('modalPropId').textContent = `SG-PROP-${String(property.id).padStart(2, '0')}`;
  $('modalStatusBadge').className = `inline-flex items-center gap-1.5 ${leaseColor} text-white font-semibold text-xs px-2.5 py-1 rounded-md shadow-xs`;
  $('modalStatusText').textContent = leaseText;
  $('modalHeader').style.backgroundImage = property.coverPhotoUrl ? `url('${property.coverPhotoUrl}')` : '';
  $('modalHeader').style.backgroundSize = 'cover';
  $('modalHeader').style.backgroundPosition = 'center';

  $('modalUnitsLink').href = `units.html?propertyId=${property.id}`;
  $('modalGridLink').href = `property-grid.html?id=${property.id}`;
  $('modalEditLink').href = `property-form.html?id=${property.id}`;
  $('modalLeasesLink').href = `leases.html?propertyId=${property.id}`;
  $('modalPublishBtn').classList.toggle('hidden', property.status !== 'DRAFT');
  $('modalArchiveBtn').classList.toggle('hidden', property.status === 'ARCHIVED');
  $('modalError').classList.add('hidden');
  $('manageModal').classList.remove('hidden');
}

function closeManageModal() {
  $('manageModal').classList.add('hidden');
}

/** Publish (DRAFT → ACTIVE) or archive; 409 errors (e.g. "Unit 101 has an active lease...") are shown in the modal. */
async function changeStatus(action) {
  if (action === 'archive' && !confirm('Archive this property? It leaves the homepage and can no longer be edited.')) return;
  try {
    await api.form('POST', `/api/properties/${openId}/${action}`);
    await loadPortfolio();
    openManageModal(openId);
  } catch (err) {
    $('modalError').textContent = err.message;
    $('modalError').classList.remove('hidden');
  }
}
