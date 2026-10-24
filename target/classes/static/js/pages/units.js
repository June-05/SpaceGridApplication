/*
 * units.js — script for landlord/units.html
 *
 * 1. const propertyId = new URLSearchParams(location.search).get('propertyId');
 *    const units = await api.get(`/api/properties/${propertyId}/units`);
 * 2. Add:  api.form('POST', `/api/properties/${propertyId}/units`, { name, rentalRate, exactSize, areaSqm, sizeDescription, electricity, water })
 *    Edit: api.form('PUT', `/api/units/${unitId}`, { ...same fields })
 * 3. Maintenance: api.form('POST', `/api/units/${unitId}/maintenance`, { underMaintenance: true })
 *    Archive:     api.form('POST', `/api/units/${unitId}/archive`)
 *    Delete:      api.form('DELETE', `/api/units/${unitId}`)   // 409 "archive it instead" if it has leases
 * 4. Status badge: format.cssClass('status-', unit.status)
 */
document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.requireLogin('LANDLORD');
  // TODO
});
