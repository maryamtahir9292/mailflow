/**
 * Single source of truth for all email categories.
 * Every component that needs category metadata imports from here.
 */
export const CATEGORIES = [
  { id: 'all',         label: 'All Emails',   icon: 'all',         bg: null,      color: '#a8c4e0' },
  { id: 'damage',      label: 'Damage',        icon: 'damage',      bg: '#fef2f2', color: '#ef4444' },
  { id: 'returns',     label: 'Returns',       icon: 'returns',     bg: '#faf5ff', color: '#8b5cf6' },
  { id: 'refund',      label: 'Refund',        icon: 'refund',      bg: '#fff1f2', color: '#f43f5e' },
  { id: 'replacement', label: 'Replacement',   icon: 'replacement', bg: '#fffbeb', color: '#d97706' },
  { id: 'delivery',    label: 'Delivery',      icon: 'delivery',    bg: '#eff6ff', color: '#3b82f6' },
  { id: 'general',     label: 'General',       icon: 'general',     bg: '#f0fdf4', color: '#10b981' },
];

// Lookup by id — use this wherever you need { bg, color, label } for a category
export const CAT_META = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

// All category ids except 'all' — used in category picker dropdowns
export const CATEGORY_IDS = CATEGORIES.filter(c => c.id !== 'all').map(c => c.id);
