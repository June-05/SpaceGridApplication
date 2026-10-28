/*
 * floating-panel.js — makes a panel float over the page: drag it by its header, minimize it to a small pill,
 * double-click the header to dock it back in its CSS position. Position and minimized state are remembered
 * in this browser (localStorage, wrapped in try/catch because it can be blocked).
 *
 *   const panel = floatingPanel.init(element, {
 *     storageKey: 'spacegrid.zonesPanel',   // where the state is remembered
 *     handle: headerElement,                // drag area (buttons inside it still work)
 *     minimizeButton: buttonElement,        // optional: toggles minimized
 *     startMinimized: false,                // used when nothing is remembered yet
 *     onChange(state) {}                    // optional: called after a move / minimize
 *   });
 *   panel.toggle();  panel.setMinimized(true);  panel.dock();  panel.isMinimized();
 */
const floatingPanel = {
  init(panel, options = {}) {
    const key = options.storageKey;
    const handle = options.handle || panel;
    const minimizeButton = options.minimizeButton || null;
    let state = { x: null, y: null, minimized: Boolean(options.startMinimized) };

    try {
      const saved = key ? JSON.parse(localStorage.getItem(key) || 'null') : null;
      if (saved && typeof saved === 'object') state = { ...state, ...saved };
    } catch (err) {
      // nothing remembered: keep the defaults
    }

    function save() {
      try { if (key) localStorage.setItem(key, JSON.stringify(state)); } catch (err) { /* not remembered */ }
      if (options.onChange) options.onChange({ ...state });
    }

    /** Keeps at least part of the panel on screen (the window may have become smaller since last time). */
    function clamp(x, y) {
      const w = panel.offsetWidth, h = panel.offsetHeight;
      return {
        x: Math.min(Math.max(8 - w + 80, x), window.innerWidth - 80),
        y: Math.min(Math.max(8, y), window.innerHeight - 44)
      };
    }

    function apply() {
      panel.classList.toggle('is-minimized', state.minimized);
      if (minimizeButton) {
        minimizeButton.setAttribute('aria-expanded', String(!state.minimized));
        minimizeButton.dataset.tip = state.minimized ? 'Expand' : 'Minimize';
      }
      if (state.x == null || state.y == null) {          // docked: the CSS position (top/right) is used
        panel.style.left = panel.style.top = '';
        panel.style.right = '';
        return;
      }
      const p = clamp(state.x, state.y);
      panel.style.left = `${p.x}px`;
      panel.style.top = `${p.y}px`;
      panel.style.right = 'auto';
    }

    // ---- drag by the header
    let drag = null;
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button, input, a, select, textarea')) return;
      const box = panel.getBoundingClientRect();
      drag = { dx: e.clientX - box.left, dy: e.clientY - box.top, moved: false };
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const x = e.clientX - drag.dx, y = e.clientY - drag.dy;
      if (!drag.moved && Math.abs(e.movementX) + Math.abs(e.movementY) === 0) return;
      drag.moved = true;
      panel.classList.add('is-dragging');
      const p = clamp(x, y);
      state.x = p.x;
      state.y = p.y;
      panel.style.left = `${p.x}px`;
      panel.style.top = `${p.y}px`;
      panel.style.right = 'auto';
    });
    const endDrag = () => {
      if (!drag) return;
      const moved = drag.moved;
      drag = null;
      panel.classList.remove('is-dragging');
      if (moved) save();
    };
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
    handle.addEventListener('dblclick', (e) => {
      if (e.target.closest('button')) return;
      controls.dock();
    });
    if (minimizeButton) minimizeButton.addEventListener('click', () => controls.toggle());
    window.addEventListener('resize', apply);

    const controls = {
      isMinimized: () => state.minimized,
      setMinimized(minimized) {
        state.minimized = Boolean(minimized);
        apply();
        save();
      },
      toggle() { controls.setMinimized(!state.minimized); },
      dock() {
        state.x = null;
        state.y = null;
        apply();
        save();
      }
    };
    apply();
    return controls;
  }
};
