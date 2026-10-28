/*
 * property-grid.js — the grid plotter (landlord/property-grid.html?id=1)
 *
 * 1. Load the property:            api.get(`/api/properties/${id}`)
 * 2. Edit in memory:               spots (paint/erase with a zone) and edge overrides (walls/doors/windows)
 * 3. "Save" sends two requests, in this order:
 *      api.json('PUT', `/api/properties/${id}/grid?rows=&cols=`, { "zoneId": [{row, col}] })
 *      api.json('PUT', `/api/properties/${id}/edges`, { "DOOR": [{row, col, orientation}] })
 * 4. Add a unit / common area (saved at once, from the add dialog):
 *      api.form('POST', `/api/properties/${id}/units`, {...})
 *      api.form('POST', `/api/properties/${id}/common-areas`, { name, areaType, color })
 * 5. Change a common area's color (saved at once):
 *      api.form('PUT', `/api/properties/${id}/common-areas/${areaId}/color`, { color })
 *
 * Screen: the grid fills the window; toolbar (bottom), Zones panel (floating, floating-panel.js), resize and zoom
 * controls float on top. The toolbar is the same in both modes: Spots | Walls · Hand · Brush/Rectangle · Eraser ·
 * Preview. In Spots mode the tools paint the chosen zone; in Walls mode they draw the chosen Wall, Door or Window.
 * Every keyboard shortcut is in SHORTCUTS below (the "?" dialog is built from the same list).
 * Undo / redo keep snapshots of the size, spots and edge overrides (gridRenderer.snapshot); adding a zone or
 * changing a color is saved on the server at once and is not undone.
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
  const TOOL_NAMES = { hand: 'Hand', brush: 'Brush', rect: 'Rectangle', [ERASER]: 'Eraser' };
  const EDGE_TYPES = [
    { type: 'WALL', name: 'Wall', meta: 'A solid wall' },
    { type: 'DOOR', name: 'Door', meta: 'A gap people walk through' },
    { type: 'WINDOW', name: 'Window', meta: 'A wall you can see through' }
  ];
  // Same as the defaultColor values in CommonAreaType.java and UnitStatus.java.
  const TYPE_COLORS = {
    WALKWAY: '#d6d3d1', GRASS: '#86efac', BATHROOM: '#bae6fd', KITCHEN: '#fde68a',
    LAUNDRY: '#ddd6fe', LOBBY: '#fbcfe8', PARKING: '#9ca3af', STAIRS: '#a8a29e'
  };
  const INDOOR_TYPES = ['BATHROOM', 'KITCHEN', 'LAUNDRY', 'LOBBY', 'STAIRS'];
  const STATUS_COLORS = { '#16a34a': 'available units', '#dc2626': 'occupied units', '#f59e0b': 'units under maintenance', '#9ca3af': 'archived units' };
  const UNIT_PREVIEW_COLOR = '#16a34a';
  // Colors offered for common areas (the unit status colors are left out on purpose).
  const PALETTE = ['#d6d3d1', '#86efac', '#bae6fd', '#fde68a', '#ddd6fe', '#fbcfe8', '#a8a29e', '#fecaca',
    '#fed7aa', '#d9f99d', '#99f6e4', '#a5f3fc', '#c7d2fe', '#f5d0fe', '#e7e5e4', '#cbd5e1'];

  const $ = (id) => document.getElementById(id);
  const el = {
    name: $('propertyName'), host: $('gridHost'), world: $('gridWorld'), hint: $('hint'), flash: $('flash'),
    summary: $('summary'), sizeLabel: $('sizeLabel'),
    btnSave: $('btnSave'), saveState: $('saveState'), btnUndo: $('btnUndo'), btnRedo: $('btnRedo'),
    panelTitle: $('panelTitle'), panelTop: $('panelTop'), spotTools: $('spotTools'), edgeTools: $('edgeTools'),
    zoneList: $('zoneList'), edgeList: $('edgeList'), zoneFilter: $('zoneFilter'),
    btnDraw: $('btnDraw'), drawIcon: $('drawIcon'),
    preview: $('preview'), previewSwatch: $('previewSwatch'), previewName: $('previewName'), previewMeta: $('previewMeta'),
    sizePop: $('sizePop'), rows: $('inpRows'), cols: $('inpCols'), sizeNote: $('sizeNote'), btnSize: $('btnSize'),
    zoomPop: $('zoomPop'), zoomLabel: $('zoomLabel'), btnZoomMenu: $('btnZoomMenu'),
    menuPop: $('menuPop'), btnMenu: $('btnMenu'),
    colorPop: $('colorPop'), colorTitle: $('colorTitle'), colorPalette: $('colorPalette'), colorCustom: $('colorCustom'),
    colorNote: $('colorNote'),
    addDialog: $('addDialog'), addTitle: $('addTitle'), addUnitForm: $('addUnitForm'), addAreaForm: $('addAreaForm'),
    unitPreview: $('unitPreview'), areaPreview: $('areaPreview'), areaPalette: $('areaPalette'),
    areaCustom: $('areaCustom'), areaColorNote: $('areaColorNote'),
    shortcutsDialog: $('shortcutsDialog'), toast: $('toast')
  };

  const propertyId = Number(new URLSearchParams(location.search).get('id'));
  const state = {
    layout: null,
    mode: 'spots',             // 'spots' | 'edges'
    tool: 'hand',              // hand | brush | rect | erase (the same tools in both modes)
    lastDraw: 'brush',         // what the Brush/Rectangle button goes back to
    zoneId: null,              // Spots: the zone the Brush / Rectangle paint with
    edgeType: 'WALL',          // Walls: what the Brush / Rectangle draw (WALL, DOOR, WINDOW)
    zoom: loadZoom(),          // a cell size in px, or 'fit'
    painting: false,           // dragging the brush or eraser over spots
    edgePainting: false,       // dragging along lines in Walls mode
    lastEdgeKey: null,         // the line the drag touched last (so one line is not applied twice in a row)
    rect: null,                // { r0, c0, r1, c1, erase } while a rectangle is being dragged
    stroke: null,              // snapshot taken when a drag starts (becomes one undo step)
    resizing: null,            // { dir, rows, cols } while a resize handle is dragged
    hover: null,               // what the Hand is over: { r, c } or { line: [orientation, r, c] }
    space: false,              // space bar held down: drag to pan
    pan: null,                 // { x, y, left, top } while panning
    openPop: null,             // { pop, anchor } of the open popover
    addColor: null,            // color chosen in the add-common-area dialog
    addColorPicked: false,     // true once the user picked a color (then changing the type keeps it)
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

  /** A short big label above the toolbar, e.g. "Rectangle" after switching tools. */
  let flashTimer;
  function flash(text) {
    el.flash.textContent = text;
    el.flash.classList.add('is-visible');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => el.flash.classList.remove('is-visible'), 900);
  }

  const visibleZones = () => state.layout.zones.filter(z => !(z.rentable && z.status === 'ARCHIVED'));
  /** Units first, then common areas: the order of the list and of the 1–9 keys. */
  const orderedZones = () => [...visibleZones().filter(z => z.rentable), ...visibleZones().filter(z => !z.rentable)];
  const spotCounts = () => {
    const counts = new Map();
    for (const id of state.layout.cells.values()) counts.set(id, (counts.get(id) || 0) + 1);
    return counts;
  };
  const currentZone = () => (state.zoneId == null ? null : gridRenderer.zoneById(state.layout, state.zoneId));
  const edgeInfo = (type) => EDGE_TYPES.find(t => t.type === type);
  const isDrawTool = () => state.tool === 'brush' || state.tool === 'rect';
  const busy = () => state.painting || state.edgePainting || Boolean(state.rect) || Boolean(state.pan) || Boolean(state.resizing);
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const stage = () => el.world.querySelector('.grid-stage');

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

  // ------------------------------------------------------------------ zoom and view
  const clampCell = (n) => Math.max(CELL_MIN, Math.min(CELL_MAX, Math.round(n)));

  /** Spot size that makes the whole grid fit the window, leaving room for the floating parts around it. */
  function fitCell() {
    const L = state.layout;
    const narrow = window.innerWidth < 760;
    const width = el.host.clientWidth - (narrow ? 48 : 200);
    const height = el.host.clientHeight - (narrow ? 210 : 214);
    return Math.max(CELL_MIN, Math.min(CELL_FIT_MAX, Math.floor(Math.min(width / L.cols, height / L.rows))));
  }

  const currentCell = () => (typeof state.zoom === 'number' ? state.zoom : fitCell());

  /** Scrolls so the grid is in the middle of the window. */
  function centerView() {
    const host = el.host;
    host.scrollLeft = (host.scrollWidth - host.clientWidth) / 2;
    host.scrollTop = (host.scrollHeight - host.clientHeight) / 2;
  }

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
    if (state.zoom === 'fit') { centerView(); return; }
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

  /** The cell under a screen point, or null outside the grid (clamp = keep it inside, for dragging). */
  function cellAtPoint(x, y, clamp) {
    const s = stage();
    if (!s) return null;
    const box = s.getBoundingClientRect();
    const cell = currentCell();
    let r = Math.floor((y - box.top) / cell), c = Math.floor((x - box.left) / cell);
    const L = state.layout;
    if (clamp) {
      r = Math.max(0, Math.min(L.rows - 1, r));
      c = Math.max(0, Math.min(L.cols - 1, c));
    } else if (r < 0 || c < 0 || r >= L.rows || c >= L.cols) {
      return null;
    }
    return { r, c };
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
    gridRenderer.render(el.world, L, {
      mode: state.mode,
      brushZoneId: state.mode === 'spots' && isDrawTool() ? state.zoneId : null,
      cell: currentCell()
    });
    addResizeHandles();
    el.host.classList.toggle('mode-spots', state.mode === 'spots');
    el.host.classList.toggle('mode-edges', state.mode === 'edges');
    el.host.classList.toggle('tool-hand', state.tool === 'hand');
    el.host.classList.toggle('tool-rect', state.tool === 'rect');
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
    document.querySelectorAll('#toolbar [data-tool]').forEach(b => {
      const active = b.dataset.tool === 'draw' ? isDrawTool() : b.dataset.tool === state.tool;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    // the Brush/Rectangle button shows the shape it will use
    const shape = state.tool === 'rect' || (!isDrawTool() && state.lastDraw === 'rect') ? 'rect' : 'brush';
    el.drawIcon.setAttribute('href', shape === 'rect' ? '#i-rect' : '#i-brush');
    el.btnDraw.dataset.tip = shape === 'rect' ? 'Rectangle · click again for Brush' : 'Brush · click again for Rectangle';
    el.btnDraw.dataset.key = shape === 'rect' ? 'R' : 'B';
    el.btnDraw.setAttribute('aria-label', TOOL_NAMES[shape]);
    renderPreview();
  }

  function setSwatch(sw, kind) {
    sw.className = 'swatch';
    sw.style.removeProperty('--zone-color');
    if (!kind) { sw.classList.add('swatch-none'); return; }
    if (kind.zone) {
      sw.className = 'swatch ' + kind.zone.cssClasses;
      sw.style.setProperty('--zone-color', kind.zone.color);
    } else {
      sw.classList.add(`swatch-${kind.cls}`);
    }
  }

  function zoneMeta(zone, count) {
    const cells = plural(count, 'spot');
    return zone.rentable
      ? `${format.label(zone.status)} · ${format.peso(zone.rentalRate)}/mo · ${cells}`
      : `${format.label(zone.areaType)} · ${cells}`;
  }

  /** The Preview item: what the Hand is over, else what is selected. */
  function renderPreview() {
    let swatch = null, name = 'Nothing selected', meta = '', empty = false, hovering = false;
    if (state.tool === 'hand' && state.hover) {
      hovering = true;
      if (state.hover.line) {
        const [o, r, c] = state.hover.line;
        const edge = gridRenderer.edgeAt(state.layout, o, r, c);
        const type = edge ? edge.type : null;
        swatch = type ? { cls: type.toLowerCase() } : null;
        name = !type ? 'No wall' : type === 'OPEN' ? 'Erased wall' : `${edgeInfo(type).name}${edge.auto ? ' (automatic)' : ''}`;
        meta = `${o === 'HORIZONTAL' ? 'Line above' : 'Line left of'} row ${r + 1}, column ${c + 1}`;
      } else {
        const { r, c } = state.hover;
        const zone = gridRenderer.zoneAt(state.layout, r, c);
        if (zone) {
          swatch = { zone };
          name = zone.name;
          meta = zoneMeta(zone, spotCounts().get(zone.id) || 0);
        } else {
          name = 'Empty spot';
          meta = `Row ${r + 1}, column ${c + 1}`;
        }
      }
    } else if (state.tool === ERASER) {
      swatch = { cls: 'erase' };
      name = 'Eraser';
      meta = state.mode === 'edges' ? 'Removes walls, doors and windows' : 'Clears spots';
    } else if (state.mode === 'edges') {
      const t = edgeInfo(state.edgeType);
      swatch = { cls: t.type.toLowerCase() };
      name = t.name;
      meta = state.tool === 'hand' ? 'Selected · pick Brush to draw' : t.meta;
    } else {
      const zone = currentZone();
      if (zone) {
        swatch = { zone };
        name = zone.name;
        meta = state.tool === 'hand' ? 'Selected · pick Brush to paint' : zoneMeta(zone, spotCounts().get(zone.id) || 0);
      } else {
        empty = true;
        meta = 'Pick a zone in the panel or press 1–9';
      }
    }
    setSwatch(el.previewSwatch, swatch);
    el.previewName.textContent = name;
    el.previewMeta.textContent = meta;
    el.preview.classList.toggle('is-empty', empty);
    el.preview.classList.toggle('is-hover', hovering);
  }

  function renderStatus() {
    const L = state.layout;
    const units = visibleZones().filter(z => z.rentable);
    const counts = spotCounts();
    el.sizeLabel.textContent = `${L.rows} × ${L.cols}`;
    el.summary.textContent = `${L.cells.size}/${L.rows * L.cols} spots · `
      + `${units.filter(u => counts.has(u.id)).length}/${units.length} units placed · `
      + `${plural(L.overrides.size, 'wall edit')}`;
  }

  function hintText() {
    if (state.tool === 'hand') {
      return state.mode === 'edges'
        ? 'Hand: drag to move around, hover to inspect. Pick Wall, Door or Window in the panel, then B to draw · ? for all keys'
        : 'Hand: drag to move around, hover to inspect. Pick a zone (1–9), then B to paint · ? for all keys';
    }
    if (state.mode === 'edges') {
      if (state.tool === ERASER) return 'Eraser: click or drag along lines. Shift + drag clears every line in an area.';
      const t = edgeInfo(state.edgeType).name;
      return state.tool === 'rect'
        ? `${t} rectangle: drag over spots to draw a ${t.toLowerCase()} all around them.`
        : `${t}: click or drag along the lines between spots. Shift + drag = rectangle.`;
    }
    if (state.tool === ERASER) return 'Eraser: click or drag to clear spots. Shift + drag = rectangle.';
    const zone = currentZone();
    if (!zone) return `${TOOL_NAMES[state.tool]}: pick a zone first (1–9 or the panel), or Alt + click a placed spot.`;
    if (state.tool === 'rect') return `Rectangle · ${zone.name}: drag to fill an area. Click the button again for the Brush.`;
    return `Brush · ${zone.name}: click or drag across spots. Shift + drag = rectangle · Alt + click = pick a zone.`;
  }

  // ---- panel lists
  function listItem({ key, keyLabel, swatch, name, meta, badge, warn, selected, colorZone }) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'zone-item' + (selected ? ' is-selected' : '');
    Object.assign(btn.dataset, key);
    const k = document.createElement('span');
    k.className = 'zone-key';
    k.textContent = keyLabel || '';
    const sw = document.createElement('span');
    setSwatch(sw, swatch);
    let swatchEl = sw;
    if (colorZone) {                                  // a common area: the swatch opens the color picker
      swatchEl = document.createElement('span');
      swatchEl.className = 'swatch-btn';
      swatchEl.setAttribute('role', 'button');
      swatchEl.tabIndex = 0;
      swatchEl.dataset.color = colorZone.id;
      swatchEl.title = `Change the color of ${colorZone.name}`;
      swatchEl.appendChild(sw);
    }
    const text = document.createElement('span');
    text.className = 'zone-text';
    text.innerHTML = '<span class="zone-name"></span><span class="zone-meta"></span>';
    text.children[0].textContent = name;
    text.children[1].textContent = meta;
    btn.append(k, swatchEl, text);
    if (badge) {
      const b = document.createElement('span');
      b.className = 'badge' + (warn ? ' badge-warn' : '');
      b.textContent = badge;
      btn.appendChild(b);
    }
    return btn;
  }

  function renderPanel() {
    const spots = state.mode === 'spots';
    el.panelTitle.textContent = spots ? 'Zones' : 'Walls & doors';
    el.panelTop.hidden = !spots;
    el.spotTools.hidden = !spots;
    el.edgeTools.hidden = spots;
    const eraser = listItem({
      key: { eraser: '1' }, keyLabel: 'E', swatch: { cls: 'erase' }, name: 'Eraser',
      meta: spots ? 'Clear spots' : 'Remove walls, doors and windows', selected: state.tool === ERASER
    });

    if (!spots) {
      el.edgeList.replaceChildren(eraser, ...EDGE_TYPES.map((t, i) => listItem({
        key: { edge: t.type }, keyLabel: String(i + 1), swatch: { cls: t.type.toLowerCase() }, name: t.name, meta: t.meta,
        selected: state.tool !== ERASER && state.edgeType === t.type
      })));
      return;
    }

    const zones = orderedZones();
    el.zoneFilter.hidden = zones.length <= 8;
    const filter = el.zoneFilter.hidden ? '' : el.zoneFilter.value.trim().toLowerCase();
    const counts = spotCounts();
    const heading = (t) => { const h = document.createElement('h3'); h.textContent = t; return h; };
    const note = (t) => Object.assign(document.createElement('p'), { className: 'empty-note', textContent: t });
    const units = zones.filter(z => z.rentable);
    const areas = zones.filter(z => !z.rentable);
    const shown = (z) => !filter || z.name.toLowerCase().includes(filter);
    const zoneRow = (z, index) => {
      const n = counts.get(z.id) || 0;
      return listItem({
        key: { zone: z.id }, keyLabel: index < 9 ? String(index + 1) : '', swatch: { zone: z }, name: z.name,
        meta: z.rentable ? `${format.label(z.status)} · ${format.peso(z.rentalRate)}/mo` : format.label(z.areaType),
        badge: n ? plural(n, 'spot') : 'Not placed', warn: !n,
        selected: state.tool !== ERASER && state.zoneId === z.id,
        colorZone: z.rentable ? null : z
      });
    };

    const list = [eraser, heading(`Units (${units.length})`)];
    if (!units.length) list.push(note('No units yet. Add one with + Unit.'));
    units.forEach((z, i) => { if (shown(z)) list.push(zoneRow(z, i)); });
    list.push(heading(`Common areas (${areas.length})`));
    if (!areas.length) list.push(note('Walkways, grass, shared rooms…'));
    areas.forEach((z, i) => { if (shown(z)) list.push(zoneRow(z, units.length + i)); });
    if (filter && !zones.some(shown)) list.push(note('No zone matches the filter.'));
    el.zoneList.replaceChildren(...list);
  }

  // ------------------------------------------------------------------ choosing tools
  function setMode(mode) {
    if (state.mode === mode) return;
    cancelRect();
    state.mode = mode;
    state.hover = null;
    render();
  }

  function setTool(tool) {
    cancelRect();
    if (tool === 'brush' || tool === 'rect') state.lastDraw = tool;
    state.tool = tool;
    render();
  }

  /** The Brush/Rectangle button and the B key: switch between the two, or pick the last one used. */
  function cycleDraw() {
    const next = state.tool === 'brush' ? 'rect' : state.tool === 'rect' ? 'brush' : state.lastDraw;
    const switching = isDrawTool();
    setTool(next);
    flash(TOOL_NAMES[next]);
    if (switching) {
      el.btnDraw.classList.remove('is-switching');
      void el.btnDraw.offsetWidth;                   // restart the little animation
      el.btnDraw.classList.add('is-switching');
    }
  }

  /** Picking something to draw with switches the Hand or the Eraser to the Brush (Rectangle stays Rectangle). */
  function drawWithSelection() {
    if (!isDrawTool()) {
      state.tool = state.lastDraw;
      flash(TOOL_NAMES[state.tool]);
    }
  }

  function pickZone(id) {
    if (!gridRenderer.zoneById(state.layout, id)) return;
    cancelRect();
    state.zoneId = id;
    state.mode = 'spots';
    drawWithSelection();
    render();
  }

  function pickZoneByNumber(n) {
    const zone = orderedZones()[n - 1];
    if (zone) pickZone(zone.id); else toast(`There is no zone ${n}.`);
  }

  function pickEdgeType(type) {
    cancelRect();
    state.edgeType = type;
    state.mode = 'edges';
    drawWithSelection();
    render();
  }

  /** Preview click: open the panel and show the selected item there. */
  function locateSelection() {
    if (panel.isMinimized()) panel.setMinimized(false);
    let selector = null;
    if (state.tool === ERASER) selector = '[data-eraser]';
    else if (state.mode === 'edges') selector = `[data-edge="${state.edgeType}"]`;
    else if (state.zoneId != null) selector = `[data-zone="${state.zoneId}"]`;
    if (!selector) return;
    const list = state.mode === 'edges' ? el.edgeList : el.zoneList;   // both lists have an Eraser
    let item = list.querySelector(selector);
    if (!item && el.zoneFilter.value) {               // hidden by the filter: clear it
      el.zoneFilter.value = '';
      renderPanel();
      item = list.querySelector(selector);
    }
    if (!item) return;
    if (item.scrollIntoView) item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    item.classList.remove('is-flash');
    void item.offsetWidth;
    item.classList.add('is-flash');
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

  const edgeToolNow = () => (state.tool === ERASER ? ERASER : state.edgeType);

  /** Applies the Wall/Door/Window or the Eraser to one line. The rules live in gridRenderer.applyEdgeTool. */
  function applyEdge(handle) {
    const orientation = handle.dataset.orientation, r = Number(handle.dataset.row), c = Number(handle.dataset.col);
    const key = gridRenderer.edgeKey(orientation, r, c);
    if (key === state.lastEdgeKey) return;          // still on the same line during a drag
    state.lastEdgeKey = key;
    if (gridRenderer.applyEdgeTool(state.layout, edgeToolNow(), orientation, r, c)) scheduleRender();
  }

  const cellFrom = (target) => {
    const cell = target && target.closest ? target.closest('.cell') : null;
    return cell && el.world.contains(cell) ? cell : null;
  };

  // ---- rectangle: Spots → fill (or erase) the cells; Walls → draw the outline (or erase every line inside)
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
      el.world.querySelectorAll('.cell').forEach(cell => {
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
    if (state.mode === 'edges') {
      const L = state.layout;
      const lines = erase
        ? gridRenderer.rectAllEdges(b.top, b.left, b.bottom, b.right)
        : gridRenderer.rectOutlineEdges(b.top, b.left, b.bottom, b.right);
      for (const [o, r, c] of lines) {
        const inside = o === 'HORIZONTAL' ? r <= L.rows && c < L.cols : r < L.rows && c <= L.cols;
        if (inside) gridRenderer.applyEdgeTool(L, erase ? ERASER : state.edgeType, o, r, c);
      }
      return;
    }
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

  // ---- resize by dragging the grid's right edge, bottom edge or corner
  function addResizeHandles() {
    const s = stage();
    if (!s) return;
    const titles = {
      right: 'Drag to add or remove columns on the right', left: 'Drag to add or remove columns on the left',
      bottom: 'Drag to add or remove rows at the bottom', top: 'Drag to add or remove rows at the top',
      corner: 'Drag to resize'
    };
    for (const dir of ['right', 'bottom', 'left', 'top', 'corner']) {
      const h = document.createElement('div');
      h.className = `resize-handle rh-${dir}`;
      h.dataset.resize = dir;
      h.title = titles[dir];
      s.appendChild(h);
    }
  }

  /**
   * The handle sits outside the grid, so the new size is the starting size plus how far the mouse moved.
   * Right / bottom / corner grow or shrink at the right / bottom. Left / top grow or shrink at the left / top:
   * the content moves with it (shiftR / shiftC), so what you drew stays where it is on screen.
   */
  function moveResize(x, y) {
    const R = state.resizing;
    const cell = currentCell();
    const clamp = (n) => Math.max(1, Math.min(MAX, n));
    const dx = Math.round((x - R.startX) / cell), dy = Math.round((y - R.startY) / cell);
    R.cols = R.startCols;
    R.rows = R.startRows;
    if (R.dir === 'right' || R.dir === 'corner') R.cols = clamp(R.startCols + dx);
    if (R.dir === 'left') R.cols = clamp(R.startCols - dx);
    if (R.dir === 'bottom' || R.dir === 'corner') R.rows = clamp(R.startRows + dy);
    if (R.dir === 'top') R.rows = clamp(R.startRows - dy);
    R.shiftC = R.dir === 'left' ? R.cols - R.startCols : 0;
    R.shiftR = R.dir === 'top' ? R.rows - R.startRows : 0;
    drawSizeOutline(R.rows, R.cols, `${R.rows} × ${R.cols}`, R.shiftR, R.shiftC);
  }

  function endResize() {
    const { rows, cols, shiftR, shiftC } = state.resizing;
    state.resizing = null;
    removeSizePreview();
    if (rows !== state.layout.rows || cols !== state.layout.cols) applyResize(rows, cols, shiftR, shiftC);
  }

  el.host.addEventListener('pointerdown', (e) => {
    if (!state.layout) return;
    closePopover();
    const handle = e.target.closest('.resize-handle');
    if (handle && e.button === 0) {
      e.preventDefault();
      const { rows, cols } = state.layout;
      state.resizing = {
        dir: handle.dataset.resize, rows, cols, startRows: rows, startCols: cols, shiftR: 0, shiftC: 0,
        startX: e.clientX, startY: e.clientY
      };
      moveResize(e.clientX, e.clientY);
      return;
    }
    if (e.button === 1 || (e.button === 0 && (state.space || state.tool === 'hand'))) { startPan(e); return; }
    if (e.button > 0) return;
    const erase = state.tool === ERASER;
    const asRect = state.tool === 'rect' || (e.shiftKey && (state.tool === 'brush' || erase));

    if (state.mode === 'edges') {
      if (asRect) {
        const at = cellAtPoint(e.clientX, e.clientY, false);
        if (!at) return;
        e.preventDefault();
        state.stroke = gridRenderer.snapshot(state.layout);
        state.rect = { r0: at.r, c0: at.c, r1: at.r, c1: at.c, erase };
        schedulePreview();
        return;
      }
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
    const at = cell ? { r: Number(cell.dataset.row), c: Number(cell.dataset.col) } : cellAtPoint(e.clientX, e.clientY, false);
    if (!at) return;
    const under = gridRenderer.zoneAt(state.layout, at.r, at.c);
    if (e.altKey) {                                  // eyedropper
      if (under) pickZone(under.id); else toast('That spot is empty.');
      return;
    }
    if (!erase && state.zoneId == null) {
      if (under) { pickZone(under.id); toast(`Picked ${under.name}. Paint with it now.`); }
      else toast('Pick a zone first: press 1–9 or use the Zones panel.');
      return;
    }
    e.preventDefault();
    if (e.target.hasPointerCapture && e.target.hasPointerCapture(e.pointerId)) e.target.releasePointerCapture(e.pointerId);
    state.stroke = gridRenderer.snapshot(state.layout);
    if (asRect) {
      state.rect = { r0: at.r, c0: at.c, r1: at.r, c1: at.c, erase };
      schedulePreview();
      return;
    }
    state.painting = true;
    if (paint(at.r, at.c, erase)) scheduleRender();
  });

  el.host.addEventListener('pointermove', (e) => {
    if (state.resizing) { moveResize(e.clientX, e.clientY); return; }
    if (state.pan) {
      el.host.scrollLeft = state.pan.left - (e.clientX - state.pan.x);
      el.host.scrollTop = state.pan.top - (e.clientY - state.pan.y);
      return;
    }
    if (state.tool === 'hand' && state.layout) {      // hover inspect for the Preview
      const h = state.mode === 'edges' && e.target.closest ? e.target.closest('.edge-handle') : null;
      const hover = h
        ? { line: [h.dataset.orientation, Number(h.dataset.row), Number(h.dataset.col)] }
        : cellAtPoint(e.clientX, e.clientY, false);
      if (JSON.stringify(hover) !== JSON.stringify(state.hover)) { state.hover = hover; renderPreview(); }
      return;
    }
    if (state.edgePainting) {
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const h = under && under.closest ? under.closest('.edge-handle') : null;
      if (h && el.world.contains(h)) applyEdge(h);
      return;
    }
    if (state.rect) {
      const at = cellAtPoint(e.clientX, e.clientY, true);
      if (at && (state.rect.r1 !== at.r || state.rect.c1 !== at.c)) { state.rect.r1 = at.r; state.rect.c1 = at.c; schedulePreview(); }
      return;
    }
    if (!state.painting) return;
    const cell = cellFrom(document.elementFromPoint(e.clientX, e.clientY));
    if (cell && paint(Number(cell.dataset.row), Number(cell.dataset.col), state.tool === ERASER)) scheduleRender();
  });
  el.host.addEventListener('pointerleave', () => {
    if (state.hover) { state.hover = null; renderPreview(); }
  });

  /** End of a drag: one undo step for the whole stroke / rectangle. */
  window.addEventListener('pointerup', () => {
    stopPan();
    if (state.resizing) { endResize(); return; }
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
    state.resizing = null;
    state.painting = false;
    state.edgePainting = false;
    state.lastEdgeKey = null;
    removeSizePreview();
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

  // ------------------------------------------------------------------ popovers (size, zoom, menu, color)
  /** Opens pop next to anchor. place: 'above-start' | 'above-end' | 'below-end' | 'left'. */
  function openPopover(pop, anchor, place) {
    if (state.openPop && state.openPop.pop === pop && state.openPop.anchor === anchor) { closePopover(); return; }
    closePopover();
    pop.hidden = false;
    const a = anchor.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let left, top;
    if (place === 'left') {
      left = a.left - w - 10;
      top = a.top - 10;
    } else {
      left = place.endsWith('end') ? a.right - w : a.left;
      top = place.startsWith('above') ? a.top - h - 8 : a.bottom + 8;
    }
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

  const validSize = (n) => Number.isInteger(n) && n >= 1 && n <= MAX;

  function removeSizePreview() {
    el.world.querySelectorAll('.size-preview').forEach(p => p.remove());
  }

  /** shiftR / shiftC: rows / columns added on the top / left (the new grid then starts above / left of the old one). */
  function drawSizeOutline(rows, cols, label, shiftR = 0, shiftC = 0) {
    removeSizePreview();
    const s = stage();
    if (!s) return;
    const cell = currentCell();
    const outline = document.createElement('div');
    outline.className = 'size-preview';
    outline.style.left = `${-shiftC * cell}px`;
    outline.style.top = `${-shiftR * cell}px`;
    outline.style.width = `${cols * cell}px`;
    outline.style.height = `${rows * cell}px`;
    if (label) outline.dataset.label = label;
    s.appendChild(outline);
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
      const { cellsOut, edgesOut } = gridRenderer.resizeLoss(L, rows, cols);
      if (cellsOut.length || edgesOut.length) {
        note.textContent = `Shrinking removes ${plural(cellsOut.length, 'spot')} and ${plural(edgesOut.length, 'wall edit')}.`;
        note.classList.add('is-warn');
      } else {
        note.textContent = `New size: ${rows} × ${cols}.`;
      }
    }
    drawSizeOutline(rows, cols);
  }

  /** shiftR / shiftC: how far the content moves (rows / columns added or removed on the top / left). */
  function applyResize(rows, cols, shiftR = 0, shiftC = 0) {
    const L = state.layout;
    if (!validSize(rows) || !validSize(cols)) {
      toast(`Rows and columns must be whole numbers from 1 to ${MAX}.`, true);
      return;
    }
    if (rows === L.rows && cols === L.cols) { closePopover(); return; }
    const { cellsOut, edgesOut } = gridRenderer.resizeLoss(L, rows, cols, shiftR, shiftC);
    if ((cellsOut.length || edgesOut.length) &&
        !confirm(`Resizing to ${rows} × ${cols} removes ${cellsOut.length} spot(s) and ${edgesOut.length} wall/door edit(s).`
          + '\n\nYou can undo this with Ctrl+Z. Continue?')) {
      render();
      return;
    }
    const before = gridRenderer.snapshot(L);
    gridRenderer.resizeLayout(L, rows, cols, shiftR, shiftC);
    commitAction(before);
    closePopover();
    render();
  }

  el.btnSize.addEventListener('click', openSizePop);
  $('btnSizeCancel').addEventListener('click', closePopover);
  $('btnResize').addEventListener('click', () => applyResize(Number(el.rows.value), Number(el.cols.value)));
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
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); applyResize(Number(el.rows.value), Number(el.cols.value)); }
    });
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

  // ------------------------------------------------------------------ colors of common areas
  /** color → who uses it, for the common areas other than exceptId (plus the unit status colors). */
  function usedColors(exceptId) {
    const used = new Map(Object.entries(STATUS_COLORS));
    for (const z of state.layout.zones) {
      if (!z.rentable && z.id !== exceptId && z.color) used.set(z.color.toLowerCase(), z.name);
    }
    return used;
  }

  const firstFreeColor = (used, preferred) =>
    (preferred && !used.has(preferred) ? preferred : PALETTE.find(c => !used.has(c)) || null);

  /** Fills a palette: used colors are disabled with "Used by …". onPick(color) is called with a free color. */
  function renderPalette(container, selected, used, onPick) {
    container.replaceChildren(...PALETTE.map(color => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'color-opt' + (color === selected ? ' is-selected' : '');
      b.style.backgroundColor = color;
      const by = used.get(color);
      b.disabled = Boolean(by);
      b.title = by ? `Used by ${by}` : color;
      b.setAttribute('aria-label', by ? `${color}, used by ${by}` : color);
      b.addEventListener('click', () => onPick(color));
      return b;
    }));
  }

  function setPreviewTile(tile, color, name, openAir) {
    tile.style.setProperty('--zone-color', color || '#e2e8f0');
    tile.classList.toggle('is-open-air', Boolean(openAir));
    tile.querySelector('.zone-preview-label').textContent = name;
  }

  // ---- change the color of an existing common area (opened from its swatch in the list)
  let colorZoneId = null;
  function openColorPop(zoneId, anchor) {
    const zone = gridRenderer.zoneById(state.layout, zoneId);
    if (!zone) return;
    colorZoneId = zoneId;
    el.colorTitle.textContent = `Color of ${zone.name}`;
    el.colorNote.textContent = '';
    el.colorCustom.value = zone.color;
    renderPalette(el.colorPalette, zone.color.toLowerCase(), usedColors(zoneId), saveZoneColor);
    openPopover(el.colorPop, anchor, 'left');
  }

  async function saveZoneColor(color) {
    const zone = gridRenderer.zoneById(state.layout, colorZoneId);
    if (!zone) return;
    const by = usedColors(zone.id).get(color.toLowerCase());
    if (by) { el.colorNote.textContent = `That color is already used by ${by}.`; return; }
    try {
      const saved = await api.form('PUT', `/api/properties/${propertyId}/common-areas/${zone.id}/color`, { color });
      zone.color = saved.color;
      zone.cssClasses = saved.cssClasses;
      closePopover();
      render();
      toast(`${zone.name} is now ${saved.color}. (Saved; colors are not undone.)`);
    } catch (err) {
      el.colorNote.textContent = err.message;          // e.g. "That color is already used by Walkway."
    }
  }
  el.colorCustom.addEventListener('change', () => saveZoneColor(el.colorCustom.value));
  el.zoneList.addEventListener('click', (e) => {
    const swatch = e.target.closest('[data-color]');
    if (swatch) { e.stopPropagation(); openColorPop(Number(swatch.dataset.color), swatch); return; }
    const item = e.target.closest('.zone-item');
    if (!item) return;
    if (item.dataset.eraser) setTool(ERASER);
    else pickZone(Number(item.dataset.zone));
  });
  el.zoneList.addEventListener('keydown', (e) => {
    const swatch = e.target.closest('[data-color]');
    if (swatch && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); openColorPop(Number(swatch.dataset.color), swatch); }
  });
  el.edgeList.addEventListener('click', (e) => {
    const item = e.target.closest('.zone-item');
    if (!item) return;
    if (item.dataset.eraser) setTool(ERASER);
    else pickEdgeType(item.dataset.edge);
  });
  el.zoneFilter.addEventListener('input', () => state.layout && renderPanel());

  // ------------------------------------------------------------------ toolbar
  document.querySelectorAll('[data-mode]').forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
  document.querySelectorAll('#toolbar [data-tool]').forEach(btn => btn.addEventListener('click', () => {
    if (btn.dataset.tool === 'draw') cycleDraw(); else setTool(btn.dataset.tool);
  }));
  el.preview.addEventListener('click', locateSelection);

  function resetEdges() {
    if (!state.layout) return;
    const count = state.layout.overrides.size;
    if (!count) { toast('Nothing to reset: every wall is already automatic.'); return; }
    if (!confirm(`Reset all ${plural(count, 'wall, door and window edit')} back to the automatic walls?\n\n`
        + 'Doors, windows and walls you drew, and walls you erased, will go back to how SpaceGrid draws them by itself. '
        + 'You can undo this with Ctrl+Z; it only becomes permanent when you press Save.')) return;
    const before = gridRenderer.snapshot(state.layout);
    state.layout.overrides.clear();
    commitAction(before);
    render();
  }
  $('btnResetEdges').addEventListener('click', resetEdges);

  // ------------------------------------------------------------------ add unit / common area (dialog, saved at once)
  function openAddDialog(kind) {
    if (!state.layout) return;
    closePopover();
    const unit = kind === 'unit';
    el.addTitle.textContent = unit ? 'New unit' : 'New common area';
    el.addUnitForm.hidden = !unit;
    el.addAreaForm.hidden = unit;
    el.addUnitForm.reset();
    el.addAreaForm.reset();
    el.areaColorNote.textContent = '';
    state.addColorPicked = false;
    if (unit) {
      setPreviewTile(el.unitPreview, UNIT_PREVIEW_COLOR, 'New unit', false);
    } else {
      suggestAreaColor();
    }
    el.addDialog.showModal();
    (unit ? el.addUnitForm : el.addAreaForm).elements.name.focus();
  }

  function suggestAreaColor() {
    const type = el.addAreaForm.elements.areaType.value;
    state.addColor = firstFreeColor(usedColors(null), TYPE_COLORS[type]);
    renderAreaColor();
  }

  function renderAreaColor() {
    const f = el.addAreaForm.elements;
    const used = usedColors(null);
    renderPalette(el.areaPalette, state.addColor, used, (color) => {
      state.addColor = color;
      state.addColorPicked = true;
      el.areaColorNote.textContent = '';
      renderAreaColor();
    });
    if (state.addColor) el.areaCustom.value = state.addColor;
    if (!state.addColor) el.areaColorNote.textContent = 'Every color in the list is used; pick a custom one.';
    setPreviewTile(el.areaPreview, state.addColor, f.name.value.trim() || 'New area', !INDOOR_TYPES.includes(f.areaType.value));
  }

  $('btnAddUnit').addEventListener('click', () => openAddDialog('unit'));
  $('btnAddArea').addEventListener('click', () => openAddDialog('area'));
  document.querySelectorAll('dialog [data-close]').forEach(btn => btn.addEventListener('click', () => btn.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));
  el.addUnitForm.elements.name.addEventListener('input', () =>
    setPreviewTile(el.unitPreview, UNIT_PREVIEW_COLOR, el.addUnitForm.elements.name.value.trim() || 'New unit', false));
  el.addAreaForm.elements.name.addEventListener('input', renderAreaColor);
  el.addAreaForm.elements.areaType.addEventListener('change', () => {
    if (state.addColorPicked) renderAreaColor(); else suggestAreaColor();
  });
  el.areaCustom.addEventListener('input', () => {
    const color = el.areaCustom.value.toLowerCase();
    const by = usedColors(null).get(color);
    if (by) { el.areaColorNote.textContent = `That color is already used by ${by}.`; return; }
    el.areaColorNote.textContent = '';
    state.addColor = color;
    state.addColorPicked = true;
    renderAreaColor();
  });

  async function addZone(form, url, fields) {
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const zone = await api.form('POST', url, fields);
      state.layout.zones.push({ ...zone, positions: [] });
      el.addDialog.close();
      pickZone(zone.id);                            // ready to place
      toast(`${zone.name} added. Click or drag spots to place it.`);
    } catch (err) {
      toast(err.message, true);
    } finally {
      btn.disabled = false;
    }
  }

  el.addUnitForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target.elements;
    const name = f.name.value.trim();
    const rate = f.rentalRate.value;
    if (!name) return toast('Give the unit a name.', true);
    if (rate === '' || Number(rate) < 0) return toast('Enter a monthly rate of 0 or more.', true);
    const fields = { name, rentalRate: rate, electricity: f.electricity.checked, water: f.water.checked };
    if (f.areaSqm.value) Object.assign(fields, { exactSize: true, areaSqm: f.areaSqm.value });
    addZone(e.target, `/api/properties/${propertyId}/units`, fields);
  });

  el.addAreaForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target.elements;
    const name = f.name.value.trim();
    if (!name) return toast('Give the common area a name.', true);
    if (!state.addColor) return toast('Pick a color for the common area.', true);
    addZone(e.target, `/api/properties/${propertyId}/common-areas`, { name, areaType: f.areaType.value, color: state.addColor });
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
    { group: 'Tools', keys: ['H'], label: 'Hand (move around, hover to inspect)', test: plain('h'), run: () => setTool('hand') },
    { group: 'Tools', keys: ['B'], label: 'Brush · press again for Rectangle', test: plain('b'), run: cycleDraw },
    { group: 'Tools', keys: ['R'], label: 'Rectangle', test: plain('r'), run: () => { setTool('rect'); flash('Rectangle'); } },
    { group: 'Tools', keys: ['E'], label: 'Eraser', test: plain('e'), run: () => setTool(ERASER) },
    { group: 'Tools', keys: ['1', '–', '9'], label: 'Spots: pick zone 1–9 · Walls: 1 Wall, 2 Door, 3 Window',
      test: (e) => noMods(e) && !e.shiftKey && /^[1-9]$/.test(e.key),
      run: (e) => {
        const n = Number(e.key);
        if (state.mode === 'edges') { if (EDGE_TYPES[n - 1]) pickEdgeType(EDGE_TYPES[n - 1].type); }
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
    { group: 'View', keys: ['G'], label: 'Resize grid (or drag the grid\'s edges)', test: plain('g'), run: openSizePop },

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
    note.textContent = 'On a Mac, use Cmd instead of Ctrl. Adding a unit or common area, and changing a color, '
      + 'are saved at once and cannot be undone.';
    body.appendChild(note);
    el.shortcutsDialog.showModal();
  }

  const typingInField = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;

  function onEscape(e) {
    if (state.openPop) { closePopover(); return; }
    if (typingInField(e)) { e.target.blur(); return; }
    if (state.resizing) { state.resizing = null; removeSizePreview(); return; }
    if (state.rect) { cancelRect(); return; }
    if (state.tool !== 'hand') setTool('hand');
  }

  document.addEventListener('keydown', (e) => {
    if (document.querySelector('dialog[open]')) return;     // a dialog handles its own keys (Esc closes it)
    if (e.key === 'Escape') { onEscape(e); return; }
    if (!state.layout) return;
    const typing = typingInField(e);
    // Hold space to pan. Holding a key repeats keydown, and every repeat must be stopped too: the browser's default
    // for Space is "scroll down", which otherwise keeps scrolling the canvas while you drag.
    if (e.key === ' ' && !typing && noMods(e)) {
      e.preventDefault();
      if (!state.space) { state.space = true; el.host.classList.add('is-pan-ready'); }
      return;
    }
    if (e.repeat && !/^[+=\-_]$/.test(e.key)) return;     // other keys act once per press (only zoom repeats)
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
  window.addEventListener('resize', () => {
    closePopover();
    if (state.zoom === 'fit' && state.layout) { render(); centerView(); } else scheduleRender();
  });
  window.addEventListener('beforeunload', (e) => { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });

  // ------------------------------------------------------------------ start
  /** keepHistory = true after a save: undo still works, and "unsaved" is now measured from the saved layout. */
  function load(property, keepHistory) {
    const first = !state.layout;
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
    if (first) centerView();
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
