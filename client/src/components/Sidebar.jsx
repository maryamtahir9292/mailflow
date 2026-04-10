import { CATEGORIES } from '../hooks/useEmails.js';
import CategoryTab    from './CategoryTab.jsx';
import './Sidebar.css';

export default function Sidebar({ activeCategory, onSelect, counts }) {
  const queueCount    = counts.queue           || 0;
  const newCount      = counts.new_status      || 0;
  const openCount     = counts.open            || 0;
  const awaitingCount = counts.awaiting_reply   || 0;
  const resolvedCount = counts.resolved         || 0;
  const callbackCount = counts.callbacks        || 0;

  return (
    <aside className="sidebar">

      {/* ── Smart Queue — primary view ──────────────────────────── */}
      <div className="sidebar-section-label">Support Queue</div>
      <div className="sidebar-nav">

        {/* Smart Queue — all actionable */}
        <button
          className={`cat-tab cat-tab--queue ${activeCategory === 'queue' ? 'cat-tab--active' : ''}`}
          onClick={() => onSelect('queue')}
          style={activeCategory === 'queue' ? { '--accent': '#f97316', borderLeftColor: '#f97316' } : {}}
        >
          <span className="cat-icon" style={{ color: '#f97316', opacity: activeCategory === 'queue' ? 1 : 0.7 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </span>
          <span className="cat-label">Smart Queue</span>
          {queueCount > 0 && (
            <span className="cat-count" style={activeCategory === 'queue' ? { background: '#f97316', color: 'white' } : {}}>
              {queueCount}
            </span>
          )}
        </button>

        {/* Needs Callback */}
        <button
          className={`cat-tab ${activeCategory === 'callbacks' ? 'cat-tab--active' : ''}`}
          onClick={() => onSelect('callbacks')}
          style={activeCategory === 'callbacks' ? { '--accent': '#dc2626', borderLeftColor: '#dc2626' } : {}}
        >
          <span className="cat-icon" style={{ color: '#dc2626', opacity: activeCategory === 'callbacks' ? 1 : 0.7 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
            </svg>
          </span>
          <span className="cat-label">Needs Callback</span>
          {callbackCount > 0 && (
            <span className="cat-count callback-count">{callbackCount}</span>
          )}
        </button>
      </div>

      {/* ── Pipeline — status breakdown ─────────────────────────── */}
      <div className="sidebar-divider" />
      <div className="sidebar-section-label">Pipeline</div>
      <div className="sidebar-nav">

        {/* New */}
        <button
          className={`cat-tab ${activeCategory === 'new' ? 'cat-tab--active' : ''}`}
          onClick={() => onSelect('new')}
          style={activeCategory === 'new' ? { '--accent': '#3b82f6', borderLeftColor: '#3b82f6' } : {}}
        >
          <span className="cat-icon" style={{ color: '#3b82f6', opacity: activeCategory === 'new' ? 1 : 0.7 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </span>
          <span className="cat-label">New</span>
          {newCount > 0 && (
            <span className="cat-count" style={activeCategory === 'new' ? { background: '#3b82f6', color: 'white' } : {}}>
              {newCount}
            </span>
          )}
        </button>

        {/* Open */}
        <button
          className={`cat-tab ${activeCategory === 'open' ? 'cat-tab--active' : ''}`}
          onClick={() => onSelect('open')}
          style={activeCategory === 'open' ? { '--accent': '#f59e0b', borderLeftColor: '#f59e0b' } : {}}
        >
          <span className="cat-icon" style={{ color: '#f59e0b', opacity: activeCategory === 'open' ? 1 : 0.7 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
            </svg>
          </span>
          <span className="cat-label">Open</span>
          {openCount > 0 && (
            <span className="cat-count" style={activeCategory === 'open' ? { background: '#f59e0b', color: 'white' } : {}}>
              {openCount}
            </span>
          )}
        </button>

        {/* Awaiting Reply */}
        <button
          className={`cat-tab ${activeCategory === 'awaiting_reply' ? 'cat-tab--active' : ''}`}
          onClick={() => onSelect('awaiting_reply')}
          style={activeCategory === 'awaiting_reply' ? { '--accent': '#8b5cf6', borderLeftColor: '#8b5cf6' } : {}}
        >
          <span className="cat-icon" style={{ color: '#8b5cf6', opacity: activeCategory === 'awaiting_reply' ? 1 : 0.7 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </span>
          <span className="cat-label">Awaiting Reply</span>
          {awaitingCount > 0 && (
            <span className="cat-count" style={activeCategory === 'awaiting_reply' ? { background: '#8b5cf6', color: 'white' } : {}}>
              {awaitingCount}
            </span>
          )}
        </button>

        {/* Resolved */}
        <button
          className={`cat-tab ${activeCategory === 'resolved' ? 'cat-tab--active' : ''}`}
          onClick={() => onSelect('resolved')}
          style={activeCategory === 'resolved' ? { '--accent': '#10b981', borderLeftColor: '#10b981' } : {}}
        >
          <span className="cat-icon" style={{ color: '#10b981', opacity: activeCategory === 'resolved' ? 1 : 0.7 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </span>
          <span className="cat-label">Resolved</span>
          {resolvedCount > 0 && (
            <span className="cat-count" style={activeCategory === 'resolved' ? { background: '#10b981', color: 'white' } : {}}>
              {resolvedCount}
            </span>
          )}
        </button>

      </div>

      {/* ── Categories ──────────────────────────────────────────── */}
      <div className="sidebar-divider" />
      <div className="sidebar-section-label">Categories</div>

      <nav className="sidebar-nav">
        {CATEGORIES.map((cat) => (
          <CategoryTab
            key={cat.id}
            category={cat}
            count={counts[cat.id] || 0}
            isActive={activeCategory === cat.id}
            onClick={() => onSelect(cat.id)}
          />
        ))}
      </nav>

      {/* ── By Date ─────────────────────────────────────────────── */}
      <div className="sidebar-divider" />
      <div className="sidebar-section-label">By Date</div>
      <div className="sidebar-nav">
        {[
          { id: 'today',     label: 'Today',     color: '#22c55e' },
          { id: 'yesterday', label: 'Yesterday',  color: '#3b82f6' },
          { id: 'older',     label: 'Older',      color: '#94a3b8' },
        ].map(({ id, label, color }) => {
          const isActive = activeCategory === id;
          return (
            <button
              key={id}
              className={`cat-tab ${isActive ? 'cat-tab--active' : ''}`}
              onClick={() => onSelect(id)}
              style={isActive ? { '--accent': color, borderLeftColor: color } : {}}
            >
              <span className="cat-icon" style={{ color, opacity: isActive ? 1 : 0.6 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </span>
              <span className="cat-label">{label}</span>
              {counts[id] > 0 && (
                <span
                  className="cat-count"
                  style={isActive ? { background: color, color: 'white' } : {}}
                >
                  {counts[id]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>
        </svg>
        Netherlands · NL · Dutch support
      </div>
    </aside>
  );
}
