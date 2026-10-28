/*
 * property-grid.js — the grid plotter (landlord/property-grid.html?id=1)
 *
 * 1. Load the property:            api.get(`/api/properties/${id}`)
 * 2. Edit in memory:               spots (paint/erase with a zone) and edge overrides (walls/doors/windows)
 * 3. "Save layout" sends two requests, in this order:
 *      api.json('PUT', `/api/properties/${id}/grid?rows=&cols=`, { "zoneId": [{row, col}] })
 *      api.json('PUT', `/api/properties/${id}/edges`, { "DOOR": [{row, col, orientation}] })
 * 4. Add a unit / common area:     api.form('POST', `/api/properties/${id}/units`, {...})
 *                                  api.form('POST', `/api/properties/${id}/common-areas`, {...})
 */
document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.requireLogin('LANDLORD');
  const MAX = 60;                       // same as Property.MAX_GRID_SIZE
  const ERASER = 'erase';
  // zoom = size of one spot in px. 48 px is shown as 100%. 'fit' = the whole grid fits the grid area.
  const CELL_MIN = 6, CELL_MAX = 96, CELL_BASE = 48, CELL_FIT_MAX = 72;
  const ZOOM_KEY = 'spacegrid.gridZoom';
  const EDGE_TOOLS = [
    { type: 'WALL', name: 'Wall', meta: 'Add a wall' },
    { type: 'DOOR', name: 'Door', meta: 'Doorway between spaces' },
    { type: 'WINDOW', name: 'Window', meta: 'Wall with a window' },
    { type: 'OPEN', name: 'No wall', meta: 'Remove an automatic wall' },
    { type: 'RESET', name: 'Automatic', meta: 'Undo the edit on a line' }
  ];

  const $ = (id) => document.getElementById(id);
  const el = {
    name: $('propertyName'), host: $('gridHost'), hint: $('hint'), summary: $('summary'),
    rows: $('inpRows'), cols: $('inpCols'), btnResize: $('btnResize'), btnSave: $('btnSave'),
    saveState: $('saveState'), zoneList: $('zoneList'), edgeList: $('edgeList'),
    spotTools: $('spotTools'), edgeTools: $('edgeTools'), toast: $('toast'),
    zoomSlider: $('zoomSlider'), zoomLabel: $('zoomLabel'), btnZoomFit: $('btnZoomFit'), fillGroup: $('fillGroup')
  };

  const propertyId = Number(new URLSearchParams(location.search).get('id'));
  const state = {
    layout: null, mode: 'spots', brush: null, edgeTool: 'DOOR', dirty: false, painting: false,
    zoom: loadZoom(),          // a cell size in px, or 'fit'
    fill: 'brush',             // 'brush' = paint spot by spot · 'rect' = drag a rectangle
    rect: null,                // { r0, c0, r1, c1 } while a rectangle is being dragged
    space: false,              // space bar held down: drag to pan
    pan: null                  // { x, y, left, top } while panning
  };

  // The zoom is remembered in this browser only. localStorage can be blocked, so every use is wrapped in try/catch.
  function loadZoom() {
    try {
      const saved = localStorage.getItem(ZOOM_KEY);
      const n = Number(saved);
      return saved && n >= CELL_MIN && n <= CELL_MAX ? Math.round(n) : 'fit';
    } catch (err) {
      return 'fit';
    }
  }
  function saveZoom() {
    try { localStorage.setItem(ZOOM_KEY, String(state.zoom)); } catch (err) { /* not remembered, still works */ }
  }

  // ------------------------------------------------------------------ helpers
  let toastTimer;
  function toast(message, isError) {
    el.toast.textContent = message;
    el.toast.classList.toggle('is-error', Boolean(isError));
    el.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('is-visible'), 3500);
  }

  function setDirty(dirty) {
    state.dirty = dirty;
    el.btnSave.disabled = !dirty;
    el.saveState.textContent = dirty ? 'Unsaved changes' : '';
    el.saveState.classList.toggle('is-dirty', dirty);
  }

  const visibleZones = () => state.layout.zones.filter(z => !(z.rentable && z.status === 'ARCHIVED'));
  const spotCounts = () => {
    const counts = new Map();
    for (const id of state.layout.cells.values()) counts.set(id, (counts.get(id) || 0) + 1);
    return counts;
  };

  // ------------------------------------------------------------------ zoom
  const clampCell = (n) => Math.max(CELL_MIN, Math.min(CELL_MAX, Math.round(n)));

  /** Spot size that makes the whole grid fit the grid area (it is at most 78% of the window high, see grid.css). */
  function fitCell() {
    const L = state.layout;
    const width = el.host.clientWidth - 26;                       // minus the padding of the grid area
    const height = Math.floor(window.innerHeight * 0.78) - 26;
    return Math.max(CELL_MIN, Math.min(CELL_FIT_MAX, Math.floor(Math.min(width / L.cols, height / L.rows))));
  }

  const currentCell = () => (typeof state.zoom === 'number' ? state.zoom : fitCell());

  /** value = a cell size in px or 'fit'. (ax, ay) = a screen point that stays in place (default: the middle). */
  function setZoom(value, ax, ay) {
    const host = el.host;
    const box = host.getBoundingClientRect();
    const mx = ax == null ? host.clientWidth / 2 : ax - box.left;
    const my = ay == null ? host.clientHeight / 2 : ay - box.top;
    const fx = (host.scrollLeft + mx) / Math.max(host.scrollWidth, 1);
    const fy = (host.scrollTop + my) / Math.max(host.scrollHeight, 1);
    state.zoom = value === 'fit' ? 'fit' : clampCell(value);
    saveZoom();
    render();
    host.scrollLeft = fx * host.scrollWidth - mx;
    host.scrollTop = fy * host.scrollHeight - my;
  }

  function zoomBy(factor, ax, ay) {
    const base = currentCell();
    let next = clampCell(base * factor);
    if (next === base) next = clampCell(base + (factor > 1 ? 1 : -1));   // always move at least 1 px
    setZoom(next, ax, ay);
  }

  function renderZoomControls() {
    const cell = currentCell();
    el.zoomSlider.value = cell;
    el.zoomLabel.textContent = `${Math.round((cell / CELL_BASE) * 100)}%`;
    el.btnZoomFit.classList.toggle('is-active', state.zoom === 'fit');
  }

  // ------------------------------------------------------------------ rendering
  // Painting by dragging calls scheduleRender() for every spot; the grid is drawn at most once per frame.
  let renderFrame = 0;
  function scheduleRender() {
    if (!renderFrame) renderFrame = requestAnimationFrame(() => { renderFrame = 0; render(); });
  }

  function render() {
    const L = state.layout;
    el.rows.value = L.rows;
    el.cols.value = L.cols;
    el.fillGroup.hidden = state.mode !== 'spots';
    gridRenderer.render(el.host, L, {
      mode: state.mode,
      brushZoneId: typeof state.brush === 'number' ? state.brush : null,
      cell: currentCell()
    });
    renderZoomControls();
    renderSidebar();
    const units = visibleZones().filter(z => z.rentable);
    const counts = spotCounts();
    el.summary.textContent = `${L.cells.size} of ${L.rows * L.cols} spots assigned · `
      + `${units.filter(u => counts.has(u.id)).length} of ${units.length} units placed · `
      + `${L.overrides.size} wall/door/window edit${L.overrides.size === 1 ? '' : 's'}`;
    el.hint.textContent = hintText();
  }

  function hintText() {
    if (state.mode === 'edges') {
      const tool = EDGE_TOOLS.find(t => t.type === state.edgeTool);
      return `${tool.name}: click a line between spots (or on the outer border).`;
    }
    const how = state.fill === 'rect' ? 'drag a rectangle' : 'click or drag across spots';
    const nav = ' Zoom: Ctrl + wheel. Pan: hold space and drag.';
    if (state.brush === ERASER) return `Eraser: ${how} to clear spots. Esc to stop.${nav}`;
    if (state.brush != null) {
      const z = gridRenderer.zoneById(state.layout, state.brush);
      return `Placing ${z ? z.name : 'zone'}: ${how}. Esc to stop.${nav}`;
    }
    return `Pick a zone on the right, or click a placed spot to pick its zone.${nav}`;
  }

  function item({ key, name, meta, badge, warn, zone, selected }) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'zone-item' + (selected ? ' is-selected' : '');
    btn.dataset.key = key;
    const sw = document.createElement('span');
    if (zone) {
      sw.className = 'swatch ' + zone.cssClasses;
      sw.style.setProperty('--zone-color', zone.color);
    } else {
      sw.className = `swatch swatch-tool swatch-${String(key).toLowerCase()}`;
    }
    const text = document.createElement('span');
    text.className = 'zone-text';
    text.innerHTML = '<span class="zone-name"></span><span class="zone-meta"></span>';
    text.children[0].textContent = name;
    text.children[1].textContent = meta;
    btn.append(sw, text);
    if (badge) {
      const b = document.createElement('span');
      b.className = 'badge' + (warn ? ' badge-warn' : '');
      b.textContent = badge;
      btn.appendChild(b);
    }
    return btn;
  }

  function renderSidebar() {
    el.spotTools.hidden = state.mode !== 'spots';
    el.edgeTools.hidden = state.mode !== 'edges';
    const counts = spotCounts();

    const list = [item({ key: ERASER, name: 'Eraser', meta: 'Clear spots', selected: state.brush === ERASER })];
    const units = visibleZones().filter(z => z.rentable);
    const areas = visibleZones().filter(z => !z.rentable);
    const heading = (t) => { const h = document.createElement('h3'); h.textContent = t; return h; };
    list.push(heading(`Units (${units.length})`));
    if (!units.length) list.push(Object.assign(document.createElement('p'), { className: 'empty-note', textContent: 'No units yet. Add one below.' }));
    for (const u of units) {
      const n = counts.get(u.id) || 0;
      list.push(item({ key: u.id, zone: u, name: u.name, selected: state.brush === u.id,
        meta: `${format.label(u.status)} · ${format.peso(u.rentalRate)}/mo`,
        badge: n ? `${n} spot${n === 1 ? '' : 's'}` : 'Not placed', warn: !n }));
    }
    list.push(heading(`Common areas (${areas.length})`));
    if (!areas.length) list.push(Object.assign(document.createElement('p'), { className: 'empty-note', textContent: 'Walkways, grass, shared rooms…' }));
    for (const a of areas) {
      const n = counts.get(a.id) || 0;
      list.push(item({ key: a.id, zone: a, name: a.name, selected: state.brush === a.id,
        meta: format.label(a.areaType), badge: n ? `${n} spot${n === 1 ? '' : 's'}` : 'Not placed', warn: !n }));
    }
    el.zoneList.replaceChildren(...list);

    el.edgeList.replaceChildren(...EDGE_TOOLS.map(t =>
      item({ key: t.type, name: t.name, meta: t.meta, selected: state.edgeTool === t.type })));
  }

  // ------------------------------------------------------------------ editing
  function selectBrush(key) {
    state.brush = state.brush === key ? null : key;
    render();
  }

  function paint(r, c) {
    const L = state.layout;
    const k = gridRenderer.cellKey(r, c);
    if (state.brush === ERASER) {
      if (!L.cells.has(k)) return false;
      L.cells.delete(k);
    } else if (typeof state.brush === 'number') {
      if (L.cells.get(k) === state.brush) return false;
      L.cells.set(k, state.brush);
    } else {
      return false;
    }
    setDirty(true);
    return true;
  }

  function applyEdge(orientation, r, c) {
    const key = gridRenderer.edgeKey(orientation, r, c);
    const L = state.layout;
    if (state.edgeTool === 'RESET') {
      if (!L.overrides.delete(key)) return;
    } else if (state.edgeTool === 'WALL' && gridRenderer.autoWall(L, orientation, r, c)) {
      L.overrides.delete(key);                      // already an automatic wall: no edit needed
    } else {
      L.overrides.set(key, state.edgeTool);
    }
    setDirty(true);
    render();
  }

  const cellFrom = (target) => {
    const cell = target && target.closest ? target.closest('.cell') : null;
    return cell && el.host.contains(cell) ? cell : null;
  };

  // ---- rectangle fill: drag from one spot to another, everything in between gets the brush (or the eraser)
  function rectBounds() {
    const { r0, c0, r1, c1 } = state.rect;
    return { top: Math.min(r0, r1), bottom: Math.max(r0, r1), left: Math.min(c0, c1), right: Math.max(c0, c1) };
  }

  let previewFrame = 0;
  function schedulePreview() {
    if (previewFrame) return;
    previewFrame = requestAnimationFrame(() => {
      previewFrame = 0;
      const b = state.rect ? rectBounds() : null;
      el.host.querySelectorAll('.cell').forEach(cell => {
        const r = Number(cell.dataset.row), c = Number(cell.dataset.col);
        cell.classList.toggle('is-preview', Boolean(b) && r >= b.top && r <= b.bottom && c >= b.left && c <= b.right);
      });
    });
  }

  function finishRect() {
    if (!state.rect) return;
    const b = rectBounds();
    state.rect = null;
    let changed = 0;
    for (let r = b.top; r <= b.bottom; r++) for (let c = b.left; c <= b.right; c++) if (paint(r, c)) changed++;
    if (changed) render(); else schedulePreview();
  }

  // ---- pan: space bar + drag, or the middle mouse button
  function startPan(e) {
    e.preventDefault();
    state.pan = { x: e.clientX, y: e.clientY, left: el.host.scrollLeft, top: el.host.scrollTop };
    el.host.classList.add('is-panning');
  }
  function stopPan() {
    state.pan = null;
    el.host.classList.remove('is-panning');
  }

  el.host.addEventListener('pointerdown', (e) => {
    if (e.button === 1 || (e.button === 0 && state.space)) { startPan(e); return; }
    if (e.button > 0) return;
    if (state.mode === 'edges') {
      const h = e.target.closest('.edge-handle');
      if (h) applyEdge(h.dataset.orientation, Number(h.dataset.row), Number(h.dataset.col));
      return;
    }
    const cell = cellFrom(e.target);
    if (!cell) return;
    const r = Number(cell.dataset.row), c = Number(cell.dataset.col);
    if (state.brush == null) {                      // no tool: clicking a placed spot picks its zone
      const zone = gridRenderer.zoneAt(state.layout, r, c);
      if (zone) selectBrush(zone.id); else toast('Pick a zone on the right first.');
      return;
    }
    e.preventDefault();
    if (e.target.hasPointerCapture && e.target.hasPointerCapture(e.pointerId)) e.target.releasePointerCapture(e.pointerId);
    if (state.fill === 'rect') {
      state.rect = { r0: r, c0: c, r1: r, c1: c };
      schedulePreview();
      return;
    }
    state.painting = true;
    if (paint(r, c)) scheduleRender();
  });
  el.host.addEventListener('pointermove', (e) => {
    if (state.pan) {
      el.host.scrollLeft = state.pan.left - (e.clientX - state.pan.x);
      el.host.scrollTop = state.pan.top - (e.clientY - state.pan.y);
      return;
    }
    if (!state.painting && !state.rect) return;
    const cell = cellFrom(document.elementFromPoint(e.clientX, e.clientY));
    if (!cell) return;
    const r = Number(cell.dataset.row), c = Number(cell.dataset.col);
    if (state.rect) {
      if (state.rect.r1 !== r || state.rect.c1 !== c) { state.rect.r1 = r; state.rect.c1 = c; schedulePreview(); }
    } else if (paint(r, c)) {
      scheduleRender();
    }
  });
  const endPointer = () => { state.painting = false; stopPan(); finishRect(); };
  window.addEventListener('pointerup', endPointer);
  window.addEventListener('pointercancel', () => { state.rect = null; state.painting = false; stopPan(); schedulePreview(); });

  // ---- zoom controls: buttons, slider, Ctrl + wheel (or pinch), keys + - 0
  $('btnZoomOut').addEventListener('click', () => zoomBy(1 / 1.25));
  $('btnZoomIn').addEventListener('click', () => zoomBy(1.25));
  el.btnZoomFit.addEventListener('click', () => setZoom('fit'));
  el.zoomSlider.addEventListener('input', () => setZoom(Number(el.zoomSlider.value)));

  // the wheel can fire many times per frame: collect the steps and zoom once per frame
  let wheelFrame = 0, wheelFactor = 1, wheelX = 0, wheelY = 0;
  el.host.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;          // a plain wheel still scrolls
    e.preventDefault();
    wheelFactor *= e.deltaY < 0 ? 1.1 : 1 / 1.1;
    wheelX = e.clientX;
    wheelY = e.clientY;
    if (!wheelFrame) {
      wheelFrame = requestAnimationFrame(() => {
        wheelFrame = 0;
        const factor = wheelFactor;
        wheelFactor = 1;
        zoomBy(factor, wheelX, wheelY);
      });
    }
  }, { passive: false });

  document.querySelectorAll('.seg[data-fill]').forEach(btn => btn.addEventListener('click', () => {
    state.fill = btn.dataset.fill;
    state.rect = null;
    document.querySelectorAll('.seg[data-fill]').forEach(b => {
      b.classList.toggle('is-active', b === btn);
      b.setAttribute('aria-pressed', String(b === btn));
    });
    render();
  }));

  el.zoneList.addEventListener('click', (e) => {
    const btn = e.target.closest('.zone-item');
    if (btn) selectBrush(btn.dataset.key === ERASER ? ERASER : Number(btn.dataset.key));
  });
  el.edgeList.addEventListener('click', (e) => {
    const btn = e.target.closest('.zone-item');
    if (btn) { state.edgeTool = btn.dataset.key; render(); }
  });
  document.querySelectorAll('.seg[data-mode]').forEach(btn => btn.addEventListener('click', () => {
    state.mode = btn.dataset.mode;
    document.querySelectorAll('.seg[data-mode]').forEach(b => {
      b.classList.toggle('is-active', b === btn);
      b.setAttribute('aria-pressed', String(b === btn));
    });
    render();
  }));
  const typingInField = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.rect) { state.rect = null; schedulePreview(); return; }      // first Esc: drop the rectangle
      if (state.brush != null) selectBrush(state.brush);
      return;
    }
    if (typingInField(e) || e.ctrlKey || e.metaKey || e.altKey || !state.layout) return;
    if (e.key === ' ') {                                                      // hold space to pan
      e.preventDefault();
      if (!state.space) { state.space = true; el.host.classList.add('is-pan-ready'); }
    } else if (e.key === '+' || e.key === '=') {
      zoomBy(1.25);
    } else if (e.key === '-') {
      zoomBy(1 / 1.25);
    } else if (e.key === '0') {
      setZoom('fit');
    }
  });
  document.addEventListener('keyup', (e) => {
    if (e.key !== ' ') return;
    if (!typingInField(e)) e.preventDefault();       // a focused button would otherwise be "clicked" by the space bar
    state.space = false;
    el.host.classList.remove('is-pan-ready');
  });
  window.addEventListener('blur', () => { state.space = false; el.host.classList.remove('is-pan-ready'); });
  $('btnResetEdges').addEventListener('click', () => {
    if (!state.layout.overrides.size) return;
    state.layout.overrides.clear();
    setDirty(true);
    render();
  });
  window.addEventListener('resize', () => state.layout && render());
  window.addEventListener('beforeunload', (e) => { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });
  $('btnLogout').addEventListener('click', () => auth.logout());

  // ------------------------------------------------------------------ resize
  el.btnResize.addEventListener('click', () => {
    const rows = Number(el.rows.value), cols = Number(el.cols.value);
    const L = state.layout;
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1 || rows > MAX || cols > MAX) {
      toast(`Rows and columns must be whole numbers from 1 to ${MAX}.`, true);
      return;
    }
    if (rows === L.rows && cols === L.cols) return;
    const cellsOut = [...L.cells.keys()].filter(k => { const [r, c] = k.split(',').map(Number); return r >= rows || c >= cols; });
    const edgesOut = [...L.overrides.keys()].filter(k => {
      const [o, r, c] = k.split(':'); const R = Number(r), C = Number(c);
      return o === 'HORIZONTAL' ? (R > rows || C >= cols) : (R >= rows || C > cols);
    });
    if ((cellsOut.length || edgesOut.length) &&
        !confirm(`Resizing to ${rows} × ${cols} removes ${cellsOut.length} spot(s) and ${edgesOut.length} wall/door edit(s). Continue?`)) {
      render();
      return;
    }
    cellsOut.forEach(k => L.cells.delete(k));
    edgesOut.forEach(k => L.overrides.delete(k));
    L.rows = rows;
    L.cols = cols;
    setDirty(true);
    render();
  });

  // ------------------------------------------------------------------ save (two requests)
  el.btnSave.addEventListener('click', async () => {
    const L = state.layout;
    el.btnSave.disabled = true;
    el.saveState.textContent = 'Saving…';
    try {
      await api.json('PUT', `/api/properties/${propertyId}/grid?rows=${L.rows}&cols=${L.cols}`, gridRenderer.toSpotsByZone(L));
    } catch (err) {
      setDirty(true);
      toast(err.message, true);
      return;
    }
    try {
      const saved = await api.json('PUT', `/api/properties/${propertyId}/edges`, gridRenderer.toEdgesByType(L));
      load(saved);
      el.saveState.textContent = 'All changes saved';
      toast('Layout saved.');
    } catch (err) {
      setDirty(true);
      toast(`Spots were saved, but walls and doors were not: ${err.message}`, true);
    }
  });

  // ------------------------------------------------------------------ add unit / common area
  async function addZone(form, url, fields) {
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const zone = await api.form('POST', url, fields);
      state.layout.zones.push({ ...zone, positions: [] });
      state.brush = zone.id;                        // ready to place
      form.reset();
      render();
      toast(`${zone.name} added. Click or drag spots to place it.`);
    } catch (err) {
      toast(err.message, true);
    } finally {
      btn.disabled = false;
    }
  }

  $('addUnitForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const name = f.name.value.trim();
    const rate = f.rentalRate.value;
    if (!name) return toast('Give the unit a name.', true);
    if (rate === '' || Number(rate) < 0) return toast('Enter a monthly rate of 0 or more.', true);
    const fields = { name, rentalRate: rate, electricity: f.electricity.checked, water: f.water.checked };
    if (f.areaSqm.value) Object.assign(fields, { exactSize: true, areaSqm: f.areaSqm.value });
    addZone(f, `/api/properties/${propertyId}/units`, fields);
  });

  $('addAreaForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const name = f.name.value.trim();
    if (!name) return toast('Give the common area a name.', true);
    addZone(f, `/api/properties/${propertyId}/common-areas`, { name, areaType: f.areaType.value });
  });

  // ------------------------------------------------------------------ start
  function load(property) {
    state.layout = gridRenderer.fromProperty(property);
    if (typeof state.brush === 'number' && !gridRenderer.zoneById(state.layout, state.brush)) state.brush = null;
    el.name.textContent = property.name;
    document.title = `${property.name} · Grid · SpaceGrid`;
    setDirty(false);
    render();
  }

  if (!Number.isInteger(propertyId) || propertyId < 1) {
    el.name.textContent = 'No property selected';
    el.hint.textContent = 'Open this page as /landlord/property-grid.html?id=<property id>.';
    return;
  }
  try {
    load(await api.get(`/api/properties/${propertyId}`));
  } catch (err) {
    el.name.textContent = 'Property grid';
    el.hint.textContent = err.message;
    el.hint.classList.add('is-error');
  }
});
