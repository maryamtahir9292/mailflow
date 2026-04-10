import { useState, useRef, useEffect } from 'react';
import './NotificationBell.css';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function NotificationBell({ notifications = [], unreadCount = 0, onMarkRead, soundEnabled, onToggleSound, permissionState, onRequestPermission }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const unreadNotifs = notifications.filter(n => !n.read).length;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleOpen = () => {
    setOpen(!open);
    if (!open && unreadNotifs > 0) onMarkRead?.();
  };

  return (
    <div className="notif-bell-wrap" ref={ref}>
      <button className="notif-bell-btn" onClick={handleOpen} title={`${unreadCount} unread emails`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        {(unreadNotifs > 0 || unreadCount > 0) && (
          <span className="notif-badge">{unreadNotifs || unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <span className="notif-title">Notifications</span>
            <div className="notif-actions">
              <button
                className={`notif-sound-btn ${soundEnabled ? '' : 'notif-sound-btn--off'}`}
                onClick={() => onToggleSound?.(!soundEnabled)}
                title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
              >
                {soundEnabled ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                )}
              </button>
              {permissionState !== 'granted' && (
                <button className="notif-enable-btn" onClick={onRequestPermission} title="Enable desktop notifications">
                  Enable alerts
                </button>
              )}
            </div>
          </div>

          <div className="notif-list">
            {notifications.length === 0 ? (
              <div className="notif-empty">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
                <span>No notifications yet</span>
                <span className="notif-empty-sub">New emails will appear here</span>
              </div>
            ) : (
              notifications.map((n, i) => (
                <div className={`notif-item ${n.read ? '' : 'notif-item--unread'}`} key={n.id || i}>
                  <div className="notif-item-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>
                  </div>
                  <div className="notif-item-body">
                    <span className="notif-item-title">{n.title || 'New email'}</span>
                    <span className="notif-item-msg">{(n.message || '').slice(0, 60)}{(n.message || '').length > 60 ? '...' : ''}</span>
                  </div>
                  <span className="notif-item-time">{timeAgo(n.createdAt)}</span>
                  {!n.read && <span className="notif-item-dot" />}
                </div>
              ))
            )}
          </div>

          {unreadCount > 0 && (
            <div className="notif-footer">
              {unreadCount} unread email{unreadCount !== 1 ? 's' : ''} in Gmail
            </div>
          )}
        </div>
      )}
    </div>
  );
}
