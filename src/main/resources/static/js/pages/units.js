/*
 * units.js — script for landlord/units.html (?propertyId=; without it the first property is shown)
 *
 * 1. Load: GET /api/properties (for the "Viewing:" picker), GET /api/properties/{id} (the grid, for the Map),
 *    GET /api/properties/{id}/units and GET /api/properties/{id}/leases (the ACTIVE lease of a unit gives its tenant).
 * 2. Two views of the same units (localStorage unitsView remembers the choice):
 *      Map  = the property's grid, read-only (grid-renderer.js). The status/search filters dim the other units.
 *             Clicking a unit opens Quick Edit. Shown first when units are placed on the grid.
 *      List = one compact card per unit (name, status, rate, tenant); clicking a card opens Quick Edit.
 * 3. Quick Edit: status AVAILABLE <-> UNDER_MAINTENANCE (POST /api/units/{id}/maintenance),
 *    "Rate for new leases" (PUT /api/units/{id} with the unit's other fields unchanged; a running lease keeps
 *    its own rent, and the note under the field says so), and unit photos (GET/POST /api/units/{id}/files,
 *    DELETE /api/files/{id}). OCCUPIED can't be picked: it comes from a lease. "Create Lease" → lease-form.html?unitId=
 */
const $ = (id) => document.getElementById(id);

const STATUS_STYLE = {
  OCCUPIED: ['Occupied', 'bg-emerald-100 text-emerald-700'],
  AVAILABLE: ['Vacant', 'bg-blue-100 text-blue-700'],
  UNDER_MAINTENANCE: ['Maintenance', 'bg-amber-100 text-amber-700']
};

let propertyId = null;
let units = [];
let activeLeases = {};       // unit id → its ACTIVE lease
let currentFilter = 'all';
let currentSearch = '';
let editing = null;          // unit open in the Quick Edit modal
let property = null;         // GET /api/properties/{id}: the grid for the Map view
let view = null;             // 'map' or 'list'

document.addEventListener('DOMContentLoaded', async () => {
  await auth.requireLogin('LANDLORD');
  const properties = await api.get('/api/properties');
  if (properties.length === 0) {
    $('blockGrid').innerHTML = '';
    $('emptyState').classList.remove('hidden');
    $('emptyState').querySelector('h3').textContent = 'No properties yet';
    $('emptyState').querySelector('p').innerHTML = '<a href="property-form.html" class="text-indigo-600 font-semibold">Add your first property</a>, then draw its units in the grid plotter.';
    return;
  }
  const asked = Number(new URLSearchParams(location.search).get('propertyId'));
  propertyId = properties.some((p) => p.id === asked) ? asked : properties[0].id;

  $('propertySelector').innerHTML = properties
    .map((p) => `<option value="${p.id}" ${p.id === propertyId ? 'selected' : ''}>${format.escape(p.name)}</option>`).join('');
  $('propertySelector').addEventListener('change', (e) => { location.href = `units.html?propertyId=${e.target.value}`; });
  $('editPropertyLink').href = `property-form.html?id=${propertyId}`;
  $('gridLink').href = `property-grid.html?id=${propertyId}`;

  $('mapEmptyLink').href = `property-grid.html?id=${propertyId}`;
  $('mapGridLink').href = `property-grid.html?id=${propertyId}`;

  document.querySelectorAll('.filter-pill').forEach((pill) => pill.addEventListener('click', () => setFilter(pill)));
  $('unitSearch').addEventListener('input', (e) => { currentSearch = e.target.value.trim().toLowerCase(); render(); });
  $('viewToggle').addEventListener('click', (e) => {
    const button = e.target.closest('[data-view]');
    if (button) setView(button.dataset.view, true);
  });
  $('blockGrid').addEventListener('click', (e) => {
    const card = e.target.closest('[data-unit-id]');
    if (card && !e.target.closest('a, button')) openEditModal(Number(card.dataset.unitId));
  });
  $('mapHost').addEventListener('click', (e) => {
    const cell = e.target.closest('.cell');
    const zoneId = cell && mapLayout ? mapLayout.cells.get(gridRenderer.cellKey(Number(cell.dataset.row), Number(cell.dataset.col))) : null;
    if (zoneId != null && units.some((u) => u.id === zoneId)) openEditModal(zoneId);
  });
  $('modalPhotoInput').addEventListener('change', uploadPhotos);
  await loadUnits();
  let saved = null;
  try { saved = localStorage.getItem('unitsView'); } catch (e) { /* storage blocked */ }
  setView(saved === 'list' || saved === 'map' ? saved : (hasPlacedUnits() ? 'map' : 'list'), false);
});

let mapLayout = null;        // the layout drawn in the Map view (cell → zone id, for clicks)

/** True when at least one unit has spots on the grid (otherwise the Map has nothing to show). */
function hasPlacedUnits() {
  return Boolean(property && property.zones.some((z) => z.rentable && (z.positions || []).length > 0));
}

function setView(next, remember) {
  view = next;
  if (remember) { try { localStorage.setItem('unitsView', next); } catch (e) { /* storage blocked */ } }
  document.querySelectorAll('#viewToggle [data-view]').forEach((b) => {
    const on = b.dataset.view === view;
    b.classList.toggle('bg-indigo-600', on);
    b.classList.toggle('text-white', on);
    b.classList.toggle('text-slate-600', !on);
    b.setAttribute('aria-pressed', String(on));
  });
  $('unitMap').classList.toggle('hidden', view !== 'map');
  $('blockGrid').classList.toggle('hidden', view !== 'list');
  render();
}

async function loadUnits() {
  const [list, leases, prop] = await Promise.all([
    api.get(`/api/properties/${propertyId}/units`),
    api.get(`/api/properties/${propertyId}/leases`),
    api.get(`/api/properties/${propertyId}`)
  ]);
  units = list;
  property = prop;
  activeLeases = {};
  leases.filter((l) => l.status === 'ACTIVE').forEach((l) => { activeLeases[l.unitId] = l; });
  updateStats();
  render();
}

function updateStats() {
  const count = (status) => units.filter((u) => u.status === status).length;
  const occupied = count('OCCUPIED');
  const income = units.filter((u) => u.status !== 'UNDER_MAINTENANCE').reduce((sum, u) => sum + Number(u.rentalRate), 0);
  $('statTotal').textContent = units.length;
  $('statOccupancy').textContent = (units.length ? Math.round((occupied / units.length) * 100) : 0) + '%';
  $('statVacant').textContent = count('AVAILABLE');
  $('statIncome').textContent = format.peso(income);
  $('countAll').textContent = units.length;
  $('countOccupied').textContent = occupied;
  $('countVacant').textContent = count('AVAILABLE');
  $('countMaintenance').textContent = count('UNDER_MAINTENANCE');
}

function setFilter(pill) {
  currentFilter = pill.dataset.filter;
  document.querySelectorAll('.filter-pill').forEach((p) => {
    const on = p === pill;
    p.classList.toggle('bg-indigo-600', on);
    p.classList.toggle('text-white', on);
    ['bg-white', 'border', 'border-slate-200', 'text-slate-700', 'hover:bg-slate-50'].forEach((c) => p.classList.toggle(c, !on));
  });
  render();
}

function sizeText(unit) {
  const d = unit.dimensions;
  if (!d) return 'No size given';
  return d.exact ? `${Number(d.areaSqm)} sq.m.` : `Approx. ${format.escape(d.description)}`;
}

/** The units that pass the status filter and the search. */
function shownUnits() {
  return units.filter((u) => (currentFilter === 'all' || u.status === currentFilter)
    && (!currentSearch || u.name.toLowerCase().includes(currentSearch)));
}

function render() {
  if (!view) return;
  if (view === 'map') renderMap(); else renderList();
}

/** One compact card per unit: name, status, rate, tenant. The card opens Quick Edit. */
function renderList() {
  const shown = shownUnits();
  $('emptyState').classList.toggle('hidden', shown.length > 0);
  $('blockGrid').innerHTML = shown.map((unit) => {
    const [label, color] = STATUS_STYLE[unit.status];
    const lease = activeLeases[unit.id];
    const link = lease
      ? `<a href="/lease.html?id=${lease.id}" class="text-xs font-semibold text-emerald-700 hover:underline">View lease</a>`
      : unit.status === 'AVAILABLE'
        ? `<a href="lease-form.html?unitId=${unit.id}" class="text-xs font-semibold text-indigo-600 hover:underline">Create lease</a>`
        : '';
    return `
      <div data-unit-id="${unit.id}" title="Click to edit" class="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs hover:shadow-md hover:border-indigo-200 transition cursor-pointer">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 class="text-sm font-bold text-slate-900 truncate">${format.escape(unit.name)}</h3>
            <p class="text-[11px] text-slate-400">${sizeText(unit)}</p>
          </div>
          <span class="flex-shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold ${color}">${label}</span>
        </div>
        <p class="mt-3 text-base font-extrabold text-indigo-600">${format.peso(unit.rentalRate)}<span class="text-[11px] font-medium text-slate-400"> / mo</span></p>
        <div class="mt-2 flex items-center justify-between gap-2 text-xs">
          <span class="truncate ${lease ? 'text-slate-700' : 'text-slate-400'}">${lease ? '<i class="fa-solid fa-user mr-1 text-slate-400"></i>' + format.escape(lease.tenantName) : 'No tenant'}</span>
          ${link}
        </div>
      </div>`;
  }).join('');
}

/** The grid, read-only; units outside the filter/search are dimmed. */
function renderMap() {
  const placed = hasPlacedUnits();
  $('mapEmpty').classList.toggle('hidden', placed);
  $('mapHost').classList.toggle('hidden', !placed);
  $('emptyState').classList.add('hidden');
  if (!placed) { $('mapLegend').innerHTML = ''; mapLayout = null; return; }
  mapLayout = gridRenderer.fromProperty(property);
  const filtering = currentFilter !== 'all' || currentSearch;
  const keep = new Set(shownUnits().map((u) => u.id));
  gridRenderer.render($('mapHost'), mapLayout, filtering ? { mode: 'view', highlightZoneIds: keep } : { mode: 'view' });
  const unitIds = new Set(units.map((u) => u.id));
  $('mapHost').querySelectorAll('.cell').forEach((cell) => {
    const id = mapLayout.cells.get(gridRenderer.cellKey(Number(cell.dataset.row), Number(cell.dataset.col)));
    if (unitIds.has(id)) cell.classList.add('is-unit');
  });
  // legend: one chip per unit status on this property, in the grid's own colors
  const seen = new Map();
  for (const z of property.zones) if (z.rentable && z.status && z.status !== 'ARCHIVED' && !seen.has(z.status)) seen.set(z.status, z.color);
  $('mapLegend').innerHTML = [...seen].map(([status, colorValue]) =>
    `<span class="inline-flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm border border-slate-300" style="background:${colorValue}"></span>${(STATUS_STYLE[status] || [format.label(status)])[0]}</span>`).join('');
}

/** PUT /api/units/{id} needs every field: send the unit's current ones with the new rate. */
function unitFields(unit, rentalRate) {
  const fields = { name: unit.name, rentalRate, electricity: unit.includesElectricity, water: unit.includesWater };
  if (unit.dimensions) {
    fields.exactSize = unit.dimensions.exact;
    if (unit.dimensions.exact) fields.areaSqm = unit.dimensions.areaSqm;
    else fields.sizeDescription = unit.dimensions.description;
  }
  return fields;
}

async function openEditModal(id) {
  editing = units.find((u) => u.id === id);
  if (!editing) return;
  const lease = activeLeases[id];
  $('modalBlockCode').textContent = `${editing.name} • ${sizeText(editing)}`;
  $('modalStatus').value = editing.status;
  $('modalStatus').disabled = editing.status === 'OCCUPIED';
  $('modalRent').value = Number(editing.rentalRate);
  $('modalRentNote').textContent = lease
    ? `${lease.tenantName}'s current lease stays at ${format.peso(lease.monthlyRent)} / month until ${format.date(lease.endDate)}. A new rate only applies to new leases (and renewals you create).`
    : 'This is the rent filled in when you create the next lease for this unit.';
  $('modalTenant').innerHTML = lease
    ? `${format.escape(lease.tenantName)} (${format.escape(lease.renterUsername)}) · <a class="text-indigo-600 font-semibold" href="/lease.html?id=${lease.id}">View lease</a>`
    : editing.status === 'AVAILABLE'
      ? `None · <a class="text-indigo-600 font-semibold" href="lease-form.html?unitId=${id}">Create a lease</a>`
      : 'None';
  $('modalError').classList.add('hidden');
  $('editModal').classList.remove('hidden');
  await loadPhotos();
}

function closeEditModal() {
  $('editModal').classList.add('hidden');
  editing = null;
}

async function saveUnitEdit() {
  const unit = editing;
  try {
    const status = $('modalStatus').value;
    if (unit.status !== 'OCCUPIED' && status !== unit.status) {
      await api.form('POST', `/api/units/${unit.id}/maintenance`, { underMaintenance: status === 'UNDER_MAINTENANCE' });
    }
    if (Number($('modalRent').value) !== Number(unit.rentalRate)) {
      await api.form('PUT', `/api/units/${unit.id}`, unitFields(unit, $('modalRent').value));
    }
    closeEditModal();
    await loadUnits();
  } catch (err) {
    showModalError(err.message);
  }
}

async function loadPhotos() {
  const photos = await api.get(`/api/units/${editing.id}/files`);
  $('modalPhotos').innerHTML = photos.length === 0
    ? '<p class="col-span-3 text-xs text-slate-400">No photos yet.</p>'
    : photos.map((p) => `
      <div class="relative group">
        <img src="${p.url}" alt="${format.escape(p.fileName)}" class="w-full h-20 object-cover rounded-lg border border-slate-200">
        <button type="button" onclick="deletePhoto(${p.id})" title="Delete photo"
                class="absolute top-1 right-1 w-5 h-5 bg-rose-500 text-white rounded-full text-[10px] flex items-center justify-center">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>`).join('');
}

async function uploadPhotos(e) {
  try {
    for (const file of e.target.files) {
      const data = new FormData();
      data.append('file', file);
      await api.upload(`/api/units/${editing.id}/files`, data);
    }
  } catch (err) {
    showModalError(err.message);          // e.g. "Photos must be JPG, PNG or WebP images."
  }
  e.target.value = '';
  await loadPhotos();
}

async function deletePhoto(fileId) {
  if (!confirm('Delete this photo?')) return;
  try {
    await api.form('DELETE', `/api/files/${fileId}`);
    await loadPhotos();
  } catch (err) {
    showModalError(err.message);
  }
}

function showModalError(message) {
  $('modalError').textContent = message;
  $('modalError').classList.remove('hidden');
}
