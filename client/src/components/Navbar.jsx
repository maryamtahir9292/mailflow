import './Navbar.css';

export default function Navbar({ user, onLogout, onSwitch, onRefresh, loading, onCompose, page, navigate }) {
  return (
    <nav className="navbar">
      {/* Brand */}
      <div className="navbar-brand">
        <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
          <rect width="34" height="34" rx="9" fill="#f97316" />
          <rect x="6" y="10" width="22" height="15" rx="2.5" stroke="white" strokeWidth="2" fill="none" />
          <path d="M6 13l11 8 11-8" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div className="navbar-brand-text">
          <span className="navbar-title">MailFlow</span>
          <span className="navbar-subtitle">Support Dashboard</span>
        </div>
      </div>

      {/* Page nav */}
      {navigate && (
        <div className="navbar-nav">
          <button
            className={`navbar-nav-btn ${page === 'inbox' ? 'navbar-nav-btn--active' : ''}`}
            onClick={() => navigate('inbox')}
          >
            Inbox
          </button>
          <button
            className={`navbar-nav-btn ${page === 'tickets' ? 'navbar-nav-btn--active' : ''}`}
            onClick={() => navigate('tickets')}
          >
            Tickets
          </button>
          <button
            className={`navbar-nav-btn ${page === 'analytics' ? 'navbar-nav-btn--active' : ''}`}
            onClick={() => navigate('analytics')}
          >
            Analytics
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="navbar-actions">

        {/* Compose button */}
        <button className="navbar-compose-btn" onClick={onCompose} title="Write a new email">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Compose
        </button>

        <button
          className={`navbar-refresh-btn ${loading ? 'navbar-refresh-btn--spinning' : ''}`}
          onClick={onRefresh}
          disabled={loading}
          title="Refresh emails"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
          {loading ? 'Loading…' : 'Refresh'}
        </button>

        {user && (
          <div className="navbar-user">
            {user.picture ? (
              <img src={user.picture} alt={user.name} className="user-avatar" referrerPolicy="no-referrer" />
            ) : (
              <div className="user-avatar-fallback">{user.name?.[0]?.toUpperCase()}</div>
            )}
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <span className="user-email">{user.email}</span>
            </div>
            <div className="user-menu">
              <button className="user-menu-btn" onClick={onSwitch}>Switch</button>
              <button className="user-menu-btn user-menu-btn--danger" onClick={onLogout}>Sign Out</button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
