/*
 * login.js — script for login.html
 * POST /api/auth/login (AuthController.login) with the form fields username and password.
 * After login: back to ?next= (set by api.js when a page needed login), otherwise auth.home(user).
 * ?next= is only followed when it fits the role: landlords only go to /landlord/ pages,
 * renters never do. So a landlord who logs in from the homepage lands on their dashboard.
 */
function fitsRole(next, user) {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return false;   // only paths on this site
  const landlordPage = next.startsWith('/landlord/');
  return user.role === 'LANDLORD' ? landlordPage : !landlordPage;
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const error = document.getElementById('error');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.textContent = '';
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      const user = await api.form('POST', '/api/auth/login', {
        username: form.username.value.trim(),
        password: form.password.value
      });
      const next = new URLSearchParams(location.search).get('next');
      location.href = fitsRole(next, user) ? next : auth.home(user);
    } catch (err) {
      error.textContent = err.message;          // e.g. "Invalid username or password."
    } finally {
      button.disabled = false;
    }
  });
});
