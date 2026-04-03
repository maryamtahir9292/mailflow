import { CATEGORIES } from '../hooks/useEmails.js';
import CategoryTab    from './CategoryTab.jsx';
import './Sidebar.css';

export default function Sidebar({ activeCategory, onSelect, counts }) {
  const callbackCount = counts.callbacks || 0;
  const doneCount     = counts.done     || 0;
  const pendingCount  = counts.pending  || 0;

  return (
    <aside className="sidebar">
      <div className="sidebar-section-label">Inbox Categories</div>

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

      {/* Workflow section — Callback, Done, Pending */}
      <div className="sidebar-divider" />
      <div className="sidebar-section-label">Workflow</div>
      <div className="sidebar-nav">

        {/* Needs Callback */}
        <button
          className={`cat-tab ${activeCategory === 'callbacks' ? 'cat-tab--active' : ''}`}
          onClick={() => onSelect('callbacks')}
          style={activeCategory === 'callbacks' ? { '--accent': '#f97316', borderLeftColor: '#f97316' } : {}}
        >
          <span className="cat-icon" style={{ color: '#f97316', opacity: activeCategory === 'callbacks' ? 1 : 0.7 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
            </svg>
          </span>
          <span className="cat-label">Needs Callback</span>
          {callbackCount > 0 && (
            <span className="cat-count callback-count">{callbackCount}</span>
          )}
        </button>

        {/* Done */}
        <button
          className={`cat-tab ${activeCategory === 'done' ? 'cat-tab--active' : ''}`}
          onClick={() => onSelect('done')}
          style={activeCategory === 'done' ? { '--accent': '#16a34a', borderLeftColor: '#16a34a' } : {}}
        >
          <span className="cat-icon" style={{ color: '#16a34a', opacity: activeCategory === 'done' ? 1 : 0.7 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </span>
          <span className="cat-label">Done</span>
          {doneCount > 0 && (
            <span className="cat-count" style={activeCategory === 'done' ? { background: '#16a34a', color: 'white' } : {}}>
              {doneCount}
            </span>
          )}
        </button>

        {/* Pending */}
        <button
          className={`cat-tab ${activeCategory === 'pending' ? 'cat-tab--active' : ''}`}
          onClick={() => onSelect('pending')}
          style={activeCategory === 'pending' ? { '--accent': '#6366f1', borderLeftColor: '#6366f1' } : {}}
        >
          <span className="cat-icon" style={{ color: '#6366f1', opacity: activeCategory === 'pending' ? 1 : 0.7 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </span>
          <span className="cat-label">Pending</span>
          {pendingCount > 0 && (
            <span className="cat-count" style={activeCategory === 'pending' ? { background: '#6366f1', color: 'white' } : {}}>
              {pendingCount}
            </span>
          )}
        </button>

      </div>

      {/* By Date — quick date filters */}
      <div className="sidebar-divider" />
      <div className="sidebar-section-label">By Date</div>
      <div className="sidebar-nav" style={{}}>
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
