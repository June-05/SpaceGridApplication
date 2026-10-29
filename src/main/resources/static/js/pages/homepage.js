/*
 * homepage.js — script for homepage.html (the public "browse spaces to rent" page)
 *
 * 1. GET /api/browse (BrowseController.list) → every ACTIVE property that has free units (AVAILABLE).
 *    Each listing: id, name, address, propertyType, description, landlordName, createdAt,
 *                  availableBlocks, minRate, maxRate, powerIncluded, waterIncluded, units[]
 * 2. Search / filter / sort / pagination all happen here in the browser, on that list.
 * 3. GET /api/auth/me is called with plain fetch (not auth.requireLogin) because this page is public:
 *    a 401 just means "guest". The top bar (links, bell, Log Out / Log in) is js/common/nav.js in public mode.
 * 4. A logged-in renter can send a lease request: POST /api/lease-requests (LeaseRequestController.create)
 *    with the form fields unitId, startDate, months, message.
 *    The renter needs an email and a phone on the account: the form shows both (filled from the account) and
 *    saves them first with PUT /api/auth/me/contact when they changed (the server also refuses a request without them).
 * 5. "Saved" spaces are only remembered in this browser (localStorage). They are not stored in the database.
 * 5b. Layouts: GET /api/browse/{id}/layout (public; the grid and which units are free) is loaded only for the cards
 *     on the current page (cached by id). Cards show it as a small inset on the photo (or the whole image area),
 *     free units bright. The details window shows a bigger map; a renter clicks a free unit to pick it.
 * 6. /?space=ID opens that space's details window (used to come back after logging in).
 */
const ITEMS_PER_PAGE = 6;
const SAVED_KEY = 'spacegrid.savedSpaces';

const TYPE_LABELS = {
  APARTMENT: 'Apartment',
  CONDOMINIUM: 'Condominium',
  TOWNHOUSE: 'Townhouse',
  COMMERCIAL: 'Commercial',
  NIGHT_MARKET: 'Night Market',
  OPEN_SPACE: 'Open Space'
};

let listings = [];            // everything from /api/browse
let filtered = [];            // after search + filters + sort
let currentPage = 1;
let me = null;                // the logged-in user, or null for a guest
let savedIds = loadSaved();   // ids of the saved spaces
let savedOnly = false;        // "Saved" button: show only the saved spaces
let openListing = null;       // the space shown in the details window
const layouts = new Map();    // property id → its layout (GET /api/browse/{id}/layout), or null when it failed
let modalLayout = null;       // the layout drawn in the details window (cell → zone id, for clicks)
let selectedUnitId = null;    // the unit picked in the details window

const $ = (id) => document.getElementById(id);

/* ---------- small helpers ---------- */

/** Escape text before putting it into innerHTML (names and messages come from users). */
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function peso(amount) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 })
    .format(Number(amount || 0));
}

function rentRange(item) {
  return item.minRate === item.maxRate ? peso(item.minRate) : `${peso(item.minRate)} – ${peso(item.maxRate)}`;
}

function sizeText(dimensions) {
  if (!dimensions) return 'Size not given';
  return dimensions.exact ? `${Number(dimensions.areaSqm)} sqm` : `Approx. ${dimensions.description}`;
}

/** "Power & water", "Power", "Water" or "Not included". */
function utilitiesText(hasPower, hasWater) {
  if (hasPower && hasWater) return 'Power & water';
  if (hasPower) return 'Power';
  if (hasWater) return 'Water';
  return 'Not included';
}

/** "Amenities: Parking, Security." from the property form's checkboxes, or '' when none are ticked. */
function amenitiesText(amenities) {
  const names = { parking: 'Parking', powerBackup: 'Power backup', security: 'Security', waterAccess: 'Water access', open24h: '24/7 access' };
  const list = Object.keys(names).filter((key) => amenities && amenities[key]).map((key) => names[key]);
  return list.length ? `Amenities: ${list.join(', ')}.` : '';
}

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add('hidden'), 3500);
}

/* localStorage can be blocked (private window), so every use is wrapped in try/catch */
function loadSaved() {
  try {
    const ids = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
    return Array.isArray(ids) ? ids : [];
  } catch (err) {
    return [];
  }
}

function persistSaved() {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(savedIds));
  } catch (err) {
    // not remembered after a reload, but still works until then
  }
}

function toggleSaved(id) {
  savedIds = savedIds.includes(id) ? savedIds.filter((x) => x !== id) : [...savedIds, id];
  persistSaved();
  updateSavedUi();
  if (savedOnly) applyFilters(); else renderProperties();
}

function updateSavedUi() {
  $('savedCount').textContent = savedIds.length;
  $('savedBtn').classList.toggle('bg-rose-50', savedOnly);
  $('savedBtn').classList.toggle('text-rose-600', savedOnly);
  if (openListing) updateModalSaveButton();
}

/* ---------- who is logged in ---------- */

async function loadMe() {
  try {
    const res = await fetch('/api/auth/me');
    me = res.ok ? await res.json() : null;
  } catch (err) {
    me = null;
  }
}

/* ---------- loading the listings ---------- */

async function loadListings() {
  try {
    listings = await api.get('/api/browse');
  } catch (err) {
    listings = [];
    $('loadError').textContent = err.message;
    $('loadError').classList.remove('hidden');
  }
  setupSlider();
  updateCategoryBadges();
  applyFilters();
}

/** The slider goes from 0 to the biggest number of free units any space has. */
function setupSlider() {
  const max = Math.max(1, ...listings.map((l) => l.availableBlocks));
  $('blocksSlider').max = max;
  $('blocksSlider').value = 0;
  $('sliderMidLabel').textContent = Math.round(max / 2);
  $('sliderMaxLabel').textContent = `${max} units`;
  updateSliderBadge();
}

function updateSliderBadge() {
  $('sliderValueBadge').textContent = `${$('blocksSlider').value} / ${$('blocksSlider').max}`;
}

function updateCategoryBadges() {
  document.querySelectorAll('[data-count]').forEach((badge) => {
    badge.textContent = listings.filter((l) => l.propertyType === badge.dataset.count).length;
  });
}

/* ---------- search, filter, sort ---------- */

function applyFilters() {
  const selectedTypes = Array.from(document.querySelectorAll('.filter-type:checked')).map((cb) => cb.value);
  const minBlocks = parseInt($('blocksSlider').value, 10);
  const powerOnly = $('powerToggle').checked;
  const query = $('searchInput').value.trim().toLowerCase();

  filtered = listings.filter((item) => {
    if (selectedTypes.length > 0 && !selectedTypes.includes(item.propertyType)) return false;
    if (item.availableBlocks < minBlocks) return false;
    if (powerOnly && !item.powerIncluded) return false;
    if (savedOnly && !savedIds.includes(item.id)) return false;
    if (query) {
      const text = `${item.name} ${item.address} ${item.landlordName}`.toLowerCase();
      if (!text.includes(query)) return false;
    }
    return true;
  });

  const sort = $('sortSelect').value;
  if (sort === 'price-low') {
    filtered.sort((a, b) => a.minRate - b.minRate);
  } else if (sort === 'price-high') {
    filtered.sort((a, b) => b.maxRate - a.maxRate);
  } else if (sort === 'availability') {
    filtered.sort((a, b) => b.availableBlocks - a.availableBlocks);
  } else if (sort === 'newest') {
    filtered.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  } else {
    // recommended: saved spaces first, then the order from the server (newest first)
    filtered.sort((a, b) => Number(savedIds.includes(b.id)) - Number(savedIds.includes(a.id)));
  }

  currentPage = 1;
  renderPills(selectedTypes, minBlocks, powerOnly, query);
  renderProperties();
}

function renderPills(selectedTypes, minBlocks, powerOnly, query) {
  const pills = [];
  if (selectedTypes.length > 0) pills.push(`Type: ${selectedTypes.map((t) => TYPE_LABELS[t]).join(', ')}`);
  if (minBlocks > 0) pills.push(`Units: ≥ ${minBlocks}`);
  if (powerOnly) pills.push('Power included');
  if (savedOnly) pills.push('Saved only');
  if (query) pills.push(`Search: "${query}"`);
  $('filterPillsContainer').innerHTML = pills.map((text) =>
    `<span class="text-xs font-medium text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">${esc(text)}</span>`
  ).join('');
}

function resetAllFilters() {
  document.querySelectorAll('.filter-type').forEach((cb) => { cb.checked = false; });
  $('blocksSlider').value = 0;
  updateSliderBadge();
  $('powerToggle').checked = false;
  $('searchInput').value = '';
  $('sortSelect').value = 'recommended';
  savedOnly = false;
  updateSavedUi();
  applyFilters();
}

/* ---------- cards and pagination ---------- */

function renderProperties() {
  const total = filtered.length;
  $('totalSpacesHeader').textContent = `${total} ${total === 1 ? 'space' : 'spaces'} ready for reservation`;

  if (total === 0) {
    $('propertiesGrid').innerHTML = '';
    $('emptyState').classList.remove('hidden');
    $('paginationContainer').classList.add('hidden');
    return;
  }
  $('emptyState').classList.add('hidden');
  $('paginationContainer').classList.remove('hidden');

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const end = Math.min(start + ITEMS_PER_PAGE, total);

  $('propertiesGrid').innerHTML = filtered.slice(start, end).map(cardHtml).join('');
  drawCardLayouts();
  $('showingStart').textContent = start + 1;
  $('showingEnd').textContent = end;
  $('showingTotal').textContent = total;
  renderPaginationControls(totalPages);
}

/** The layout of a listing (cached). null when it can't be loaded: the card then just has no thumbnail. */
async function getLayout(id) {
  if (!layouts.has(id)) {
    try {
      layouts.set(id, gridRenderer.fromProperty(await api.get(`/api/browse/${id}/layout`)));
    } catch (err) {
      layouts.set(id, null);
    }
  }
  return layouts.get(id);
}

/** Free units of a layout (they stay bright; the rest is dimmed). */
const freeIds = (layout) => new Set(layout.zones.filter((z) => z.available).map((z) => z.id));

/** Draws the layout of every card on the current page (only these are loaded). */
function drawCardLayouts() {
  document.querySelectorAll('#propertiesGrid [data-thumb]').forEach(async (box) => {
    const layout = await getLayout(Number(box.dataset.thumb));
    if (!layout || !gridRenderer.hasSpots(layout) || !box.isConnected) return;
    box.parentElement.classList.remove('hidden');
    gridRenderer.thumbnail(box, layout, { highlightZoneIds: freeIds(layout), fallbackWidth: box.dataset.w, fallbackHeight: box.dataset.h });
  });
}

/** The details window's map: free units bright, the picked one outlined; a renter can click a free unit. */
function renderModalMap() {
  const section = $('modalMapSection');
  if (!modalLayout || !gridRenderer.hasSpots(modalLayout)) { section.classList.add('hidden'); return; }
  section.classList.remove('hidden');
  const free = freeIds(modalLayout);
  const canPick = me && me.role === 'RENTER';
  gridRenderer.thumbnail($('modalMap'), modalLayout, { highlightZoneIds: free, fallbackWidth: 420, fallbackHeight: 208 });
  $('modalMap').querySelectorAll('.cell').forEach((cell) => {
    const id = modalLayout.cells.get(gridRenderer.cellKey(Number(cell.dataset.row), Number(cell.dataset.col)));
    if (canPick && free.has(id)) cell.classList.add('is-pickable');
    if (id != null && id === selectedUnitId) cell.classList.add('is-selected');
  });
  $('modalMapHint').textContent = canPick ? 'Bright units are free. Click one to choose it.' : 'Bright units are free to rent.';
}

/** Few units left (3 or fewer) get the amber "Few Left" badge, the rest the green "Open" badge. */
function cardHtml(item) {
  const fewLeft = item.availableBlocks <= 3;
  const color = fewLeft ? 'amber' : 'emerald';
  const saved = savedIds.includes(item.id);
  return `
<div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col">
  <div class="relative h-48 w-full bg-black overflow-hidden flex items-center justify-center">
    ${item.coverPhotoUrl
      ? `<img src="${item.coverPhotoUrl}" alt="" class="absolute inset-0 w-full h-full object-cover">
         <div data-layout-box="${item.id}" class="hidden absolute bottom-3 left-3 w-32 h-20 bg-white rounded-lg shadow-md p-1"><div data-thumb="${item.id}" data-w="120" data-h="72" class="grid-thumb w-full h-full"></div></div>`
      : `<i class="fa-solid fa-image text-3xl text-white/30"></i>
         <div data-layout-box="${item.id}" class="hidden absolute inset-0 bg-slate-100 p-3"><div data-thumb="${item.id}" data-w="320" data-h="168" class="grid-thumb w-full h-full"></div></div>`}
    <span class="absolute top-3 left-3 bg-white text-slate-900 font-bold text-[11px] px-2.5 py-1 rounded-md shadow-sm">${esc(TYPE_LABELS[item.propertyType])}</span>
    <span class="absolute top-3 right-3 bg-${color}-500 text-white font-semibold text-[11px] px-2.5 py-1 rounded-md flex items-center gap-1 shadow-sm">
      <span class="w-1.5 h-1.5 rounded-full bg-white ${fewLeft ? '' : 'animate-pulse'}"></span>${fewLeft ? 'Few Left' : 'Open'}
    </span>
    <button type="button" data-save="${item.id}" class="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center ${saved ? 'text-rose-600' : 'text-slate-500'}" aria-label="${saved ? 'Remove from saved' : 'Save this space'}">
      <i class="${saved ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
    </button>
  </div>
  <div class="p-5 flex-1 flex flex-col justify-between">
    <div>
      <div class="flex items-center gap-1.5 text-xs font-bold text-${color}-600 mb-1">
        <span class="w-2 h-2 rounded-full bg-${color}-500"></span>${item.availableBlocks} ${item.availableBlocks === 1 ? 'Unit' : 'Units'} Available
      </div>
      <h3 class="text-base font-bold text-slate-900 truncate" title="${esc(item.name)}">${esc(item.name)}</h3>
      <p class="text-xs text-slate-500 mt-1">${esc(item.address)}</p>
      <div class="mt-3 text-base font-extrabold text-slate-900">${rentRange(item)}
        <span class="text-xs font-normal text-slate-500">/ month</span>
      </div>
    </div>
    <button type="button" data-view="${item.id}" class="mt-4 w-full py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl transition">
      View Space Details
    </button>
  </div>
</div>`;
}

function renderPaginationControls(totalPages) {
  const pageButton = (label, page, disabled) =>
    `<button type="button" data-page="${page}" class="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 transition ${disabled ? 'text-slate-300 pointer-events-none' : 'text-slate-600 hover:bg-white'}">${label}</button>`;

  let html = pageButton('Previous', currentPage - 1, currentPage === 1);
  for (let i = 1; i <= totalPages; i++) {
    html += i === currentPage
      ? `<button type="button" class="w-8 h-8 flex items-center justify-center text-xs font-bold bg-indigo-600 text-white rounded-lg shadow-sm">${i}</button>`
      : `<button type="button" data-page="${i}" class="w-8 h-8 flex items-center justify-center text-xs font-semibold text-slate-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition">${i}</button>`;
  }
  html += pageButton('Next', currentPage + 1, currentPage === totalPages);
  $('paginationButtons').innerHTML = html;
}

function changePage(page) {
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  if (page >= 1 && page <= totalPages) {
    currentPage = page;
    renderProperties();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/* ---------- details window ---------- */

async function openDetails(id) {
  let item;
  try {
    item = await api.get(`/api/browse/${id}`);          // fresh data: the units may have been taken meanwhile
  } catch (err) {
    toast(err.message);
    loadListings();
    return;
  }
  openListing = item;
  selectedUnitId = item.units.length > 0 ? item.units[0].id : null;

  $('modalTypeBadge').textContent = TYPE_LABELS[item.propertyType];
  $('modalTitle').textContent = item.name;
  $('modalLocation').innerHTML = `<i class="fa-solid fa-location-dot text-slate-400 mr-1"></i>${esc(item.address)}`;
  $('modalDescription').textContent = [item.description, amenitiesText(item.amenities)].filter(Boolean).join(' ');
  $('modalPrice').textContent = `${rentRange(item)} / month`;
  $('modalBlocks').textContent = `${item.availableBlocks} ${item.availableBlocks === 1 ? 'Unit' : 'Units'} Available`;
  $('modalUtilities').textContent = utilitiesText(item.powerIncluded, item.waterIncluded);
  $('modalOwner').textContent = item.landlordName;
  renderModalUnits();
  renderRequestArea();
  modalLayout = null;
  $('modalMapSection').classList.add('hidden');
  getLayout(item.id).then((layout) => {
    if (openListing !== item) return;                  // another space was opened meanwhile
    modalLayout = layout;
    renderModalMap();
  });
  updateModalSaveButton();
  $('detailsModal').classList.remove('hidden');
}

function closeDetails() {
  $('detailsModal').classList.add('hidden');
  openListing = null;
}

function renderModalUnits() {
  const canPick = me && me.role === 'RENTER';
  $('modalUnits').innerHTML = openListing.units.map((unit) => {
    const picked = unit.id === selectedUnitId;
    return `
<label class="flex items-center justify-between gap-3 p-3 border rounded-xl ${canPick ? 'cursor-pointer' : ''} ${picked && canPick ? 'border-indigo-600 bg-indigo-50/40' : 'border-slate-200'}">
  <div class="flex items-center gap-3 min-w-0">
    ${canPick ? `<input type="radio" name="unit" value="${unit.id}" ${picked ? 'checked' : ''} class="text-indigo-600 focus:ring-indigo-500">` : ''}
    <div class="min-w-0">
      <p class="text-sm font-bold text-slate-900 truncate">${esc(unit.name)}</p>
      <p class="text-[11px] text-slate-500">${esc(sizeText(unit.dimensions))} · ${esc(utilitiesText(unit.includesElectricity, unit.includesWater))}</p>
    </div>
  </div>
  <span class="text-sm font-extrabold text-slate-900 whitespace-nowrap">${peso(unit.rentalRate)}<span class="text-[11px] font-normal text-slate-500">/mo</span></span>
</label>`;
  }).join('');
}

/** Renter → request form. Guest → login button. Landlord → short note. */
function renderRequestArea() {
  const form = $('requestForm');
  const notice = $('requestNotice');
  const loginLink = $('requestLoginLink');
  form.classList.add('hidden');
  notice.classList.add('hidden');
  loginLink.classList.add('hidden');
  $('requestError').textContent = '';

  if (!me) {
    loginLink.href = `/login.html?next=${encodeURIComponent('/?space=' + openListing.id)}`;
    loginLink.classList.remove('hidden');
    notice.textContent = 'Log in or register as a renter to request a lease on one of these units.';
    notice.classList.remove('hidden');
  } else if (me.role === 'RENTER') {
    const today = new Date().toLocaleDateString('en-CA');       // yyyy-MM-dd, the format the server expects
    form.startDate.min = today;
    if (!form.startDate.value || form.startDate.value < today) form.startDate.value = today;
    form.email.value = me.email || '';
    form.phone.value = me.phone || '';
    $('contactHint').classList.toggle('hidden', Boolean(me.email && me.phone));      // only explain it when something is missing
    form.classList.remove('hidden');
  } else {
    notice.textContent = 'You are logged in as a landlord. Only renters can request a lease.';
    notice.classList.remove('hidden');
  }
}

function updateModalSaveButton() {
  const saved = openListing && savedIds.includes(openListing.id);
  $('modalSaveBtn').innerHTML = `<i class="${saved ? 'fa-solid' : 'fa-regular'} fa-heart mr-1"></i>${saved ? 'Saved' : 'Save'}`;
}

async function submitRequest(event) {
  event.preventDefault();
  const form = event.target;
  const error = $('requestError');
  error.textContent = '';
  if (!selectedUnitId) {
    error.textContent = 'Choose a unit first.';
    return;
  }
  if (!form.startDate.value) {
    error.textContent = 'Choose when you want to start.';
    return;
  }
  const email = form.email.value.trim();
  const phone = form.phone.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    error.textContent = 'Enter a valid email address, like name@example.com.';
    return;
  }
  if (!/^[+]?[\d\s\-()]{10,}$/.test(phone)) {
    error.textContent = 'Enter a valid phone number, like +63 917 555 0101.';
    return;
  }
  $('requestSubmit').disabled = true;
  try {
    if (email !== (me.email || '') || phone !== (me.phone || '')) {
      me = await api.form('PUT', '/api/auth/me/contact', { email, phone });          // remembered on the account for next time
    }
    await api.form('POST', '/api/lease-requests', {
      unitId: selectedUnitId,
      startDate: form.startDate.value,
      months: form.months.value,
      message: form.message.value.trim()
    });
    closeDetails();
    form.message.value = '';
    toast('Request sent! You can follow it under My Requests.');
  } catch (err) {
    error.textContent = err.message;            // e.g. "You already have a pending request for this unit."
  } finally {
    $('requestSubmit').disabled = false;
  }
}

/* ---------- start ---------- */

document.addEventListener('DOMContentLoaded', async () => {
  // filters
  $('blocksSlider').addEventListener('input', updateSliderBadge);
  $('blocksSlider').addEventListener('change', applyFilters);
  document.querySelectorAll('.filter-type').forEach((cb) => cb.addEventListener('change', applyFilters));
  $('powerToggle').addEventListener('change', applyFilters);
  $('sortSelect').addEventListener('change', applyFilters);
  $('searchInput').addEventListener('input', applyFilters);
  $('searchBtn').addEventListener('click', applyFilters);
  $('applyFiltersBtn').addEventListener('click', applyFilters);
  $('resetFiltersBtn').addEventListener('click', resetAllFilters);
  $('emptyResetBtn').addEventListener('click', resetAllFilters);
  $('savedBtn').addEventListener('click', () => {
    savedOnly = !savedOnly;
    updateSavedUi();
    applyFilters();
  });

  // cards and pagination (the buttons are created by JavaScript, so listen on their parents)
  $('propertiesGrid').addEventListener('click', (event) => {
    const saveBtn = event.target.closest('[data-save]');
    if (saveBtn) {
      toggleSaved(Number(saveBtn.dataset.save));
      return;
    }
    const viewBtn = event.target.closest('[data-view]');
    if (viewBtn) openDetails(Number(viewBtn.dataset.view));
  });
  $('paginationButtons').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-page]');
    if (btn) changePage(Number(btn.dataset.page));
  });

  // details window
  $('modalCloseX').addEventListener('click', closeDetails);
  $('modalCloseBtn').addEventListener('click', closeDetails);
  $('detailsModal').addEventListener('click', (event) => {
    if (event.target === $('detailsModal')) closeDetails();       // click on the dark background
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDetails();
  });
  $('modalUnits').addEventListener('change', (event) => {
    if (event.target.name === 'unit') {
      selectedUnitId = Number(event.target.value);
      renderModalUnits();
      renderModalMap();
    }
  });
  // the details map: a renter clicks a free unit to pick it (same as the radio list)
  $('modalMap').addEventListener('click', (event) => {
    const cell = event.target.closest('.cell.is-pickable');
    if (!cell || !modalLayout) return;
    selectedUnitId = modalLayout.cells.get(gridRenderer.cellKey(Number(cell.dataset.row), Number(cell.dataset.col)));
    renderModalUnits();
    renderModalMap();
  });
  $('modalSaveBtn').addEventListener('click', () => {
    if (openListing) toggleSaved(openListing.id);
  });
  $('requestForm').addEventListener('submit', submitRequest);

  updateSavedUi();
  await Promise.all([loadMe(), loadListings()]);

  const space = Number(new URLSearchParams(location.search).get('space'));
  if (space) openDetails(space);
});
