import { memo } from 'react';
import { CAT_META } from '../lib/categories.js';
import './EmailRow.css';

const STATUS_META = {
  new:            { label: 'New',       color: '#3b82f6', bg: '#eff6ff' },
  open:           { label: 'Open',      color: '#f59e0b', bg: '#fffbeb' },
  awaiting_reply: { label: 'Awaiting',  color: '#8b5cf6', bg: '#faf5ff' },
  resolved:       { label: 'Resolved',  color: '#10b981', bg: '#f0fdf4' },
};

const PRIORITY_META = {
  urgent: { label: '!!!', color: '#dc2626' },
  high:   { label: '!!',  color: '#f97316' },
};

function formatDate(raw) {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d)) return raw.slice(0, 10);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
  if (now - d < 7 * 86400000)
    return d.toLocaleDateString('en', { weekday: 'short' });
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

function senderName(from) {
  if (!from) return 'Unknown';
  const m = from.match(/^"?([^"<]+)"?\s*</);
  return m ? m[1].trim() : from.split('@')[0];
}

/** How long ago — compact format */
function waitTime(dateStr) {
  if (!dateStr) return '';
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

const EmailRow = memo(function EmailRow({ email, isSelected, onClick, index = 0, isDone = false, status, priority }) {
  const cat = CAT_META[email.category] || CAT_META.general;
  const sMeta = STATUS_META[status] || STATUS_META.new;
  const pMeta = PRIORITY_META[priority];

  return (
    <div
      className={`email-row ${isSelected ? 'email-row--selected' : ''} ${!email.isRead ? 'email-row--unread' : ''} ${isDone || status === 'resolved' ? 'email-row--done' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      style={{
        '--cat-color': cat.color,
        '--cat-bg': cat.bg,
        animationDelay: `${index * 0.04}s`,
      }}
    >
      <div className="email-row-top">
        <span className="email-row-from">
          {pMeta && (
            <span className="email-row-priority" style={{ color: pMeta.color }} title={`${priority} priority`}>
              {pMeta.label}
            </span>
          )}
          {senderName(email.from)}
        </span>
        <span className="email-row-date">
          {status && status !== 'resolved' && (
            <span className="email-row-wait" title="Wait time">{waitTime(email.date)}</span>
          )}
          {formatDate(email.date)}
        </span>
      </div>

      <div className="email-row-subject">{email.subject}</div>

      <div className="email-row-bottom">
        <span className="email-row-snippet">{(email.snippet || '').slice(0, 65)}</span>
        <span className="email-row-badge" style={{ background: cat.bg, color: cat.color }}>
          {cat.label}
        </span>
        <span className="email-row-status-badge" style={{ background: sMeta.bg, color: sMeta.color }}>
          {sMeta.label}
        </span>
        {isDone && !status && (
          <span className="email-row-done-badge">Done</span>
        )}
      </div>
    </div>
  );
});

export default EmailRow;
