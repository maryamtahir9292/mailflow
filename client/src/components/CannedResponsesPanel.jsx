import { useState } from 'react';
import './CannedResponsesPanel.css';

const CATEGORY_COLORS = {
  damage: '#ec4899', returns: '#8b5cf6', refund: '#ef4444',
  replacement: '#f59e0b', delivery: '#3b82f6', general: '#6b7280',
  greeting: '#10b981', closing: '#64748b',
};

const CATEGORIES = ['all', 'refund', 'replacement', 'returns', 'damage', 'delivery', 'greeting', 'closing', 'general'];

function highlightVars(text) {
  const parts = text.split(/(\{[^}]+\})/g);
  return parts.map((part, i) =>
    /^\{[^}]+\}$/.test(part)
      ? <span key={i} className="cr-var-highlight">{part}</span>
      : part
  );
}

export default function CannedResponsesPanel({
  responses, loading, onInsert, onSeed, onCreate, onUpdate, onRemove, onUse,
}) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: '', body: '', category: 'general', shortcut: '', tags: '' });

  const filtered = (responses || []).filter(r => {
    if (activeCategory !== 'all' && r.category !== activeCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.title.toLowerCase().includes(q) ||
        r.body.toLowerCase().includes(q) ||
        r.shortcut?.toLowerCase().includes(q) ||
        r.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleInsert = async (r) => {
    let text = r.body;
    if (onUse) {
      try { text = await onUse(r._id, {}); } catch { /* use raw body */ }
    }
    onInsert(text);
  };

  const startCreate = () => {
    setEditingId(null);
    setForm({ title: '', body: '', category: 'general', shortcut: '', tags: '' });
    setShowCreate(true);
  };

  const startEdit = (r) => {
    setEditingId(r._id);
    setForm({
      title: r.title,
      body: r.body,
      category: r.category || 'general',
      shortcut: r.shortcut || '',
      tags: (r.tags || []).join(', '),
    });
    setShowCreate(true);
  };

  const handleSave = async () => {
    const payload = {
      title: form.title.trim(),
      body: form.body.trim(),
      category: form.category,
      shortcut: form.shortcut.trim(),
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    };
    if (!payload.title || !payload.body) return;
    try {
      if (editingId) {
        await onUpdate(editingId, payload);
      } else {
        await onCreate(payload);
      }
      setShowCreate(false);
      setEditingId(null);
    } catch { /* silent */ }
  };

  return (
    <div className="cr-panel">
      {/* Header */}
      <div className="cr-header">
        <div className="cr-header-left">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>
          </svg>
          <span className="cr-title">Quick Templates</span>
          <span className="cr-count">{filtered.length}</span>
        </div>
        <div className="cr-header-right">
          {responses.length === 0 && (
            <button className="cr-seed-btn" onClick={onSeed} title="Load default templates">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Seed Defaults
            </button>
          )}
          <button className="cr-add-btn" onClick={startCreate} title="Create new template">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="cr-search-wrap">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className="cr-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates or type shortcut..."
        />
        {search && (
          <button className="cr-search-clear" onClick={() => setSearch('')}>&times;</button>
        )}
      </div>

      {/* Category tabs */}
      <div className="cr-categories">
        {CATEGORIES.map(c => (
          <button
            key={c}
            className={`cr-cat-tab ${activeCategory === c ? 'cr-cat-tab--active' : ''}`}
            onClick={() => setActiveCategory(c)}
            style={activeCategory === c && c !== 'all' ? { borderColor: CATEGORY_COLORS[c], color: CATEGORY_COLORS[c] } : {}}
          >
            {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>

      {/* Create / Edit form */}
      {showCreate && (
        <div className="cr-create-form">
          <div className="cr-form-header">
            <span>{editingId ? 'Edit Template' : 'New Template'}</span>
            <button className="cr-form-close" onClick={() => { setShowCreate(false); setEditingId(null); }}>&times;</button>
          </div>
          <input
            className="cr-form-input"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <textarea
            className="cr-form-textarea"
            placeholder="Template body... Use {variable_name} for placeholders"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={4}
          />
          <div className="cr-form-row">
            <select
              className="cr-form-select"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.filter(c => c !== 'all').map(c => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
            <input
              className="cr-form-input cr-form-input--short"
              placeholder="/shortcut"
              value={form.shortcut}
              onChange={(e) => setForm({ ...form, shortcut: e.target.value })}
            />
          </div>
          <input
            className="cr-form-input"
            placeholder="Tags (comma-separated)"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
          />
          <div className="cr-form-actions">
            <button className="cr-form-cancel" onClick={() => { setShowCreate(false); setEditingId(null); }}>Cancel</button>
            <button className="cr-form-save" onClick={handleSave} disabled={!form.title.trim() || !form.body.trim()}>
              {editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Template list */}
      <div className="cr-list">
        {loading ? (
          <div className="cr-empty">Loading templates...</div>
        ) : filtered.length === 0 ? (
          <div className="cr-empty">
            {responses.length === 0
              ? 'No templates yet — click "Seed Defaults" to load starter templates.'
              : 'No templates match your search.'}
          </div>
        ) : (
          filtered.map(r => (
            <div className="cr-item" key={r._id}>
              <div className="cr-item-header">
                <span className="cr-item-title">{r.title}</span>
                <span className="cr-item-cat" style={{ background: `${CATEGORY_COLORS[r.category] || '#6b7280'}18`, color: CATEGORY_COLORS[r.category] || '#6b7280' }}>
                  {r.category}
                </span>
              </div>
              <div className="cr-item-body">{highlightVars(r.body.length > 120 ? r.body.slice(0, 120) + '...' : r.body)}</div>
              <div className="cr-item-footer">
                <div className="cr-item-meta">
                  {r.shortcut && <span className="cr-item-shortcut">{r.shortcut}</span>}
                  <span className="cr-item-usage">Used {r.usageCount || 0}×</span>
                </div>
                <div className="cr-item-actions">
                  <button className="cr-item-edit" onClick={() => startEdit(r)} title="Edit">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button className="cr-item-delete" onClick={() => onRemove(r._id)} title="Delete">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                  </button>
                  <button className="cr-item-insert" onClick={() => handleInsert(r)}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
                    </svg>
                    Insert
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
