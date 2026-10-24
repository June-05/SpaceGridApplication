/*
 * api.js — shared by every page. Talks to the Spring Boot controllers with fetch().
 *
 * Match how the controller method reads its input:
 *   @RequestParam  → api.form(method, url, data)   sent like an HTML form (most endpoints)
 *   @RequestBody   → api.json(method, url, data)   sent as JSON (only the grid page's two PUTs)
 *   reading        → api.get(url)
 * Each call returns the JSON the controller returned (or null for void methods),
 * or throws an Error whose message is the server's {"error": "..."} text.
 * 401 (nobody logged in) → redirects to /login.html?next=<this page>, and login.js comes back here after login.
 */
const api = {
  get(url) {
    return this.send('GET', url);
  },

  form(method, url, data = {}) {
    return this.send(method, url, new URLSearchParams(data), 'application/x-www-form-urlencoded');
  },

  json(method, url, data) {
    return this.send(method, url, JSON.stringify(data), 'application/json');
  },

  async send(method, url, body, contentType) {
    const headers = contentType ? { 'Content-Type': contentType } : {};
    const res = await fetch(url, { method, body, headers });
    if (res.status === 401 && !location.pathname.endsWith('/login.html')) {
      location.href = '/login.html?next=' + encodeURIComponent(location.pathname + location.search);
      return new Promise(() => {});   // stop here quietly while the browser goes to the login page
    }
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      throw new Error((data && data.error) || `Request failed (${res.status})`);
    }
    return data;
  }
};
