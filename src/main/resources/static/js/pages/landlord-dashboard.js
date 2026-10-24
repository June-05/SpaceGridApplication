/*
 * landlord-dashboard.js — script for landlord/dashboard.html
 *
 * 1. Load:  const props = await api.get(`/api/properties?search=${encodeURIComponent(search)}&type=${type}`);
 *    (leave out type when "All" is selected)
 * 2. Render one card per property: name, address, propertyType, status, links to
 *    property-form.html?id=, property-grid.html?id=, units.html?propertyId=
 * 3. Reload when the search box or type filter changes.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.requireLogin('LANDLORD');
  // TODO
});
