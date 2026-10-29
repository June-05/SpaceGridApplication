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
  LABEL_MIN_CELL: 16,     // below this size (px) zone names are not drawn on the grid
  BORDER_MIN_CELL: 10,    // below this size (px) the thin line between spots is dropped
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

  /** A copy of the editable parts of a layout (size, spots, edge overrides), for undo / redo. Zones are not included. */
  snapshot(layout) {
    return { rows: layout.rows, cols: layout.cols, cells: new Map(layout.cells), overrides: new Map(layout.overrides) };
  },

  /** Puts a snapshot back into the layout (copies it again, so the snapshot can be reused). */
  restore(layout, snap) {
    layout.rows = snap.rows;
    layout.cols = snap.cols;
    layout.cells = new Map(snap.cells);
    layout.overrides = new Map(snap.overrides);
  },

  /** True when two snapshots hold the same size, spots and edge overrides. */
  sameSnapshot(a, b) {
    if (!a || !b || a.rows !== b.rows || a.cols !== b.cols) return false;
    if (a.cells.size !== b.cells.size || a.overrides.size !== b.overrides.size) return false;
    for (const [k, v] of a.cells) if (b.cells.get(k) !== v) return false;
    for (const [k, v] of a.overrides) if (b.overrides.get(k) !== v) return false;
    return true;
  },

  /**
   * Where a spot or line ends up after a resize to rows × cols with the content shifted by dr rows and dc columns
   * (dr / dc are not 0 when rows or columns are added to / removed from the top or the left). Null = it falls outside.
   */
  shiftedCell(rows, cols, dr, dc, r, c) {
    const nr = r + dr, nc = c + dc;
    return nr >= 0 && nr < rows && nc >= 0 && nc < cols ? [nr, nc] : null;
  },

  shiftedEdge(rows, cols, dr, dc, orientation, r, c) {
    const nr = r + dr, nc = c + dc;
    const inside = orientation === 'HORIZONTAL'
      ? nr >= 0 && nr <= rows && nc >= 0 && nc < cols
      : nr >= 0 && nr < rows && nc >= 0 && nc <= cols;
    return inside ? [nr, nc] : null;
  },

  /** What a resize would drop: { cellsOut: [cell keys], edgesOut: [edge keys] }. */
  resizeLoss(layout, rows, cols, dr = 0, dc = 0) {
    const cellsOut = [...layout.cells.keys()].filter(k => {
      const [r, c] = k.split(',').map(Number);
      return !this.shiftedCell(rows, cols, dr, dc, r, c);
    });
    const edgesOut = [...layout.overrides.keys()].filter(k => {
      const [o, r, c] = k.split(':');
      return !this.shiftedEdge(rows, cols, dr, dc, o, Number(r), Number(c));
    });
    return { cellsOut, edgesOut };
  },

  /** Resizes the layout to rows × cols, moving the spots and edge overrides by (dr, dc) and dropping what falls outside. */
  resizeLayout(layout, rows, cols, dr = 0, dc = 0) {
    const cells = new Map();
    for (const [k, zoneId] of layout.cells) {
      const [r, c] = k.split(',').map(Number);
      const to = this.shiftedCell(rows, cols, dr, dc, r, c);
      if (to) cells.set(this.cellKey(to[0], to[1]), zoneId);
    }
    const overrides = new Map();
    for (const [k, type] of layout.overrides) {
      const [o, r, c] = k.split(':');
      const to = this.shiftedEdge(rows, cols, dr, dc, o, Number(r), Number(c));
      if (to) overrides.set(this.edgeKey(o, to[0], to[1]), type);
    }
    layout.rows = rows;
    layout.cols = cols;
    layout.cells = cells;
    layout.overrides = overrides;
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
    // index by id: big grids (60 × 60) call this thousands of times per draw
    if (!layout.zoneIndex || layout.zoneIndex.size !== layout.zones.length) {
      layout.zoneIndex = new Map(layout.zones.map(z => [z.id, z]));
    }
    return layout.zoneIndex.get(id) || null;
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
   * Applies one plotter tool to one line and returns true only if something changed.
   *   'erase'  → the line ends up with no wall, door or window (OPEN over an automatic wall, otherwise no override)
   *   'WALL'   → a wall (an automatic wall just comes back when the override is removed)
   *   'DOOR' / 'WINDOW' → that edge
   */
  applyEdgeTool(layout, tool, orientation, r, c) {
    const key = this.edgeKey(orientation, r, c);
    const current = layout.overrides.get(key);
    const auto = this.autoWall(layout, orientation, r, c);
    if (tool === 'erase') {
      if (auto) {
        if (current === 'OPEN') return false;
        layout.overrides.set(key, 'OPEN');
        return true;
      }
      return layout.overrides.delete(key);
    }
    if (tool === 'WALL' && auto) return layout.overrides.delete(key);   // back to the automatic wall
    if (current === tool) return false;
    layout.overrides.set(key, tool);
    return true;
  },

  /** The lines around the cells top..bottom × left..right, as [orientation, r, c] (a walled box). */
  rectOutlineEdges(top, left, bottom, right) {
    const lines = [];
    for (let c = left; c <= right; c++) lines.push(['HORIZONTAL', top, c], ['HORIZONTAL', bottom + 1, c]);
    for (let r = top; r <= bottom; r++) lines.push(['VERTICAL', r, left], ['VERTICAL', r, right + 1]);
    return lines;
  },

  /** Every line inside or on the outline of that rectangle (used to erase an area). */
  rectAllEdges(top, left, bottom, right) {
    const lines = [];
    for (let r = top; r <= bottom + 1; r++) for (let c = left; c <= right; c++) lines.push(['HORIZONTAL', r, c]);
    for (let r = top; r <= bottom; r++) for (let c = left; c <= right + 1; c++) lines.push(['VERTICAL', r, c]);
    return lines;
  },

  /**
   * Draws the grid into container.
   * options: { mode: 'view' | 'spots' | 'edges', brushZoneId, highlightZoneId, highlightZoneIds, minCell, maxCell,
   *             cell }   cell = exact cell size in px (zoom); without it the grid is fitted to the container width
   *   highlightZoneId  = one zone outlined, the others dimmed (lease.html, the plotter's selected unit)
   *   highlightZoneIds = a Set of zones kept bright, the others dimmed (the plotter's "highlight by status")
   */
  render(container, layout, options = {}) {
    const mode = options.mode || 'view';
    const width = container.clientWidth || 600;
    const cell = options.cell
      ? Math.round(options.cell)
      : Math.max(options.minCell || 30, Math.min(options.maxCell || 72, Math.floor((width - 8) / layout.cols)));
    const showLabels = cell >= this.LABEL_MIN_CELL;
    const stage = document.createElement('div');
    stage.className = `grid-stage mode-${mode}${showLabels ? '' : ' is-small'}${cell < this.BORDER_MIN_CELL ? ' is-tiny' : ''}`;
    stage.style.setProperty('--cell', `${cell}px`);
    // walls and clickable lines shrink with the cells, so small cells are not covered by thick lines
    stage.style.setProperty('--edge', `${Math.max(1, Math.min(5, Math.round(cell / 10)))}px`);
    stage.style.setProperty('--handle', `${Math.max(4, Math.min(12, Math.round(cell / 3)))}px`);
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
          } else if (options.highlightZoneIds) {          // several zones at once (e.g. all available units)
            el.classList.add(options.highlightZoneIds.has(zone.id) ? 'is-picked' : 'is-dim');
          }
          if (showLabels && !labelled.has(zone.id)) {    // name on the zone's first spot (hover title when cells are small)
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
  },

  /**
   * Small read-only preview (dashboard and homepage cards, the homepage details map): the cell size is picked so
   * the whole grid fits the container's width AND height. Names and thin lines drop out by themselves when cells
   * are small. options.highlightZoneIds / highlightZoneId work as in render(). A hidden container (size 0) uses
   * options.fallbackWidth / fallbackHeight (default 120 x 80).
   */
  thumbnail(container, layout, options = {}) {
    const width = container.clientWidth || options.fallbackWidth || 120;
    const height = container.clientHeight || options.fallbackHeight || 80;
    const cell = Math.max(2, Math.floor(Math.min(width / layout.cols, height / layout.rows)));
    this.render(container, layout, { ...options, mode: 'view', cell });
  },

  /** True when at least one zone has spots on the grid (otherwise there is nothing to preview). */
  hasSpots(layout) {
    return layout.cells.size > 0;
  }
};
