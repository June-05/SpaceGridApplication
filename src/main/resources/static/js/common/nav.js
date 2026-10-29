/*
 * nav.js — the shared top bar (same look and links on every logged-in page).
 *
 * In the page:
 *   <header id="appNav" data-page="units"></header>
 *   <script src="/js/common/api.js"></script><script src="/js/common/auth.js"></script><script src="/js/common/nav.js"></script>
 * Needs Tailwind and Font Awesome on the page. data-page marks which link is highlighted:
 *   landlord: dashboard | units | leases | requests      renter: browse | leases | requests
 *   (any other value, e.g. "property", highlights nothing)
 *
 * What it builds: logo → role home · links for the role · bell with a number · user menu (name, Log Out;
 * on phone-width screens the links move into that menu too).
 * data-public="true" (the homepage): nobody logged in → a guest bar (List your space · Log in · Register)
 * instead of being sent to the login page. Fires window event "nav:user" with the user (or null).
 *
 * Bell (GET /api/lease-requests, which already returns the landlord's incoming or the renter's own requests):
 *   landlord → number of PENDING requests; the list links to requests.html
 *   renter   → requests decided (APPROVED / DECLINED) after the last one they looked at.
 *              "Looked at" = the newest decidedAt seen when requests.html was open (localStorage requestsSeenAt).
 *              It is kept in this browser only, so clearing site data brings the badge back.
 * Lease notices (GET /api/leases): leases closed in the last 14 days whose lease.html wasn't opened since
 * (lease.js adds the id to localStorage seenLeaseNotices):
 *   landlord → ended automatically (LeaseExpiryJob)   renter → ended or terminated (with the reason)
 * It refreshes when the page loads and every 60 seconds.
 *
 * "Last property": units.html / leases.html / the plotter / the property form remember their property id
 * (localStorage lastPropertyId) so the Units and Leases links in the bar open the property you were on.
 */
(() => {
  const LANDLORD_LINKS = [
    { key: 'dashboard', label: 'Dashboard', icon: 'fa-gauge-high', href: '/landlord/dashboard.html' },
    { key: 'units', label: 'Units', icon: 'fa-cubes', href: '/landlord/units.html', property: true },
    { key: 'leases', label: 'Leases', icon: 'fa-file-contract', href: '/landlord/leases.html' },      // all properties; the page narrows by ?propertyId=
    { key: 'requests', label: 'Requests', icon: 'fa-inbox', href: '/requests.html' }
  ];
  const RENTER_LINKS = [
    { key: 'browse', label: 'Browse spaces', icon: 'fa-magnifying-glass', href: '/' },
    { key: 'leases', label: 'My Leases', icon: 'fa-file-contract', href: '/renter/dashboard.html' },
    { key: 'requests', label: 'My Requests', icon: 'fa-inbox', href: '/requests.html' }
  ];
  const POLL_MS = 60000;
  const NEWEST_SHOWN = 5;
  const LEASE_NOTICE_DAYS = 14;              // a closed lease is announced for 2 weeks

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {                                      // localStorage can be blocked: never let it break the page
    get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* ignore */ } }
  };

  /** Remember the property this page is about (units/leases use ?propertyId=, the plotter and the form use ?id=). */
  function rememberProperty(page) {
    const params = new URLSearchParams(location.search);
    const id = (page === 'units' || page === 'leases') ? params.get('propertyId')
      : (page === 'grid' || page === 'property') ? params.get('id') : null;
    if (id && /^\d+$/.test(id)) store.set('lastPropertyId', id);
  }

  function linkHref(link) {
    const last = store.get('lastPropertyId');
    return link.property && last ? `${link.href}?propertyId=${last}` : link.href;
  }

  function linksHtml(links, page, mobile) {
    return links.map((link) => {
      const active = link.key === page;
      const cls = mobile
        ? `block px-4 py-2 text-xs font-semibold ${active ? 'text-indigo-700 bg-indigo-50' : 'text-slate-700 hover:bg-slate-50'}`
        : `flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition ${active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`;
      return `<a href="${linkHref(link)}" data-nav="${link.key}" class="${cls}"${active ? ' aria-current="page"' : ''}>`
        + `<i class="fa-solid ${link.icon} ${mobile ? 'mr-2 text-slate-400' : 'text-xs'}"></i>${link.label}</a>`;
    }).join('');
  }

  function render(el, user, page) {
    const landlord = user.role === 'LANDLORD';
    const links = landlord ? LANDLORD_LINKS : RENTER_LINKS;
    const name = user.fullName || '';
    const initials = name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
    el.className = 'bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm';
    el.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <div class="flex items-center gap-6 min-w-0">
          <a href="${auth.home(user)}" class="text-2xl font-black tracking-tight text-slate-900 flex-shrink-0">Space<span class="text-indigo-600">Grid</span></a>
          <nav class="hidden md:flex items-center gap-1" aria-label="Main">${linksHtml(links, page, false)}</nav>
        </div>
        <div class="flex items-center gap-3 flex-shrink-0 relative">
          <button id="navBell" type="button" aria-label="Notifications" class="relative w-9 h-9 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center transition">
            <i class="fa-regular fa-bell"></i>
            <span id="navBadge" class="hidden absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center"></span>
          </button>
          <div id="navBellPanel" class="hidden absolute right-12 top-12 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden"></div>
          <button id="navUserBtn" type="button" class="flex items-center gap-2.5 pl-3 border-l border-slate-200 select-none">
            <span class="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center ring-2 ring-indigo-600/10">${esc(initials)}</span>
            <span class="text-sm font-semibold text-slate-800 hidden lg:inline">${esc(name.split(' ')[0])}</span>
            <i class="fa-solid fa-chevron-down text-xs text-slate-400"></i>
          </button>
          <div id="navUserMenu" class="hidden absolute right-0 top-12 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50">
            <div class="px-4 py-2.5 border-b border-slate-100">
              <p class="text-xs font-bold text-slate-900">${esc(name)}</p>
              <p class="text-[11px] text-slate-400">${landlord ? 'Landlord' : 'Renter'}</p>
            </div>
            <div class="md:hidden border-b border-slate-100 py-1">${linksHtml(links, page, true)}</div>
            <button id="navLogout" type="button" class="block w-full text-left px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"><i class="fa-solid fa-right-from-bracket mr-2 text-rose-400"></i>Log Out</button>
          </div>
        </div>
      </div>`;
  }

  /** The requests the bell should tell the user about, newest first. */
  function requestItems(user, requests) {
    if (user.role === 'LANDLORD') {
      return requests.filter((r) => r.status === 'PENDING')
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    }
    const seen = store.get('requestsSeenAt') || '';
    return requests.filter((r) => (r.status === 'APPROVED' || r.status === 'DECLINED') && String(r.decidedAt || '') > seen)
      .sort((a, b) => String(b.decidedAt).localeCompare(String(a.decidedAt)));
  }

  /**
   * Leases that closed in the last LEASE_NOTICE_DAYS days and whose page wasn't opened since.
   * Landlord: ended automatically (decide what to do with the unit). Renter: ended or terminated.
   */
  function leaseItems(user, leases) {
    let seen = [];
    try { seen = JSON.parse(store.get('seenLeaseNotices') || '[]'); } catch (e) { /* ignore */ }
    const since = new Date(Date.now() - LEASE_NOTICE_DAYS * 86400000).toISOString().slice(0, 10);
    return leases.filter((l) => l.closedOn && String(l.closedOn) >= since && !seen.includes(l.id)
        && (user.role === 'LANDLORD' ? (l.status === 'ENDED' && l.endedAutomatically) : (l.status === 'ENDED' || l.status === 'TERMINATED')))
      .sort((a, b) => String(b.closedOn).localeCompare(String(a.closedOn)));
  }

  function requestHtml(user, r) {
    const where = `${esc(r.propertyName)} · ${esc(r.unitName)}`;
    const title = user.role === 'LANDLORD'
      ? `${esc(r.renterName)} wants to lease`
      : r.status === 'APPROVED' ? 'Request approved' : 'Request declined';
    const color = user.role === 'LANDLORD' ? 'text-amber-600' : r.status === 'APPROVED' ? 'text-emerald-600' : 'text-rose-600';
    return `<a href="/requests.html" class="block px-4 py-3 hover:bg-slate-50 border-b border-slate-100">
        <p class="text-xs font-bold ${color}">${title}</p>
        <p class="text-xs text-slate-600 truncate">${where}</p></a>`;
  }

  function leaseHtml(user, l) {
    const where = `${esc(l.propertyName)} · ${esc(l.unitName)}`;
    const terminated = l.status === 'TERMINATED';
    const title = user.role === 'LANDLORD' ? 'Lease ended automatically'
      : terminated ? 'Your lease was terminated' : 'Your lease has ended';
    const next = user.role === 'LANDLORD' ? `${esc(l.tenantName)} · lease it again or let the unit be listed`
      : terminated ? `Reason: ${esc(l.terminationReason || 'not given')}` : 'Pay anything left, or request a space again';
    return `<a href="/lease.html?id=${l.id}" class="block px-4 py-3 hover:bg-slate-50 border-b border-slate-100">
        <p class="text-xs font-bold ${terminated ? 'text-rose-600' : 'text-slate-800'}">${title}</p>
        <p class="text-xs text-slate-600 truncate">${where}</p>
        <p class="text-[11px] text-slate-500 truncate">${next}</p></a>`;
  }

  function paintBell(user, requests, leases) {
    const count = requests.length + leases.length;
    const badge = document.getElementById('navBadge');
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.classList.toggle('hidden', count === 0);
    const landlord = user.role === 'LANDLORD';
    const head = (text) => `<p class="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">${text}</p>`;
    let html = '';
    if (leases.length) {
      html += head(landlord ? 'Leases that ended' : 'Your leases') + leases.slice(0, NEWEST_SHOWN).map((l) => leaseHtml(user, l)).join('');
    }
    html += head(landlord ? 'Pending lease requests' : 'Decisions on your requests');
    html += requests.length
      ? requests.slice(0, NEWEST_SHOWN).map((r) => requestHtml(user, r)).join('')
      : `<p class="px-4 py-5 text-xs text-slate-500">${landlord ? 'No requests waiting for you.' : 'Nothing new.'}</p>`;
    document.getElementById('navBellPanel').innerHTML = html
      + `<a href="/requests.html" class="block px-4 py-2.5 text-center text-xs font-bold text-indigo-600 hover:bg-indigo-50">${landlord ? 'See all requests' : 'See my requests'}</a>`;
  }

  async function refreshBell(user, page) {
    try {
      const [requests, leases] = await Promise.all([api.get('/api/lease-requests'), api.get('/api/leases')]);
      paintBell(user, requestItems(user, requests), leaseItems(user, leases));
      if (user.role === 'RENTER' && page === 'requests') {          // looking at them now → mark as seen
        const newest = requests.map((r) => String(r.decidedAt || '')).sort().pop();
        if (newest) store.set('requestsSeenAt', newest);
      }
    } catch (err) { /* the bell is a convenience: stay quiet if the call fails */ }
  }

  function wireMenus(user, page) {
    const bell = document.getElementById('navBellPanel');
    const menu = document.getElementById('navUserMenu');
    document.getElementById('navBell').addEventListener('click', (e) => { e.stopPropagation(); menu.classList.add('hidden'); bell.classList.toggle('hidden'); });
    document.getElementById('navUserBtn').addEventListener('click', (e) => { e.stopPropagation(); bell.classList.add('hidden'); menu.classList.toggle('hidden'); });
    bell.addEventListener('click', (e) => e.stopPropagation());
    menu.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', () => { bell.classList.add('hidden'); menu.classList.add('hidden'); });
    document.getElementById('navLogout').addEventListener('click', () => auth.logout());
    refreshBell(user, page);
    setInterval(() => refreshBell(user, page), POLL_MS);
  }

  /** Public page (data-public="true") and nobody logged in: logo + List your space / Log in / Register. */
  function renderGuest(el) {
    el.className = 'bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm';
    el.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <a href="/" class="text-2xl font-black tracking-tight text-slate-900 flex-shrink-0">Space<span class="text-indigo-600">Grid</span></a>
        <div class="flex items-center gap-2">
          <a href="/register.html" class="hidden sm:flex items-center gap-2 px-3.5 py-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl text-xs font-semibold transition"><i class="fa-solid fa-house-chimney text-xs"></i>List your space</a>
          <a id="navLogin" href="/login.html" class="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition">Log in</a>
          <a href="/register.html" class="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition">Register</a>
        </div>
      </div>`;
  }

  /** Public pages: who is logged in, or null (no redirect to the login page). */
  async function currentUserOrNull() {
    try {
      const res = await fetch('/api/auth/me');
      return res.ok ? await res.json() : null;
    } catch (err) {
      return null;
    }
  }

  async function start() {
    const el = document.getElementById('appNav');
    if (!el) return;
    const page = el.dataset.page || '';
    rememberProperty(page);
    const isPublic = el.dataset.public === 'true';
    const user = isPublic ? await currentUserOrNull()
      : await auth.requireLogin();                   // not logged in → api.js sends them to /login.html
    window.navUser = user;
    window.dispatchEvent(new CustomEvent('nav:user', { detail: user }));
    if (!user) {
      renderGuest(el);
      return;
    }
    render(el, user, page);
    wireMenus(user, page);
  }

  document.addEventListener('DOMContentLoaded', start);
})();
