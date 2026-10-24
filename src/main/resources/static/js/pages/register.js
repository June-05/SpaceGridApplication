/*
 * register.js — script for register.html
 *
 * 1. On form submit:
 *      await api.form('POST', '/api/auth/register', { username, password, fullName, role });
 * 2. Then go to /login.html (or log in right away with api.form('POST', '/api/auth/login', ...)).
 * 3. Errors: "Username is already taken." (409), "Password must be at least 8 characters." (400).
 */
document.addEventListener('DOMContentLoaded', async () => {
  // (public page: no login check)
  // TODO
});
