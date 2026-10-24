/*
 * format.js — display helpers shared by the pages.
 *
 * Enums arrive in JSON by NAME (e.g. "EXPIRING_SOON"). Their CSS class follows one rule:
 *   prefix + name in lowercase with "_" → "-"
 *   cssClass('state-', 'EXPIRING_SOON') → 'state-expiring-soon'   (same as LeaseState.getCssClass())
 * Prefixes: 'status-' UnitStatus · 'state-' LeaseState · 'due-' DueStatus · 'zone-' CommonAreaType · 'edge-' EdgeType
 */
const format = {
  cssClass(prefix, enumName) {
    return prefix + enumName.toLowerCase().replaceAll('_', '-');
  },

  peso(amount) {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(amount || 0));
  },

  /** Enum name → readable text: "UNDER_MAINTENANCE" → "Under maintenance" */
  label(enumName) {
    const s = String(enumName || '').toLowerCase().replaceAll('_', ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  },

  date(isoDate) {
    // TODO: "2026-10-24" → "Oct 24, 2026"
  },

  badge(prefix, enumName) {
    // TODO: return an element/HTML like <span class="badge state-expiring-soon">Expiring soon</span>
  }
};
