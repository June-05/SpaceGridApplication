/*
 * units.js — script for landlord/units.html (?propertyId=; without it the first property is shown)
 *
 * 1. Load: GET /api/properties (for the "Viewing:" picker), GET /api/properties/{id}/units
 *    and GET /api/properties/{id}/leases (the ACTIVE lease of a unit gives its tenant).
 * 2. Each card: the rate can be changed right on the card (Enter or leaving the box saves it).
 *    Rate change = PUT /api/units/{id} with the unit's other fields unchanged.
 * 3. Quick Edit: status AVAILABLE <-> UNDER_MAINTENANCE (POST /api/units/{id}/maintenance), rate,
 *    and unit photos (GET/POST /api/units/{id}/files, DELETE /api/files/{id}).
 *    OCCUPIED can't be picked: it comes from a lease. "Create Lease" → lease-form.html?unitId=
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

  document.querySelectorAll('.filter-pill').forEach((pill) => pill.addEventListener('click', () => setFilter(pill)));
  $('unitSearch').addEventListener('input', (e) => { currentSearch = e.target.value.trim().toLowerCase(); renderGrid(); });
  $('blockGrid').addEventListener('change', (e) => { if (e.target.matches('.rate-input')) saveRate(e.target); });
  $('blockGrid').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('.rate-input')) e.target.blur(); });
  $('modalPhotoInput').addEventListener('change', uploadPhotos);
  await loadUnits();
});

async function loadUnits() {
  const [list, leases] = await Promise.all([
    api.get(`/api/properties/${propertyId}/units`),
    api.get(`/api/properties/${propertyId}/leases`)
  ]);
  units = list;
  activeLeases = {};
  leases.filter((l) => l.status === 'ACTIVE').forEach((l) => { activeLeases[l.unitId] = l; });
  updateStats();
  renderGrid();
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
  renderGrid();
}

function sizeText(unit) {
  const d = unit.dimensions;
  if (!d) return 'No size given';
  return d.exact ? `${Number(d.areaSqm)} sq.m.` : `Approx. ${format.escape(d.description)}`;
}

function renderGrid() {
  const shown = units.filter((u) => (currentFilter === 'all' || u.status === currentFilter)
    && (!currentSearch || u.name.toLowerCase().includes(currentSearch)));
  $('emptyState').classList.toggle('hidden', shown.length > 0);
  $('blockGrid').innerHTML = shown.map((unit) => {
    const [label, color] = STATUS_STYLE[unit.status];
    const lease = activeLeases[unit.id];
    return `
      <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition">
        <div class="p-4">
          <div class="flex items-start justify-between mb-3">
            <div>
              <h3 class="text-base font-bold text-slate-900">${format.escape(unit.name)}</h3>
              <p class="text-xs text-slate-500">${sizeText(unit)}</p>
            </div>
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${color}">${label}</span>
          </div>
          <div class="mb-3 space-y-2">
            ${lease ? `<div><p class="text-xs text-slate-500">Current Tenant</p>
                         <p class="text-sm font-semibold text-slate-900">${format.escape(lease.tenantName)}</p></div>` : ''}
            <div>
              <label class="text-xs text-slate-500" for="rate-${unit.id}">Monthly Rent (Enter to save)</label>
              <div class="relative mt-0.5">
                <span class="absolute left-2.5 top-1.5 text-indigo-400 text-sm font-bold">₱</span>
                <input id="rate-${unit.id}" data-unit-id="${unit.id}" class="rate-input w-full pl-7 pr-2 py-1 text-sm font-bold text-indigo-600 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                       type="number" min="0" step="any" value="${Number(unit.rentalRate)}">
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="openEditModal(${unit.id})" class="flex-1 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition border border-slate-200 flex items-center justify-center gap-2">
              <i class="fa-solid fa-pen text-xs"></i> Quick Edit
            </button>
            ${lease
              ? `<a href="/lease.html?id=${lease.id}" class="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl transition border border-emerald-100 flex items-center justify-center gap-2"><i class="fa-solid fa-file-contract text-xs"></i> View Lease</a>`
              : unit.status === 'AVAILABLE'
                ? `<a href="lease-form.html?unitId=${unit.id}" class="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-semibold rounded-xl transition border border-indigo-100 flex items-center justify-center gap-2"><i class="fa-solid fa-file-contract text-xs"></i> Create Lease</a>`
                : ''}
          </div>
        </div>
      </div>`;
  }).join('');
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

async function saveRate(input) {
  const unit = units.find((u) => u.id === Number(input.dataset.unitId));
  const rate = input.value.trim();
  if (!unit || rate === '' || Number(rate) === Number(unit.rentalRate)) return;
  try {
    const saved = await api.form('PUT', `/api/units/${unit.id}`, unitFields(unit, rate));
    Object.assign(unit, saved);
    input.classList.add('border-emerald-500');
    setTimeout(() => input.classList.remove('border-emerald-500'), 1200);
    updateStats();
  } catch (err) {
    alert(err.message);
    input.value = Number(unit.rentalRate);
  }
}

async function openEditModal(id) {
  editing = units.find((u) => u.id === id);
  if (!editing) return;
  const lease = activeLeases[id];
  $('modalBlockCode').textContent = `${editing.name} • ${sizeText(editing)}`;
  $('modalStatus').value = editing.status;
  $('modalStatus').disabled = editing.status === 'OCCUPIED';
  $('modalRent').value = Number(editing.rentalRate);
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
