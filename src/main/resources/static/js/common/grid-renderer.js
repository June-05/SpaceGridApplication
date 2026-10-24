/*
 * grid-renderer.js — draws a property's grid. Used by landlord/property-grid.html (editable)
 * and later by lease.html (read-only, one unit highlighted).
 *
 * Works on a "layout" built from the JSON of GET /api/properties/{id} (PropertyController.get):
 *   { rows, cols, zones: [...zone JSON...], cells: Map("r,c" -> zoneId), overrides: Map("ORIENTATION:r:c" -> EdgeType) }
 * Zone JSON: { id, name, rentable, enclosed, cssClasses, color, positions: [{row, col}], status | areaType, ... }
 *
 * Line names (same as GridEdge in Java):
 *   HORIZONTAL (r, c) = the line above spot (r, c)   r = 0..rows (rows = bottom border)
 *   VERTICAL   (r, c) = the line left of spot (r, c)  c = 0..cols (cols = right border)
 * Automatic walls use the same rule as Property.autoEdgeAt(): a WALL where the spots on both sides belong
 * to different zones and at least one of them is enclosed (also on the outer border next to an enclosed spot).
 * Manual overrides (WALL, DOOR, WINDOW, OPEN) replace the automatic result; OPEN means "no wall".
 */
const gridRenderer = {
  cellKey: (r, c) => `${r},${c}`,
  edgeKey: (orientation, r, c) => `${orientation}:${r}:${c}`,

  /** Builds an editable layout from the property JSON. */
  fromProperty(property) {
    const layout = {
      rows: property.gridRows,
      cols: property.gridColumns,
      zones: property.zones.map(z => ({ ...z })),
      cells: new Map(),
      overrides: new Map()
    };
    for (const zone of layout.zones) {
      for (const p of zone.positions || []) layout.cells.set(this.cellKey(p.row, p.col), zone.id);
    }
    for (const [type, edges] of Object.entries(property.edgesByType || {})) {
      for (const e of edges) layout.overrides.set(this.edgeKey(e.orientation, e.row, e.col), type);
    }
    return layout;
  },

  /** Body for PUT /api/properties/{id}/grid: { "zoneId": [{row, col}, ...] } */
  toSpotsByZone(layout) {
    const result = {};
    for (const [key, zoneId] of layout.cells) {
      const [row, col] = key.split(',').map(Number);
      (result[zoneId] ||= []).push({ row, col });
    }
    return result;
  },

  /** Body for PUT /api/properties/{id}/edges: { "DOOR": [{row, col, orientation}], ... } */
  toEdgesByType(layout) {
    const result = {};
    for (const [key, type] of layout.overrides) {
      const [orientation, row, col] = key.split(':');
      (result[type] ||= []).push({ row: Number(row), col: Number(col), orientation });
    }
    return result;
  },

  zoneById(layout, id) {
    return layout.zones.find(z => z.id === id) || null;
  },

  zoneAt(layout, r, c) {
    if (r < 0 || c < 0 || r >= layout.rows || c >= layout.cols) return null;
    const id = layout.cells.get(this.cellKey(r, c));
    return id == null ? null : this.zoneById(layout, id);
  },

  /** The two spots on each side of a line (null when outside the grid). */
  sidesOf(layout, orientation, r, c) {
    return orientation === 'HORIZONTAL'
      ? [[r - 1, c], [r, c]].map(([y, x]) => (y >= 0 && y < layout.rows ? [y, x] : null))
      : [[r, c - 1], [r, c]].map(([y, x]) => (x >= 0 && x < layout.cols ? [y, x] : null));
  },

  autoWall(layout, orientation, r, c) {
    const [a, b] = this.sidesOf(layout, orientation, r, c).map(s => (s ? this.zoneAt(layout, s[0], s[1]) : null));
    if (a && b && a.id === b.id) return false;           // inside one zone
    return Boolean((a && a.enclosed) || (b && b.enclosed));
  },

  /** { type, auto } for a line, or null when nothing is drawn there. */
  edgeAt(layout, orientation, r, c) {
    const override = layout.overrides.get(this.edgeKey(orientation, r, c));
    if (override) return { type: override, auto: false };
    return this.autoWall(layout, orientation, r, c) ? { type: 'WALL', auto: true } : null;
  },

  /**
   * Draws the grid into container.
   * options: { mode: 'view' | 'spots' | 'edges', brushZoneId, highlightZoneId, minCell, maxCell }
   */
  render(container, layout, options = {}) {
    const mode = options.mode || 'view';
    const width = container.clientWidth || 600;
    const cell = Math.max(options.minCell || 30, Math.min(options.maxCell || 72, Math.floor((width - 8) / layout.cols)));
    const stage = document.createElement('div');
    stage.className = `grid-stage mode-${mode}`;
    stage.style.setProperty('--cell', `${cell}px`);
    stage.style.width = `${layout.cols * cell}px`;
    stage.style.height = `${layout.rows * cell}px`;

    // ---- cells
    const grid = document.createElement('div');
    grid.className = 'grid';
    grid.style.setProperty('--cols', layout.cols);
    const labelled = new Set();
    for (let r = 0; r < layout.rows; r++) {
      for (let c = 0; c < layout.cols; c++) {
        const el = document.createElement('div');
        el.className = 'cell';
        el.dataset.row = r;
        el.dataset.col = c;
        const zone = this.zoneAt(layout, r, c);
        let title = `Row ${r + 1}, Col ${c + 1}: `;
        if (zone) {
          el.className += ' ' + zone.cssClasses;
          el.style.setProperty('--zone-color', zone.color);
          if (zone.id === options.brushZoneId) el.classList.add('is-brush');
          if (options.highlightZoneId != null) {
            el.classList.add(zone.id === options.highlightZoneId ? 'is-highlight' : 'is-dim');
          }
          if (!labelled.has(zone.id)) {                  // name on the zone's first spot
            labelled.add(zone.id);
            const tag = document.createElement('span');
            tag.className = 'cell-label';
            tag.textContent = zone.name;
            let run = 1;                                     // label stays within the zone's spots in this row
            while (c + run < layout.cols && layout.cells.get(this.cellKey(r, c + run)) === zone.id) run++;
            tag.style.maxWidth = `${run * cell - 6}px`;
            el.appendChild(tag);
          }
          title += zone.name;
        } else {
          title += 'empty';
        }
        el.title = title;
        grid.appendChild(el);
      }
    }
    stage.appendChild(grid);

    // ---- edges (walls, doors, windows) and, in edge mode, a clickable handle for every line
    const layer = document.createElement('div');
    layer.className = 'edge-layer';
    const lines = [];
    for (let r = 0; r <= layout.rows; r++) for (let c = 0; c < layout.cols; c++) lines.push(['HORIZONTAL', r, c]);
    for (let r = 0; r < layout.rows; r++) for (let c = 0; c <= layout.cols; c++) lines.push(['VERTICAL', r, c]);
    for (const [o, r, c] of lines) {
      const edge = this.edgeAt(layout, o, r, c);
      const place = (el) => {
        if (o === 'HORIZONTAL') { el.style.left = `${c * cell}px`; el.style.top = `${r * cell}px`; el.style.width = `${cell}px`; }
        else { el.style.left = `${c * cell}px`; el.style.top = `${r * cell}px`; el.style.height = `${cell}px`; }
      };
      if (edge && (edge.type !== 'OPEN' || mode === 'edges')) {
        const el = document.createElement('div');
        el.className = `edge ${o === 'HORIZONTAL' ? 'edge-h' : 'edge-v'} edge-${edge.type.toLowerCase()}${edge.auto ? ' is-auto' : ''}`;
        place(el);
        layer.appendChild(el);
      }
      if (mode === 'edges') {
        const handle = document.createElement('div');
        handle.className = `edge-handle ${o === 'HORIZONTAL' ? 'edge-h' : 'edge-v'}`;
        handle.dataset.orientation = o;
        handle.dataset.row = r;
        handle.dataset.col = c;
        handle.title = edge ? `${edge.type.charAt(0) + edge.type.slice(1).toLowerCase()}${edge.auto ? ' (automatic)' : ''}` : 'No wall';
        place(handle);
        layer.appendChild(handle);
      }
    }
    stage.appendChild(layer);
    container.replaceChildren(stage);
  }
};
