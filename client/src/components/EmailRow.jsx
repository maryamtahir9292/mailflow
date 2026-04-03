import { memo } from 'react';
import { CAT_META } from '../lib/categories.js';
import './EmailRow.css';

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

const EmailRow = memo(function EmailRow({ email, isSelected, onClick, index = 0, isDone = false }) {
  const cat = CAT_META[email.category] || CAT_META.general;

  return (
    <div
      className={`email-row ${isSelected ? 'email-row--selected' : ''} ${!email.isRead ? 'email-row--unread' : ''} ${isDone ? 'email-row--done' : ''}`}
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
        <span className="email-row-from">{senderName(email.from)}</span>
        <span className="email-row-date">{formatDate(email.date)}</span>
      </div>

      <div className="email-row-subject">{email.subject}</div>

      <div className="email-row-bottom">
        <span className="email-row-snippet">{(email.snippet || '').slice(0, 65)}</span>
        <span className="email-row-badge" style={{ background: cat.bg, color: cat.color }}>
          {cat.label}
        </span>
        {isDone && (
          <span className="email-row-done-badge">✓ Done</span>
        )}
      </div>
    </div>
  );
});

export default EmailRow;
