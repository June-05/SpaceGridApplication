/*
 * property-form.js — script for landlord/property-form.html (?id= to edit; no id = add a new property)
 *
 * 1. Editing: fill the form from GET /api/properties/{id}, and show its photos and site plans
 *    (GET /api/properties/{id}/files?kind=PROPERTY_PHOTO | SITE_PLAN).
 * 2. Save Draft: POST /api/properties (new) or PUT /api/properties/{id} with the form fields
 *    (name, address, city, region, type, description, defaultRate, exactSize + areaSqm, amenity checkboxes).
 *    Publish: save, then POST /api/properties/{id}/publish. Archive: POST /api/properties/{id}/archive.
 * 3. Photos / site plans: an existing property uploads right away (POST /api/properties/{id}/files);
 *    for a new one they wait in a list and are uploaded after its first save. Delete: DELETE /api/files/{id}.
 * The number of units isn't typed here: the landlord draws them in the grid plotter.
 */
const $ = (id) => document.getElementById(id);
const AMENITIES = ['parking', 'powerBackup', 'security', 'waterAccess', 'open24h'];

let propertyId = Number(new URLSearchParams(location.search).get('id')) || null;
let property = null;
const waiting = { PROPERTY_PHOTO: [], SITE_PLAN: [] };     // files picked before the first save

document.addEventListener('DOMContentLoaded', async () => {
  await auth.requireLogin('LANDLORD');
  setupDropZone('photoDropZone', 'photoInput', 'PROPERTY_PHOTO');
  setupDropZone('layoutDropZone', 'layoutInput', 'SITE_PLAN');
  $('saveDraftBtn').addEventListener('click', () => save(false));
  $('publishBtn').addEventListener('click', () => save(true));
  $('archiveBtn').addEventListener('click', archive);
  $('defaultRate').addEventListener('input', showRevenue);
  if (propertyId) {
    await loadProperty();
  }
  showRevenue();
});

async function loadProperty() {
  property = await api.get(`/api/properties/${propertyId}`);
  document.title = `${property.name} - SpaceGrid`;
  $('pageTitle').textContent = 'Edit Property';
  $('propertyTitle').value = property.name;
  $('spaceType').value = property.propertyType;
  $('description').value = property.description || '';
  $('streetAddress').value = property.address;
  $('city').value = property.city;
  $('region').value = property.region;
  $('defaultRate').value = property.defaultRate ?? '';
  $('totalArea').value = property.dimensions && property.dimensions.exact ? Number(property.dimensions.areaSqm) : '';
  AMENITIES.forEach((name) => { $(name).checked = property.amenities[name]; });

  $('publishBtn').classList.toggle('hidden', property.status !== 'DRAFT');
  $('archiveBtn').classList.toggle('hidden', property.status === 'ARCHIVED');
  if (property.status === 'ARCHIVED') {
    $('saveDraftBtn').classList.add('hidden');
    showMessage('This property is archived, so it can no longer be edited.', false);
  } else {
    $('saveDraftBtn').textContent = 'Save Changes';
  }
  await Promise.all([showFiles('PROPERTY_PHOTO'), showFiles('SITE_PLAN')]);
}

/** Without units drawn yet: show nothing to add up. With units: the sum of their own rates. */
function showRevenue() {
  const units = property ? property.zones.filter((z) => z.rentable && z.status !== 'ARCHIVED') : [];
  const total = units.reduce((sum, u) => sum + Number(u.rentalRate), 0);
  $('totalRevenue').textContent = format.peso(total);
  $('revenueNote').innerHTML = units.length
    ? `Sum of the ${units.length} unit rates. <a class="text-indigo-600 font-semibold" href="property-grid.html?id=${propertyId}">Open the grid plotter</a> to add units.`
    : propertyId
      ? `No units yet. <a class="text-indigo-600 font-semibold" href="property-grid.html?id=${propertyId}">Open the grid plotter</a> to draw them; new units start at the default rate.`
      : 'Save the property, then draw its units in the grid plotter. New units start at the default rate.';
}

/** Only filled-in optional fields are sent, so empty ones arrive as null. */
function formFields() {
  const fields = {
    name: $('propertyTitle').value.trim(),
    type: $('spaceType').value,
    address: $('streetAddress').value.trim(),
    city: $('city').value.trim(),
    region: $('region').value.trim()
  };
  if ($('description').value.trim()) fields.description = $('description').value.trim();
  if ($('defaultRate').value !== '') fields.defaultRate = $('defaultRate').value;
  if ($('totalArea').value !== '' && Number($('totalArea').value) > 0) {
    fields.exactSize = true;
    fields.areaSqm = $('totalArea').value;
  }
  AMENITIES.forEach((name) => { fields[name] = $(name).checked; });
  return fields;
}

async function save(publish) {
  const fields = formFields();
  if (!fields.name || !fields.type || !fields.address || !fields.city || !fields.region) {
    showMessage('Please fill in the title, space type, street address, city and region.', false);
    return;
  }
  try {
    const isNew = !propertyId;
    property = isNew
      ? await api.form('POST', '/api/properties', fields)
      : await api.form('PUT', `/api/properties/${propertyId}`, fields);
    propertyId = property.id;
    if (isNew) {
      history.replaceState(null, '', `property-form.html?id=${propertyId}`);   // later saves update it
      await uploadWaiting();
    }
    if (publish) {
      await api.form('POST', `/api/properties/${propertyId}/publish`);
      location.href = 'dashboard.html';
      return;
    }
    await loadProperty();
    showMessage(isNew
      ? `Saved as a draft. Next: <a class="underline" href="property-grid.html?id=${propertyId}">draw its units in the grid plotter</a>.`
      : 'Changes saved.', true);
  } catch (err) {
    showMessage(format.escape(err.message), false);
  }
}

async function archive() {
  if (!confirm('Archive this property? It leaves the homepage and can no longer be edited.')) return;
  try {
    await api.form('POST', `/api/properties/${propertyId}/archive`);
    await loadProperty();
  } catch (err) {
    showMessage(format.escape(err.message), false);    // e.g. "Unit 101 has an active lease..."
  }
}

function showMessage(html, ok) {
  const box = $('formMessage');
  box.innerHTML = html;
  box.className = `mb-6 px-4 py-3 rounded-xl text-sm font-semibold ${ok
    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    : 'bg-rose-50 text-rose-700 border border-rose-200'}`;
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ---------------------------------------------------------------- photos and site plans
function setupDropZone(zoneId, inputId, kind) {
  const zone = $(zoneId);
  const input = $(inputId);
  zone.addEventListener('click', (e) => { if (e.target !== input) input.click(); });
  input.addEventListener('change', () => { addFiles(kind, input.files); input.value = ''; });
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('border-indigo-400', 'bg-indigo-50/30'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('border-indigo-400', 'bg-indigo-50/30'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('border-indigo-400', 'bg-indigo-50/30');
    addFiles(kind, e.dataTransfer.files);
  });
}

async function addFiles(kind, fileList) {
  const files = [...fileList];
  if (!propertyId) {                       // not saved yet: keep them until the first save
    waiting[kind].push(...files);
    showFiles(kind);
    return;
  }
  try {
    for (const file of files) await uploadOne(kind, file);
  } catch (err) {
    showMessage(format.escape(err.message), false);   // e.g. "Photos must be JPG, PNG or WebP images."
  }
  showFiles(kind);
}

function uploadOne(kind, file) {
  const data = new FormData();
  data.append('kind', kind);
  data.append('file', file);
  return api.upload(`/api/properties/${propertyId}/files`, data);
}

async function uploadWaiting() {
  for (const kind of Object.keys(waiting)) {
    for (const file of waiting[kind]) await uploadOne(kind, file);
    waiting[kind] = [];
  }
}

/** Saved files from the server, or (before the first save) the waiting ones as local previews. */
async function showFiles(kind) {
  const preview = $(kind === 'PROPERTY_PHOTO' ? 'photoPreview' : 'layoutPreview');
  const files = propertyId
    ? await api.get(`/api/properties/${propertyId}/files?kind=${kind}`)
    : waiting[kind].map((f, i) => ({ waitingIndex: i, fileName: f.name, contentType: f.type, url: URL.createObjectURL(f) }));
  preview.innerHTML = files.map((f) => `
    <div class="relative group">
      ${f.contentType.startsWith('image/')
        ? `<img src="${f.url}" alt="${format.escape(f.fileName)}" class="w-full h-32 object-cover rounded-xl border border-slate-200">`
        : `<a href="${f.url}" target="_blank" class="w-full h-32 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center"><i class="fa-solid fa-file-pdf text-3xl text-rose-500"></i></a>`}
      <button type="button" data-kind="${kind}" ${f.id ? `data-file-id="${f.id}"` : `data-waiting="${f.waitingIndex}"`} title="Remove"
              class="remove-file absolute top-2 right-2 w-6 h-6 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
        <i class="fa-solid fa-xmark text-xs"></i>
      </button>
      <div class="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded max-w-[90%] truncate">${format.escape(f.fileName)}</div>
    </div>`).join('');
  preview.querySelectorAll('.remove-file').forEach((b) => b.addEventListener('click', () => removeFile(b)));
}

async function removeFile(button) {
  const kind = button.dataset.kind;
  if (button.dataset.waiting !== undefined) {
    waiting[kind].splice(Number(button.dataset.waiting), 1);
  } else {
    if (!confirm('Delete this file?')) return;
    try {
      await api.form('DELETE', `/api/files/${button.dataset.fileId}`);
    } catch (err) {
      showMessage(format.escape(err.message), false);
    }
  }
  showFiles(kind);
}
