const STATUS_COLORS = {
  new:      '#3b82f6',
  open:     '#22c55e',
  pending:  '#f59e0b',
  resolved: '#8b5cf6',
  closed:   '#9ca3af',
};

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function CustomerHistory({ email, tickets, onSelect }) {
  if (!email) return null;

  return (
    <div className="customer-history">
      <div className="customer-history-header">
        <span className="customer-history-title">
          {tickets.length === 0
            ? `No other tickets from ${email}`
            : `${tickets.length} other ticket${tickets.length > 1 ? 's' : ''} from ${email}`}
        </span>
      </div>

      {tickets.length > 0 && (
        <div className="customer-history-list">
          {tickets.map(t => (
            <div
              key={t._id}
              className="customer-history-row"
              onClick={() => onSelect(t._id)}
            >
              <span className="customer-history-number">{t.ticketNumber}</span>
              <span className="customer-history-subject">{t.subject}</span>
              <span
                className="customer-history-status"
                style={{ color: STATUS_COLORS[t.status] || '#9ca3af' }}
              >
                {t.status}
              </span>
              <span className="customer-history-time">{relativeTime(t.lastMessageAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
