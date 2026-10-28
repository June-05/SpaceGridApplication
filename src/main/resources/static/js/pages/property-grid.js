/*
 * property-grid.js — the grid plotter (landlord/property-grid.html?id=1)
 *
 * 1. Load the property:            api.get(`/api/properties/${id}`)
 * 2. Edit in memory:               spots (paint/erase with a zone) and edge overrides (walls/doors/windows)
 * 3. "Save" sends two requests, in this order:
 *      api.json('PUT', `/api/properties/${id}/grid?rows=&cols=`, { "zoneId": [{row, col}] })
 *      api.json('PUT', `/api/properties/${id}/edges`, { "DOOR": [{row, col, orientation}] })
 * 4. Add a unit / common area:     api.form('POST', `/api/properties/${id}/units`, {...})
 *                                  api.form('POST', `/api/properties/${id}/common-areas`, {...})
 *
 * Screen: the grid fills the window; toolbar (bottom), Zones panel (floating, floating-panel.js), size and zoom
 * controls float on top. Every keyboard shortcut is in SHORTCUTS below (the "?" dialog is built from the same list).
 * Undo / redo keep snapshots of the size, spots and edge overrides (gridRenderer.snapshot); adding a zone is
 * saved on the server at once and is not undone.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.requireLogin('LANDLORD');
  const MAX = 60;                       // same as Property.MAX_GRID_SIZE
  const ERASER = 'erase';
  // zoom = size of one spot in px. 48 px is shown as 100%. 'fit' = the whole grid fits the window.
  const CELL_MIN = 6, CELL_MAX = 96, CELL_BASE = 48, CELL_FIT_MAX = 72;
  const ZOOM_KEY = 'spacegrid.gridZoom';
  const PANEL_KEY = 'spacegrid.zonesPanel';
  const HISTORY_LIMIT = 100;
  const SPOT_TOOLS = { hand: 'Hand', brush: 'Brush', rect: 'Rectangle', [ERASER]: 'Eraser' };
  const EDGE_TOOLS = { hand: 'Hand', WALL: 'Wall', DOOR: 'Door', WINDOW: 'Window', [ERASER]: 'Eraser' };
  const EDGE_BY_DIGIT = { 1: 'WALL', 2: 'DOOR', 3: 'WINDOW' };

  const $ = (id) => document.getElementById(id);
  const el = {
    name: $('propertyName'), host: $('gridHost'), hint: $('hint'), summary: $('summary'), sizeLabel: $('sizeLabel'),
    btnSave: $('btnSave'), saveState: $('saveState'), btnUndo: $('btnUndo'), btnRedo: $('btnRedo'),
    panelTitle: $('panelTitle'), spotTools: $('spotTools'), edgeTools: $('edgeTools'),
    zoneList: $('zoneList'), zoneFilter: $('zoneFilter'), zoneChip: $('zoneChip'),
    zoneChipSwatch: $('zoneChipSwatch'), zoneChipName: $('zoneChipName'),
    spotToolBtns: $('spotToolBtns'), edgeToolBtns: $('edgeToolBtns'),
    sizePop: $('sizePop'), rows: $('inpRows'), cols: $('inpCols'), sizeNote: $('sizeNote'), btnSize: $('btnSize'),
    zoomPop: $('zoomPop'), zoomLabel: $('zoomLabel'), btnZoomMenu: $('btnZoomMenu'),
    menuPop: $('menuPop'), btnMenu: $('btnMenu'),
    addUnitBox: $('addUnitBox'), addAreaBox: $('addAreaBox'),
    dialog: $('shortcutsDialog'), toast: $('toast')
  };

  const propertyId = Number(new URLSearchParams(location.search).get('id'));
  const state = {
    layout: null,
    mode: 'spots',             // 'spots' | 'edges'
    tool: 'hand',              // spots tool: hand | brush | rect | erase
    edgeTool: 'hand',          // edges tool: hand | WALL | DOOR | WINDOW | erase
    zoneId: null,              // the zone the Brush / Rectangle paint with
    zoom: loadZoom(),          // a cell size in px, or 'fit'
    painting: false,           // dragging the brush or eraser over spots
    edgePainting: false,       // dragging a wall/door/window/eraser tool along lines
    lastEdgeKey: null,         // the line the drag touched last (so one line is not applied twice in a row)
    rect: null,                // { r0, c0, r1, c1, erase } while a rectangle is being dragged
    stroke: null,              // snapshot taken when a drag starts (becomes one undo step)
    space: false,              // space bar held down: drag to pan
    pan: null,                 // { x, y, left, top } while panning
    openPop: null,             // { pop, anchor } of the open popover
    dirty: false,
    saving: false,
    saved: false               // true after a save, until the next change
  };
  const history = { undo: [], redo: [], saved: null };   // saved = snapshot of what the server has

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

  const panel = floatingPanel.init($('panel'), {
    storageKey: PANEL_KEY,
    handle: $('panelHead'),
    minimizeButton: $('btnPanelMin'),
    startMinimized: window.innerWidth < 760
  });

  // ------------------------------------------------------------------ helpers
  let toastTimer;
  function toast(message, isError) {
    el.toast.textContent = message;
    el.toast.classList.toggle('is-error', Boolean(isError));
    el.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('is-visible'), 3500);
  }

  const visibleZones = () => state.layout.zones.filter(z => !(z.rentable && z.status === 'ARCHIVED'));
  /** Units first, then common areas: the order of the list and of the 1–9 keys. */
  const orderedZones = () => [...visibleZones().filter(z => z.rentable), ...visibleZones().filter(z => !z.rentable)];
  const spotCounts = () => {
    const counts = new Map();
    for (const id of state.layout.cells.values()) counts.set(id, (counts.get(id) || 0) + 1);
    return counts;
  };
  const activeTool = () => (state.mode === 'edges' ? state.edgeTool : state.tool);
  const currentZone = () => (state.zoneId == null ? null : gridRenderer.zoneById(state.layout, state.zoneId));
  const busy = () => state.painting || state.edgePainting || Boolean(state.rect) || Boolean(state.pan);

  // ------------------------------------------------------------------ undo / redo
  /** Call after an edit with the snapshot taken before it. Returns true if the edit changed anything. */
  function commitAction(before) {
    if (gridRenderer.sameSnapshot(before, state.layout)) return false;
    history.undo.push(before);
    if (history.undo.length > HISTORY_LIMIT) history.undo.shift();
    history.redo = [];
    state.saved = false;
    return true;
  }

  function undo() {
    if (busy() || !history.undo.length) return;
    history.redo.push(gridRenderer.snapshot(state.layout));
    gridRenderer.restore(state.layout, history.undo.pop());
    render();
  }

  function redo() {
    if (busy() || !history.redo.length) return;
    history.undo.push(gridRenderer.snapshot(state.layout));
    gridRenderer.restore(state.layout, history.redo.pop());
    render();
  }

  function updateSaveState() {
    state.dirty = Boolean(state.layout) && !gridRenderer.sameSnapshot(history.saved, state.layout);
    el.btnSave.disabled = !state.dirty || state.saving;
    el.saveState.textContent = state.saving ? 'Saving…' : state.dirty ? 'Unsaved' : state.saved ? 'Saved' : '';
    el.saveState.classList.toggle('is-dirty', state.dirty && !state.saving);
    el.btnUndo.disabled = !history.undo.length;
    el.btnRedo.disabled = !history.redo.length;
  }

  // ------------------------------------------------------------------ zoom
  const clampCell = (n) => Math.max(CELL_MIN, Math.min(CELL_MAX, Math.round(n)));

  /** Spot size that makes the whole grid fit the canvas (inside its padding, so the floating parts don't cover it). */
  function fitCell() {
    const L = state.layout;
    const cs = getComputedStyle(el.host);
    const pad = (side) => parseFloat(cs[`padding${side}`]) || 0;
    const width = el.host.clientWidth - pad('Left') - pad('Right');
    const height = el.host.clientHeight - pad('Top') - pad('Bottom');
    return Math.max(CELL_MIN, Math.min(CELL_FIT_MAX, Math.floor(Math.min(width / L.cols, height / L.rows))));
  }

  const currentCell = () => (typeof state.zoom === 'number' ? state.zoom : fitCell());

  /** value = a cell size in px or 'fit'. (ax, ay) = a screen point that stays in place (default: the middle). */
  function setZoom(value, ax, ay) {
    if (!state.layout) return;
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
    if (!state.layout) return;
    const base = currentCell();
    let next = clampCell(base * factor);
    if (next === base) next = clampCell(base + (factor > 1 ? 1 : -1));   // always move at least 1 px
    setZoom(next, ax, ay);
  }

  // ------------------------------------------------------------------ rendering
  // Painting by dragging calls scheduleRender() for every spot; the grid is drawn at most once per frame.
  let renderFrame = 0;
  function scheduleRender() {
    if (!renderFrame) renderFrame = requestAnimationFrame(() => { renderFrame = 0; render(); });
  }

  function render() {
    const L = state.layout;
    if (!L) return;
    gridRenderer.render(el.host, L, {
      mode: state.mode,
      brushZoneId: state.mode === 'spots' && state.tool !== ERASER ? state.zoneId : null,
      cell: currentCell()
    });
    el.host.classList.toggle('mode-spots', state.mode === 'spots');
    el.host.classList.toggle('mode-edges', state.mode === 'edges');
    el.host.classList.toggle('tool-hand', activeTool() === 'hand');
    renderToolbar();
    renderPanel();
    renderStatus();
    el.zoomLabel.textContent = `${Math.round((currentCell() / CELL_BASE) * 100)}%`;
    el.hint.textContent = hintText();
    el.hint.classList.remove('is-error');
    updateSaveState();
    if (!el.sizePop.hidden) updateSizePreview();
  }

  function renderToolbar() {
    document.querySelectorAll('[data-mode]').forEach(b => {
      b.classList.toggle('is-active', b.dataset.mode === state.mode);
      b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode));
    });
    el.spotToolBtns.hidden = state.mode !== 'spots';
    el.edgeToolBtns.hidden = state.mode !== 'edges';
    el.spotToolBtns.querySelectorAll('[data-tool]').forEach(b => {
      b.classList.toggle('is-active', b.dataset.tool === state.tool);
      b.setAttribute('aria-pressed', String(b.dataset.tool === state.tool));
    });
    el.edgeToolBtns.querySelectorAll('[data-edge]').forEach(b => {
      b.classList.toggle('is-active', b.dataset.edge === state.edgeTool);
      b.setAttribute('aria-pressed', String(b.dataset.edge === state.edgeTool));
    });
    const zone = currentZone();
    el.zoneChip.classList.toggle('is-empty', !zone);
    el.zoneChipName.textContent = zone ? zone.name : 'Pick a zone';
    el.zoneChipSwatch.className = 'swatch' + (zone ? ' ' + zone.cssClasses : '');
    el.zoneChipSwatch.style.setProperty('--zone-color', zone ? zone.color : '#e2e8f0');
  }

  function renderStatus() {
    const L = state.layout;
    const units = visibleZones().filter(z => z.rentable);
    const counts = spotCounts();
    el.sizeLabel.textContent = `${L.rows} × ${L.cols}`;
    el.summary.textContent = `${L.cells.size}/${L.rows * L.cols} spots · `
      + `${units.filter(u => counts.has(u.id)).length}/${units.length} units placed · `
      + `${L.overrides.size} wall edit${L.overrides.size === 1 ? '' : 's'}`;
  }

  function hintText() {
    const zone = currentZone();
    if (state.mode === 'edges') {
      if (state.edgeTool === 'hand') return 'Hand: drag to move around. Tools: 1 Wall · 2 Door · 3 Window · E Eraser · ? for all keys';
      return `${EDGE_TOOLS[state.edgeTool]}: click or drag along the lines between spots. Esc for the Hand.`;
    }
    if (state.tool === 'hand') return 'Hand: drag to move around. Tools: B Brush · R Rectangle · E Eraser · 1–9 zones · ? for all keys';
    if (state.tool === ERASER) return 'Eraser: click or drag to clear spots. Shift + drag = rectangle.';
    if (!zone) return `${SPOT_TOOLS[state.tool]}: pick a zone first (1–9 or the Zones panel), or Alt + click a placed spot.`;
    if (state.tool === 'rect') return `Rectangle · ${zone.name}: drag to fill an area.`;
    return `Brush · ${zone.name}: click or drag across spots. Shift + drag = rectangle · Alt + click = pick a zone.`;
  }

  function zoneItem(zone, index, count) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'zone-item' + (state.zoneId === zone.id ? ' is-selected' : '');
    btn.dataset.zone = zone.id;
    const key = document.createElement('span');
    key.className = 'zone-key';
    key.textContent = index < 9 ? String(index + 1) : '';
    const sw = document.createElement('span');
    sw.className = 'swatch ' + zone.cssClasses;
    sw.style.setProperty('--zone-color', zone.color);
    const text = document.createElement('span');
    text.className = 'zone-text';
    text.innerHTML = '<span class="zone-name"></span><span class="zone-meta"></span>';
    text.children[0].textContent = zone.name;
    text.children[1].textContent = zone.rentable
      ? `${format.label(zone.status)} · ${format.peso(zone.rentalRate)}/mo`
      : format.label(zone.areaType);
    const badge = document.createElement('span');
    badge.className = 'badge' + (count ? '' : ' badge-warn');
    badge.textContent = count ? `${count} spot${count === 1 ? '' : 's'}` : 'Not placed';
    btn.append(key, sw, text, badge);
    return btn;
  }

  function renderPanel() {
    el.panelTitle.textContent = state.mode === 'edges' ? 'Walls & doors' : 'Zones';
    el.spotTools.hidden = state.mode !== 'spots';
    el.edgeTools.hidden = state.mode !== 'edges';
    if (state.mode !== 'spots') return;

    const zones = orderedZones();
    el.zoneFilter.hidden = zones.length <= 8;
    const filter = el.zoneFilter.hidden ? '' : el.zoneFilter.value.trim().toLowerCase();
    const counts = spotCounts();
    const heading = (t) => { const h = document.createElement('h3'); h.textContent = t; return h; };
    const note = (t) => Object.assign(document.createElement('p'), { className: 'empty-note', textContent: t });
    const list = [];
    const units = zones.filter(z => z.rentable);
    const areas = zones.filter(z => !z.rentable);
    const shown = (z) => !filter || z.name.toLowerCase().includes(filter);

    list.push(heading(`Units (${units.length})`));
    if (!units.length) list.push(note('No units yet. Add one with + Unit.'));
    units.forEach((z, i) => { if (shown(z)) list.push(zoneItem(z, i, counts.get(z.id) || 0)); });
    list.push(heading(`Common areas (${areas.length})`));
    if (!areas.length) list.push(note('Walkways, grass, shared rooms…'));
    areas.forEach((z, i) => { if (shown(z)) list.push(zoneItem(z, units.length + i, counts.get(z.id) || 0)); });
    if (filter && !zones.some(shown)) list.push(note('No zone matches the filter.'));
    el.zoneList.replaceChildren(...list);
  }

  // ------------------------------------------------------------------ choosing tools
  function setMode(mode) {
    if (state.mode === mode) return;
    cancelRect();
    state.mode = mode;
    render();
  }

  function setTool(tool) {
    cancelRect();
    state.mode = 'spots';
    state.tool = tool;
    render();
  }

  function setEdgeTool(tool) {
    state.mode = 'edges';
    state.edgeTool = tool;
    render();
  }

  /** Choose the zone to paint with. Coming from the Hand or the Eraser switches to the Brush. */
  function pickZone(id) {
    if (!gridRenderer.zoneById(state.layout, id)) return;
    state.zoneId = id;
    state.mode = 'spots';
    if (state.tool === 'hand' || state.tool === ERASER) state.tool = 'brush';
    render();
  }

  function pickZoneByNumber(n) {
    const zone = orderedZones()[n - 1];
    if (zone) pickZone(zone.id); else toast(`There is no zone ${n}.`);
  }

  // ------------------------------------------------------------------ editing
  function paint(r, c, erase) {
    const L = state.layout;
    const k = gridRenderer.cellKey(r, c);
    if (erase) {
      if (!L.cells.has(k)) return false;
      L.cells.delete(k);
      return true;
    }
    if (state.zoneId == null || L.cells.get(k) === state.zoneId) return false;
    L.cells.set(k, state.zoneId);
    return true;
  }

  /** Applies the chosen wall/door/window/eraser tool to one line. The rules live in gridRenderer.applyEdgeTool. */
  function applyEdge(handle) {
    const orientation = handle.dataset.orientation, r = Number(handle.dataset.row), c = Number(handle.dataset.col);
    const key = gridRenderer.edgeKey(orientation, r, c);
    if (key === state.lastEdgeKey) return;          // still on the same line during a drag
    state.lastEdgeKey = key;
    if (gridRenderer.applyEdgeTool(state.layout, state.edgeTool, orientation, r, c)) scheduleRender();
  }

  const cellFrom = (target) => {
    const cell = target && target.closest ? target.closest('.cell') : null;
    return cell && el.host.contains(cell) ? cell : null;
  };

  // ---- rectangle: drag from one spot to another, everything in between gets the zone (or is erased)
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
    const erase = state.rect.erase;
    state.rect = null;
    for (let r = b.top; r <= b.bottom; r++) for (let c = b.left; c <= b.right; c++) paint(r, c, erase);
  }

  function cancelRect() {
    if (!state.rect) return;
    state.rect = null;
    state.stroke = null;
    schedulePreview();
  }

  // ---- pan: Hand tool, space bar + drag, or the middle mouse button
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
    if (!state.layout) return;
    closePopover();
    if (e.button === 1 || (e.button === 0 && (state.space || activeTool() === 'hand'))) { startPan(e); return; }
    if (e.button > 0) return;

    if (state.mode === 'edges') {
      const h = e.target.closest('.edge-handle');
      if (!h) return;
      e.preventDefault();
      state.stroke = gridRenderer.snapshot(state.layout);
      state.edgePainting = true;
      state.lastEdgeKey = null;
      applyEdge(h);
      return;
    }

    const cell = cellFrom(e.target);
    if (!cell) return;
    const r = Number(cell.dataset.row), c = Number(cell.dataset.col);
    const under = gridRenderer.zoneAt(state.layout, r, c);
    if (e.altKey) {                                  // eyedropper
      if (under) pickZone(under.id); else toast('That spot is empty.');
      return;
    }
    const erase = state.tool === ERASER;
    if (!erase && state.zoneId == null) {
      if (under) { pickZone(under.id); toast(`Picked ${under.name}. Paint with it now.`); }
      else toast('Pick a zone first: press 1–9 or use the Zones panel.');
      return;
    }
    e.preventDefault();
    if (e.target.hasPointerCapture && e.target.hasPointerCapture(e.pointerId)) e.target.releasePointerCapture(e.pointerId);
    state.stroke = gridRenderer.snapshot(state.layout);
    if (state.tool === 'rect' || e.shiftKey) {
      state.rect = { r0: r, c0: c, r1: r, c1: c, erase };
      schedulePreview();
      return;
    }
    state.painting = true;
    if (paint(r, c, erase)) scheduleRender();
  });

  el.host.addEventListener('pointermove', (e) => {
    if (state.pan) {
      el.host.scrollLeft = state.pan.left - (e.clientX - state.pan.x);
      el.host.scrollTop = state.pan.top - (e.clientY - state.pan.y);
      return;
    }
    if (state.edgePainting) {
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const h = under && under.closest ? under.closest('.edge-handle') : null;
      if (h && el.host.contains(h)) applyEdge(h);
      return;
    }
    if (!state.painting && !state.rect) return;
    const cell = cellFrom(document.elementFromPoint(e.clientX, e.clientY));
    if (!cell) return;
    const r = Number(cell.dataset.row), c = Number(cell.dataset.col);
    if (state.rect) {
      if (state.rect.r1 !== r || state.rect.c1 !== c) { state.rect.r1 = r; state.rect.c1 = c; schedulePreview(); }
    } else if (paint(r, c, state.tool === ERASER)) {
      scheduleRender();
    }
  });

  /** End of a drag: one undo step for the whole stroke / rectangle. */
  window.addEventListener('pointerup', () => {
    stopPan();
    finishRect();
    state.painting = false;
    state.edgePainting = false;
    state.lastEdgeKey = null;
    if (!state.stroke) return;
    const changed = commitAction(state.stroke);
    state.stroke = null;
    if (changed) render(); else schedulePreview();
  });
  window.addEventListener('pointercancel', () => {
    stopPan();
    if (state.stroke) gridRenderer.restore(state.layout, state.stroke);   // throw the half-done stroke away
    state.stroke = null;
    state.rect = null;
    state.painting = false;
    state.edgePainting = false;
    state.lastEdgeKey = null;
    if (state.layout) render();
  });

  // Ctrl + wheel (or a trackpad pinch) zooms around the mouse; the steps of one frame are collected first
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

  // ------------------------------------------------------------------ popovers (size, zoom, menu)
  /** Opens pop next to anchor. place: 'above-start' | 'above-end' | 'below-end'. */
  function openPopover(pop, anchor, place) {
    if (state.openPop && state.openPop.pop === pop) { closePopover(); return; }
    closePopover();
    pop.hidden = false;
    const a = anchor.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let left = place.endsWith('end') ? a.right - w : a.left;
    let top = place.startsWith('above') ? a.top - h - 8 : a.bottom + 8;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - h - 8));
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    anchor.setAttribute('aria-expanded', 'true');
    state.openPop = { pop, anchor };
  }

  function closePopover() {
    if (!state.openPop) return;
    const { pop, anchor } = state.openPop;
    pop.hidden = true;
    anchor.setAttribute('aria-expanded', 'false');
    state.openPop = null;
    if (pop === el.sizePop) removeSizePreview();
  }

  document.addEventListener('pointerdown', (e) => {
    if (!state.openPop) return;
    const { pop, anchor } = state.openPop;
    if (!pop.contains(e.target) && !anchor.contains(e.target)) closePopover();
  }, true);

  // ---- grid size
  function openSizePop() {
    if (!state.layout) return;
    el.rows.value = state.layout.rows;
    el.cols.value = state.layout.cols;
    openPopover(el.sizePop, el.btnSize, 'above-start');
    if (!el.sizePop.hidden) {
      updateSizePreview();
      el.rows.focus();
      el.rows.select();
    }
  }

  /** What a resize to rows × cols would remove. */
  function resizeLoss(rows, cols) {
    const L = state.layout;
    const cellsOut = [...L.cells.keys()].filter(k => { const [r, c] = k.split(',').map(Number); return r >= rows || c >= cols; });
    const edgesOut = [...L.overrides.keys()].filter(k => {
      const [o, r, c] = k.split(':'); const R = Number(r), C = Number(c);
      return o === 'HORIZONTAL' ? (R > rows || C >= cols) : (R >= rows || C > cols);
    });
    return { cellsOut, edgesOut };
  }

  const validSize = (n) => Number.isInteger(n) && n >= 1 && n <= MAX;

  function removeSizePreview() {
    el.host.querySelectorAll('.size-preview').forEach(p => p.remove());
  }

  /** Dashed outline of the new size on the grid + a note on what it would remove. */
  function updateSizePreview() {
    removeSizePreview();
    const rows = Number(el.rows.value), cols = Number(el.cols.value);
    const note = el.sizeNote;
    note.classList.remove('is-warn');
    if (!validSize(rows) || !validSize(cols)) {
      note.textContent = `Use whole numbers from 1 to ${MAX}.`;
      note.classList.add('is-warn');
      return;
    }
    const L = state.layout;
    if (rows === L.rows && cols === L.cols) {
      note.textContent = 'Same size as now.';
    } else {
      const { cellsOut, edgesOut } = resizeLoss(rows, cols);
      if (cellsOut.length || edgesOut.length) {
        note.textContent = `Shrinking removes ${cellsOut.length} spot${cellsOut.length === 1 ? '' : 's'}`
          + ` and ${edgesOut.length} wall edit${edgesOut.length === 1 ? '' : 's'}.`;
        note.classList.add('is-warn');
      } else {
        note.textContent = `New size: ${rows} × ${cols}.`;
      }
    }
    const stage = el.host.querySelector('.grid-stage');
    if (!stage) return;
    const cell = currentCell();
    const outline = document.createElement('div');
    outline.className = 'size-preview';
    outline.style.width = `${cols * cell}px`;
    outline.style.height = `${rows * cell}px`;
    stage.appendChild(outline);
  }

  function applyResize() {
    const rows = Number(el.rows.value), cols = Number(el.cols.value);
    const L = state.layout;
    if (!validSize(rows) || !validSize(cols)) {
      toast(`Rows and columns must be whole numbers from 1 to ${MAX}.`, true);
      return;
    }
    if (rows === L.rows && cols === L.cols) { closePopover(); return; }
    const { cellsOut, edgesOut } = resizeLoss(rows, cols);
    if ((cellsOut.length || edgesOut.length) &&
        !confirm(`Resizing to ${rows} × ${cols} removes ${cellsOut.length} spot(s) and ${edgesOut.length} wall/door edit(s).`
          + '\n\nYou can undo this with Ctrl+Z. Continue?')) return;
    const before = gridRenderer.snapshot(L);
    cellsOut.forEach(k => L.cells.delete(k));
    edgesOut.forEach(k => L.overrides.delete(k));
    L.rows = rows;
    L.cols = cols;
    commitAction(before);
    closePopover();
    render();
  }

  el.btnSize.addEventListener('click', openSizePop);
  $('btnSizeCancel').addEventListener('click', closePopover);
  $('btnResize').addEventListener('click', applyResize);
  el.sizePop.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-step]');
    if (!btn) return;
    const [which, step] = btn.dataset.step.split(':');
    const input = which === 'rows' ? el.rows : el.cols;
    const n = Number(input.value) || 0;
    input.value = Math.max(1, Math.min(MAX, Math.round(n) + Number(step)));
    updateSizePreview();
  });
  [el.rows, el.cols].forEach(input => {
    input.addEventListener('input', updateSizePreview);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyResize(); } });
  });

  // ---- zoom
  $('btnZoomOut').addEventListener('click', () => zoomBy(1 / 1.25));
  $('btnZoomIn').addEventListener('click', () => zoomBy(1.25));
  el.btnZoomMenu.addEventListener('click', () => openPopover(el.zoomPop, el.btnZoomMenu, 'above-end'));
  el.zoomPop.addEventListener('click', (e) => {
    const item = e.target.closest('[data-zoom]');
    if (!item) return;
    closePopover();
    setZoom(item.dataset.zoom === 'fit' ? 'fit' : CELL_BASE * Number(item.dataset.zoom));
  });

  // ---- ⋯ menu
  el.btnMenu.addEventListener('click', () => openPopover(el.menuPop, el.btnMenu, 'below-end'));
  el.menuPop.addEventListener('click', (e) => {
    const item = e.target.closest('[data-action]');
    if (!item) return;
    closePopover();
    if (item.dataset.action === 'shortcuts') openShortcuts();
    else if (item.dataset.action === 'panel') panel.toggle();
    else if (item.dataset.action === 'reset-edges') resetEdges();
  });
  $('btnLogout').addEventListener('click', () => auth.logout());

  // ------------------------------------------------------------------ toolbar and panel
  document.querySelectorAll('[data-mode]').forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
  el.spotToolBtns.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tool]');
    if (btn) setTool(btn.dataset.tool);
  });
  el.edgeToolBtns.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-edge]');
    if (btn) setEdgeTool(btn.dataset.edge);
  });
  el.zoneChip.addEventListener('click', () => {
    if (panel.isMinimized()) panel.setMinimized(false);
    if (!el.zoneFilter.hidden) el.zoneFilter.focus();
  });
  el.zoneList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-zone]');
    if (btn) pickZone(Number(btn.dataset.zone));
  });
  el.zoneFilter.addEventListener('input', () => state.layout && renderPanel());

  function resetEdges() {
    if (!state.layout) return;
    const count = state.layout.overrides.size;
    if (!count) { toast('Nothing to reset: every wall is already automatic.'); return; }
    if (!confirm(`Reset all ${count} wall, door and window edit${count === 1 ? '' : 's'} back to the automatic walls?\n\n`
        + 'Doors, windows and walls you drew, and walls you erased, will go back to how SpaceGrid draws them by itself. '
        + 'You can undo this with Ctrl+Z; it only becomes permanent when you press Save.')) return;
    const before = gridRenderer.snapshot(state.layout);
    state.layout.overrides.clear();
    commitAction(before);
    render();
  }
  $('btnResetEdges').addEventListener('click', resetEdges);

  // ---- add unit / common area (saved on the server at once)
  function showAddForm(box) {
    [el.addUnitBox, el.addAreaBox].forEach(b => { b.hidden = b !== box || !b.hidden; });
    if (!box.hidden) box.querySelector('input').focus();
  }
  $('btnAddUnit').addEventListener('click', () => showAddForm(el.addUnitBox));
  $('btnAddArea').addEventListener('click', () => showAddForm(el.addAreaBox));
  document.querySelectorAll('.add-form [data-cancel]').forEach(btn => btn.addEventListener('click', () => {
    const box = btn.closest('.add-form');
    box.querySelector('form').reset();
    box.hidden = true;
  }));

  async function addZone(form, url, fields) {
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const zone = await api.form('POST', url, fields);
      state.layout.zones.push({ ...zone, positions: [] });
      form.reset();
      form.closest('.add-form').hidden = true;
      state.tool = 'brush';
      pickZone(zone.id);                            // ready to place
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
    const name = f.elements.name.value.trim();
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
    const name = f.elements.name.value.trim();
    if (!name) return toast('Give the common area a name.', true);
    addZone(f, `/api/properties/${propertyId}/common-areas`, { name, areaType: f.areaType.value });
  });

  // ------------------------------------------------------------------ save (two requests)
  async function save() {
    if (!state.layout || state.saving) return;
    if (!state.dirty) { toast('Nothing to save.'); return; }
    const L = state.layout;
    state.saving = true;
    updateSaveState();
    try {
      await api.json('PUT', `/api/properties/${propertyId}/grid?rows=${L.rows}&cols=${L.cols}`, gridRenderer.toSpotsByZone(L));
    } catch (err) {
      state.saving = false;
      updateSaveState();
      toast(err.message, true);
      return;
    }
    try {
      const saved = await api.json('PUT', `/api/properties/${propertyId}/edges`, gridRenderer.toEdgesByType(L));
      state.saving = false;
      load(saved, true);
      state.saved = true;
      updateSaveState();
      toast('Layout saved.');
    } catch (err) {
      state.saving = false;
      updateSaveState();
      toast(`Spots were saved, but walls and doors were not: ${err.message}`, true);
    }
  }
  el.btnSave.addEventListener('click', save);
  el.btnUndo.addEventListener('click', undo);
  el.btnRedo.addEventListener('click', redo);

  // ------------------------------------------------------------------ keyboard shortcuts
  // One list for both the key handler and the "?" dialog. Rows without `test` are only shown in the dialog.
  const noMods = (e) => !e.ctrlKey && !e.metaKey && !e.altKey;
  const plain = (...keys) => (e) => noMods(e) && keys.includes(e.key.toLowerCase());
  const ctrl = (key, shift) => (e) => (e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === key && e.shiftKey === shift;
  const shiftDigit = (d) => (e) => noMods(e) && e.shiftKey && e.code === `Digit${d}`;

  const SHORTCUTS = [
    { group: 'Tools', keys: ['S'], label: 'Spots mode', test: plain('s'), run: () => setMode('spots') },
    { group: 'Tools', keys: ['W'], label: 'Walls & doors mode', test: plain('w'), run: () => setMode('edges') },
    { group: 'Tools', keys: ['H'], label: 'Hand (move around)', test: plain('h'),
      run: () => (state.mode === 'edges' ? setEdgeTool('hand') : setTool('hand')) },
    { group: 'Tools', keys: ['B'], label: 'Brush', test: plain('b'), run: () => setTool('brush') },
    { group: 'Tools', keys: ['R'], label: 'Rectangle', test: plain('r'), run: () => setTool('rect') },
    { group: 'Tools', keys: ['E'], label: 'Eraser', test: plain('e'),
      run: () => (state.mode === 'edges' ? setEdgeTool(ERASER) : setTool(ERASER)) },
    { group: 'Tools', keys: ['1', '–', '9'], label: 'Spots: pick zone 1–9 · Walls: 1 Wall, 2 Door, 3 Window',
      test: (e) => noMods(e) && !e.shiftKey && /^[1-9]$/.test(e.key),
      run: (e) => {
        const n = Number(e.key);
        if (state.mode === 'edges') { if (EDGE_BY_DIGIT[n]) setEdgeTool(EDGE_BY_DIGIT[n]); }
        else pickZoneByNumber(n);
      } },
    { group: 'Tools', keys: ['Shift', 'drag'], label: 'Rectangle with the Brush or the Eraser' },
    { group: 'Tools', keys: ['Alt', 'click'], label: 'Pick the zone of a placed spot' },
    { group: 'Tools', keys: ['Esc'], label: 'Close a menu · cancel a rectangle · back to the Hand' },

    { group: 'View', keys: ['Space', 'drag'], label: 'Move around (also: middle mouse button)' },
    { group: 'View', keys: ['+'], label: 'Zoom in', test: plain('+', '='), run: () => zoomBy(1.25) },
    { group: 'View', keys: ['−'], label: 'Zoom out', test: plain('-', '_'), run: () => zoomBy(1 / 1.25) },
    { group: 'View', keys: ['Ctrl', 'wheel'], label: 'Zoom around the mouse' },
    { group: 'View', keys: ['Shift', '1'], label: 'Zoom to fit (also: 0)', test: shiftDigit(1), run: () => setZoom('fit') },
    { group: 'View', keys: ['Shift', '0'], label: 'Zoom to 100%', test: shiftDigit(0), run: () => setZoom(CELL_BASE) },
    { group: 'View', keys: ['0'], label: 'Zoom to fit', hidden: true, test: (e) => noMods(e) && !e.shiftKey && e.key === '0', run: () => setZoom('fit') },
    { group: 'View', keys: ['\\'], label: 'Show / hide the panel', test: plain('\\'), run: () => panel.toggle() },
    { group: 'View', keys: ['G'], label: 'Grid size', test: plain('g'), run: openSizePop },

    { group: 'Edit', keys: ['Ctrl', 'Z'], label: 'Undo', test: ctrl('z', false), run: undo },
    { group: 'Edit', keys: ['Ctrl', 'Shift', 'Z'], label: 'Redo (also: Ctrl + Y)', test: ctrl('z', true), run: redo },
    { group: 'Edit', keys: ['Ctrl', 'Y'], label: 'Redo', hidden: true, test: ctrl('y', false), run: redo },
    { group: 'Edit', keys: ['Ctrl', 'S'], label: 'Save', test: ctrl('s', false), run: save, inFields: true },
    { group: 'Edit', keys: ['?'], label: 'This list of shortcuts', test: (e) => !e.ctrlKey && !e.metaKey && e.key === '?', run: () => openShortcuts() }
  ];

  function openShortcuts() {
    closePopover();
    const groups = [...new Set(SHORTCUTS.map(s => s.group))];
    const body = $('shortcutsBody');
    body.replaceChildren(...groups.map(group => {
      const section = document.createElement('section');
      section.className = 'shortcut-group';
      const h = document.createElement('h3');
      h.textContent = group;
      section.appendChild(h);
      for (const s of SHORTCUTS.filter(x => x.group === group && !x.hidden)) {
        const row = document.createElement('div');
        row.className = 'shortcut-row';
        const label = document.createElement('span');
        label.textContent = s.label;
        const keys = document.createElement('span');
        keys.className = 'shortcut-keys';
        s.keys.forEach((k, i) => {
          if (i) keys.append(k === '–' || s.keys[i - 1] === '–' ? '' : ' + ');
          if (k === '–') { keys.append(' – '); return; }
          const kbd = document.createElement('kbd');
          kbd.textContent = k;
          keys.appendChild(kbd);
        });
        row.append(label, keys);
        section.appendChild(row);
      }
      return section;
    }));
    const note = document.createElement('p');
    note.className = 'pl-dialog-note';
    note.textContent = 'On a Mac, use Cmd instead of Ctrl. Adding a unit or common area is saved at once and cannot be undone.';
    body.appendChild(note);
    el.dialog.showModal();
  }
  $('btnShortcutsClose').addEventListener('click', () => el.dialog.close());
  el.dialog.addEventListener('click', (e) => { if (e.target === el.dialog) el.dialog.close(); });   // click on the dark backdrop

  const typingInField = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;

  function onEscape(e) {
    if (state.openPop) { closePopover(); return; }
    if (typingInField(e)) { e.target.blur(); return; }
    if (state.rect) { cancelRect(); return; }
    if (state.mode === 'edges' && state.edgeTool !== 'hand') setEdgeTool('hand');
    else if (state.mode === 'spots' && state.tool !== 'hand') setTool('hand');
  }

  document.addEventListener('keydown', (e) => {
    if (el.dialog.open) return;                     // the dialog closes itself on Esc
    if (e.key === 'Escape') { onEscape(e); return; }
    if (!state.layout || e.repeat && !/^[+=\-_]$/.test(e.key)) return;
    const typing = typingInField(e);
    if (e.key === ' ' && !typing && noMods(e)) {     // hold space to pan
      e.preventDefault();
      if (!state.space) { state.space = true; el.host.classList.add('is-pan-ready'); }
      return;
    }
    for (const s of SHORTCUTS) {
      if (!s.test || (typing && !s.inFields) || !s.test(e)) continue;
      e.preventDefault();
      s.run(e);
      return;
    }
  });
  document.addEventListener('keyup', (e) => {
    if (e.key !== ' ') return;
    if (!typingInField(e)) e.preventDefault();       // a focused button would otherwise be "clicked" by the space bar
    state.space = false;
    el.host.classList.remove('is-pan-ready');
  });
  window.addEventListener('blur', () => { state.space = false; el.host.classList.remove('is-pan-ready'); });
  window.addEventListener('resize', () => { closePopover(); scheduleRender(); });
  window.addEventListener('beforeunload', (e) => { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });

  // ------------------------------------------------------------------ start
  /** keepHistory = true after a save: undo still works, and "unsaved" is now measured from the saved layout. */
  function load(property, keepHistory) {
    state.layout = gridRenderer.fromProperty(property);
    history.saved = gridRenderer.snapshot(state.layout);
    if (!keepHistory) {
      history.undo = [];
      history.redo = [];
    }
    if (state.zoneId != null && !gridRenderer.zoneById(state.layout, state.zoneId)) state.zoneId = null;
    el.name.textContent = property.name;
    document.title = `${property.name} · Grid · SpaceGrid`;
    render();
  }

  if (!Number.isInteger(propertyId) || propertyId < 1) {
    el.name.textContent = 'No property selected';
    el.hint.textContent = 'Open this page as /landlord/property-grid.html?id=<property id>.';
    el.hint.classList.add('is-error');
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
