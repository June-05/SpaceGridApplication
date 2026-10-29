/*
 * register.js — script for register.html (public page: no login check)
 *
 * 1. On submit: POST /api/auth/register { username, password, fullName, role, email, phone }  (email and phone are optional)
 * 2. Then log in right away (POST /api/auth/login) and go to the right dashboard (auth.home).
 * 3. Errors are shown under the form: "Username is already taken." (409), "Password must be at least 8 characters." (400).
 */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registerForm');
  const error = document.getElementById('error');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.textContent = '';
    const button = form.querySelector('button');
    button.disabled = true;
    const username = form.elements.username.value.trim();
    const password = form.elements.password.value;
    try {
      await api.form('POST', '/api/auth/register', {
        username,
        password,
        fullName: form.elements.fullName.value.trim(),
        role: form.elements.role.value,
        email: form.elements.email.value.trim(),
        phone: form.elements.phone.value.trim()
      });
      const user = await api.form('POST', '/api/auth/login', { username, password });
      location.href = auth.home(user);
    } catch (err) {
      error.textContent = err.message;
      button.disabled = false;
    }
  });
});
