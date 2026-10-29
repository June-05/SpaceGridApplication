/*
 * lease-form.js — script for landlord/lease-form.html
 *
 * Opened as:
 *   lease-form.html                 new lease
 *   lease-form.html?unitId=3        new lease for that unit (from the Units page)
 *   lease-form.html?requestId=4     new lease from an approved lease request (renter, unit and dates filled in)
 *   lease-form.html?renew=3         renewal of lease 3 (same tenant and unit; new dates, rent, terms)
 *   lease-form.html?again=3         new lease for lease 3's renter and unit after it ended (fields stay editable)
 *
 * 1. Renter account: typing calls GET /api/renters?search=; picking one fills the full name.
 * 2. Property → its AVAILABLE units (GET /api/properties/{id}/units); picking a unit fills in its rate.
 * 3. Create: POST /api/leases { unitId, renterUsername, startDate, endDate, monthlyRent, paymentTerms,
 *                                tenantName, tenantEmail, tenantPhone }
 *    Renew:  POST /api/leases/{id}/renew { newStartDate, newEndDate, newMonthlyRent, paymentTerms }
 *    Then the contract PDF (if one was chosen): POST /api/leases/{newId}/files. Then → /lease.html?id={newId}
 */
const $ = (id) => document.getElementById(id);
const query = new URLSearchParams(location.search);
const renewId = Number(query.get('renew')) || null;

const TERMS_NOTE = {
  MONTHLY_ADVANCE: 'Each month is paid at the start of the month.',
  MONTHLY_ARREARS: 'Each month is paid at the start of the next month.',
  QUARTERLY_ADVANCE: 'Every 3 months are paid together, at the start.',
  SEMI_ANNUAL_ADVANCE: 'Every 6 months are paid together, at the start.',
  ANNUAL_ADVANCE: 'Every 12 months are paid together, at the start.'
};
const MONTHS_PER_PERIOD = { MONTHLY_ADVANCE: 1, MONTHLY_ARREARS: 1, QUARTERLY_ADVANCE: 3, SEMI_ANNUAL_ADVANCE: 6, ANNUAL_ADVANCE: 12 };

let renters = [];           // last search result from /api/renters
let units = [];             // AVAILABLE units of the chosen property
let selectedFile = null;    // contract PDF

document.addEventListener('DOMContentLoaded', async () => {
  await auth.requireLogin('LANDLORD');
  setupContractDrop();
  ['monthlyRent', 'startDate', 'endDate', 'paymentTerms'].forEach((id) => $(id).addEventListener('input', calculateSummary));
  $('paymentTerms').addEventListener('change', calculateSummary);
  $('startDate').addEventListener('change', () => { $('endDate').min = $('startDate').value; calculateSummary(); });
  $('renterUsername').addEventListener('input', searchRenters);
  $('renterUsername').addEventListener('change', pickRenter);
  $('propertySelect').addEventListener('change', () => loadUnits(Number($('propertySelect').value)));
  $('unitSelect').addEventListener('change', fillRate);
  $('leaseForm').addEventListener('submit', handleFormSubmit);

  const properties = await api.get('/api/properties');
  $('propertySelect').innerHTML = '<option value="">Select a property</option>' + properties
    .filter((p) => p.status !== 'ARCHIVED')
    .map((p) => `<option value="${p.id}">${format.escape(p.name)}</option>`).join('');

  if (renewId) {
    await startRenewal();
  } else if (query.get('requestId')) {
    await startFromRequest(Number(query.get('requestId')), properties);
  } else if (query.get('unitId')) {
    await selectUnit(Number(query.get('unitId')), properties);
  } else if (query.get('again')) {
    await startAgain(Number(query.get('again')), properties);
  }
  calculateSummary();
});

// ---------------------------------------------------------------- tenant
async function searchRenters() {
  const text = $('renterUsername').value.trim();
  if (text.length < 1) return;
  renters = await api.get(`/api/renters?search=${encodeURIComponent(text)}`);
  $('renterOptions').innerHTML = renters
    .map((r) => `<option value="${format.escape(r.username)}">${format.escape(r.fullName)}</option>`).join('');
}

/** Picking an account fills the full name (the landlord can still change it). */
function pickRenter() {
  const renter = renters.find((r) => r.username === $('renterUsername').value.trim());
  if (renter && !$('tenantName').value.trim()) $('tenantName').value = renter.fullName;
}

// ---------------------------------------------------------------- property and unit
async function loadUnits(propertyId, keepUnitId) {
  units = propertyId
    ? (await api.get(`/api/properties/${propertyId}/units`)).filter((u) => u.status === 'AVAILABLE' || u.id === keepUnitId)
    : [];
  $('unitSelect').innerHTML = !propertyId ? '<option value="">Select a property first</option>'
    : units.length === 0 ? '<option value="">No available units</option>'
    : '<option value="">Select unit</option>' + units
      .map((u) => `<option value="${u.id}">${format.escape(u.name)} · ${format.peso(u.rentalRate)}</option>`).join('');
}

function fillRate() {
  const unit = units.find((u) => u.id === Number($('unitSelect').value));
  if (unit) $('monthlyRent').value = Number(unit.rentalRate);
  calculateSummary();
}

async function selectUnit(unitId, properties) {
  for (const p of properties) {
    if (p.zones.some((z) => z.id === unitId)) {
      $('propertySelect').value = p.id;
      await loadUnits(p.id);
      $('unitSelect').value = unitId;
      fillRate();
      return;
    }
  }
}

/** From an approved request (requests.html "Create lease"): renter, unit, start date and length. */
async function startFromRequest(requestId, properties) {
  const request = (await api.get('/api/lease-requests')).find((r) => r.id === requestId);
  if (!request || request.unitId == null) return;
  const renter = (await api.get(`/api/renters?search=${encodeURIComponent(request.renterName)}`))
    .find((r) => r.id === request.renterId);
  if (renter) {
    $('renterUsername').value = renter.username;
    $('tenantName').value = renter.fullName;
  }
  await selectUnit(request.unitId, properties);
  $('startDate').value = request.desiredStart;
  $('endDate').value = request.suggestedEndDate;
}

/**
 * "Lease again" from an ended lease (lease.html): same renter, contact and unit, filled in but still editable.
 * It is an ordinary new lease (not a renewal), so the unit must be AVAILABLE again.
 */
async function startAgain(oldLeaseId, properties) {
  const old = await api.get(`/api/leases/${oldLeaseId}`);
  $('renterUsername').value = old.renterUsername;
  $('tenantName').value = old.tenantName;
  $('tenantEmail').value = old.tenantEmail || '';
  $('tenantPhone').value = old.tenantPhone || '';
  await selectUnit(old.unitId, properties);
  if (Number($('unitSelect').value) !== old.unitId) {
    $('formMessage').textContent = `${old.unitName} is not available any more, so pick another unit.`;
    $('formMessage').classList.remove('hidden');
  }
  $('paymentTerms').value = old.paymentTerms;
}

/** Renewal: the tenant and unit stay the same, so those fields are locked. */
async function startRenewal() {
  const old = await api.get(`/api/leases/${renewId}`);
  $('pageTitle').textContent = `Renew Lease: ${old.tenantName}, ${old.unitName}`;
  $('breadcrumbTitle').textContent = 'Renew Lease';
  $('submitText').textContent = 'Create Renewal';
  $('renterUsername').value = old.renterUsername;
  $('tenantName').value = old.tenantName;
  $('tenantEmail').value = old.tenantEmail || '';
  $('tenantPhone').value = old.tenantPhone || '';
  $('propertySelect').value = old.propertyId;
  await loadUnits(old.propertyId, old.unitId);
  $('unitSelect').value = old.unitId;
  ['renterUsername', 'tenantName', 'tenantEmail', 'tenantPhone', 'propertySelect', 'unitSelect']
    .forEach((id) => { $(id).disabled = true; });
  $('monthlyRent').value = Number(old.monthlyRent);
  $('paymentTerms').value = old.paymentTerms;
  const nextDay = new Date(old.endDate + 'T00:00:00');
  nextDay.setDate(nextDay.getDate() + 1);
  $('startDate').value = toIsoDate(nextDay);
  nextDay.setFullYear(nextDay.getFullYear() + 1);
  nextDay.setDate(nextDay.getDate() - 1);
  $('endDate').value = toIsoDate(nextDay);
}

function toIsoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- summary
/** Months = start month through end month (same rule as LeaseContract.durationInMonths). */
function monthCount(start, end) {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
}

function calculateSummary() {
  const rent = parseFloat($('monthlyRent').value) || 0;
  const terms = $('paymentTerms').value;
  const startValue = $('startDate').value;
  const endValue = $('endDate').value;
  $('summaryRent').textContent = format.peso(rent);
  $('paymentNote').textContent = TERMS_NOTE[terms];

  if (startValue && endValue && endValue > startValue) {
    const start = new Date(startValue + 'T00:00:00');
    const end = new Date(endValue + 'T00:00:00');
    const months = monthCount(start, end);
    $('summaryDuration').textContent = `${format.date(startValue)} - ${format.date(endValue)}`;
    $('summaryMonths').textContent = months;
    $('totalContractValue').textContent = format.peso(rent * months);
    $('firstPayment').textContent = format.peso(rent * Math.min(MONTHS_PER_PERIOD[terms], months));
    const upcoming = start > new Date();
    $('statusTitle').textContent = upcoming ? 'Upcoming' : 'Active';
    $('statusNote').textContent = upcoming
      ? 'The lease starts on its start date. The unit is reserved (occupied) as soon as it is created.'
      : 'The lease is active right away and the unit becomes occupied.';
  } else {
    $('summaryDuration').textContent = '-';
    $('summaryMonths').textContent = '0';
    $('totalContractValue').textContent = format.peso(0);
    $('firstPayment').textContent = format.peso(0);
  }
}

// ---------------------------------------------------------------- contract PDF
function setupContractDrop() {
  const zone = $('dropZone');
  const input = $('contractFile');
  zone.addEventListener('click', (e) => { if (e.target !== input && !e.target.closest('#removeFileBtn')) input.click(); });
  input.addEventListener('change', () => { if (input.files.length) handleFile(input.files[0]); });
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('border-indigo-400', 'bg-indigo-50/30'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('border-indigo-400', 'bg-indigo-50/30'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('border-indigo-400', 'bg-indigo-50/30');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });
  $('removeFileBtn').addEventListener('click', removeFile);
}

function handleFile(file) {
  if (file.type !== 'application/pdf') { alert('Please upload a PDF file.'); return; }
  if (file.size > 10 * 1024 * 1024) { alert('File size exceeds 10MB limit.'); return; }
  selectedFile = file;
  $('fileName').textContent = file.name;
  $('fileSize').textContent = (file.size / 1024 / 1024).toFixed(2) + ' MB';
  $('dropZoneContent').classList.add('hidden');
  $('dropZoneFile').classList.remove('hidden');
}

function removeFile() {
  selectedFile = null;
  $('contractFile').value = '';
  $('dropZoneContent').classList.remove('hidden');
  $('dropZoneFile').classList.add('hidden');
}

// ---------------------------------------------------------------- submit
/** Shows the field's error text when ok is false; returns ok. */
function check(ok, errorId) {
  $(errorId).classList.toggle('hidden', ok);
  return ok;
}

async function handleFormSubmit(e) {
  e.preventDefault();
  $('formMessage').classList.add('hidden');
  const start = $('startDate').value;
  const end = $('endDate').value;
  const results = [
    check($('renterUsername').value.trim() !== '', 'renterError'),
    check($('tenantName').value.trim() !== '', 'tenantNameError'),
    // a renewal keeps the old contact details (locked), so they aren't checked again
    check(renewId || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($('tenantEmail').value.trim()), 'tenantEmailError'),
    check(renewId || /^[+]?[\d\s\-()]{10,}$/.test($('tenantPhone').value.trim()), 'tenantPhoneError'),
    check($('propertySelect').value !== '', 'propertyError'),
    check($('unitSelect').value !== '', 'unitError'),
    check(start !== '', 'startDateError'),
    check(end !== '', 'endDateError'),
    check(!start || !end || end > start, 'dateError'),
    check(parseFloat($('monthlyRent').value) > 0, 'rentError')
  ];
  if (results.includes(false)) {
    const firstError = document.querySelector('[id$="Error"]:not(.hidden)');
    if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  try {
    const lease = renewId
      ? await api.form('POST', `/api/leases/${renewId}/renew`, {
          newStartDate: start, newEndDate: end, newMonthlyRent: $('monthlyRent').value, paymentTerms: $('paymentTerms').value })
      : await api.form('POST', '/api/leases', {
          unitId: $('unitSelect').value,
          renterUsername: $('renterUsername').value.trim(),
          startDate: start,
          endDate: end,
          monthlyRent: $('monthlyRent').value,
          paymentTerms: $('paymentTerms').value,
          tenantName: $('tenantName').value.trim(),
          tenantEmail: $('tenantEmail').value.trim(),
          tenantPhone: $('tenantPhone').value.trim()
        });
    if (selectedFile) {
      const data = new FormData();
      data.append('file', selectedFile);
      await api.upload(`/api/leases/${lease.id}/files`, data);
    }
    $('toast').classList.remove('hidden');
    setTimeout(() => { location.href = `/lease.html?id=${lease.id}`; }, 1200);
  } catch (err) {
    $('formMessage').textContent = err.message;      // e.g. "Unit 103 is occupied, so it can't be leased right now."
    $('formMessage').classList.remove('hidden');
    $('formMessage').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}
