/*
 * property-form.js — script for landlord/property-form.html
 *
 * 1. const id = new URLSearchParams(location.search).get('id');   // null = adding
 * 2. Editing: fill the form from await api.get(`/api/properties/${id}`)
 * 3. Save:
 *      const fields = { name, address, type, description, exactSize, areaSqm, sizeDescription };
 *      id ? await api.form('PUT', `/api/properties/${id}`, fields)
 *         : await api.form('POST', '/api/properties', fields);
 *    Leave out empty optional fields so they arrive as null.
 * 4. Publish / Archive: api.form('POST', `/api/properties/${id}/publish`) or `/archive`
 */
document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.requireLogin('LANDLORD');
  // TODO
});
