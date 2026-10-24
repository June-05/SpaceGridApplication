/*
 * login.js — script for login.html
 * POST /api/auth/login (AuthController.login) with the form fields username and password.
 * After login: back to ?next= (set by api.js when a page needed login), otherwise auth.home(user).
 */
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
      location.href = next && next.startsWith('/') && !next.startsWith('//') ? next : auth.home(user);
    } catch (err) {
      error.textContent = err.message;          // e.g. "Invalid username or password."
    } finally {
      button.disabled = false;
    }
  });
});
