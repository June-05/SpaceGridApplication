/*
 * auth.js — login check for protected pages (uses AuthController).
 *
 * At the start of a page script:
 *   const user = await auth.requireLogin('LANDLORD');   // or 'RENTER'; no argument = any role
 * → GET /api/auth/me. Not logged in → api.js sends the user to /login.html.
 *   Wrong role → sent to their own dashboard.
 * Logout button:  logoutButton.onclick = () => auth.logout();
 */
const auth = {
  async requireLogin(role) {
    const user = await api.get('/api/auth/me');
    if (role && user.role !== role) {
      location.href = this.home(user);
    }
    return user;
  },

  home(user) {
    return user.role === 'LANDLORD' ? '/landlord/dashboard.html' : '/renter/dashboard.html';
  },

  async logout() {
    await api.form('POST', '/api/auth/logout');
    location.href = '/login.html';
  }
};
