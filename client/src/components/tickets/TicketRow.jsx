import { CAT_META } from '../../lib/categories.js';

const STATUS_COLORS = {
  new:      { bg: '#eff6ff', text: '#1d4ed8', dot: '#3b82f6' },
  open:     { bg: '#f0fdf4', text: '#15803d', dot: '#22c55e' },
  pending:  { bg: '#fffbeb', text: '#b45309', dot: '#f59e0b' },
  resolved: { bg: '#f5f3ff', text: '#6d28d9', dot: '#8b5cf6' },
  closed:   { bg: '#f9fafb', text: '#6b7280', dot: '#9ca3af' },
};

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function TicketRow({ ticket, selected, onClick }) {
  const cat    = CAT_META[ticket.category] || CAT_META.general;
  const status = STATUS_COLORS[ticket.status] || STATUS_COLORS.new;

  return (
    <div
      className={`ticket-row ${selected ? 'ticket-row--selected' : ''}`}
      onClick={() => onClick(ticket._id)}
    >
      <div className="ticket-row-header">
        <span className="ticket-row-number">{ticket.ticketNumber}</span>
        <span className="ticket-row-time">{relativeTime(ticket.lastMessageAt)}</span>
      </div>

      <div className="ticket-row-subject">{ticket.subject}</div>
      <div className="ticket-row-customer">{ticket.customerEmail}</div>

      <div className="ticket-row-badges">
        <span className="ticket-badge" style={{ background: cat.bg, color: cat.text }}>
          {cat.label}
        </span>
        <span className="ticket-badge ticket-status-badge" style={{ background: status.bg, color: status.text }}>
          <span className="ticket-status-dot" style={{ background: status.dot }} />
          {ticket.status}
        </span>
      </div>
    </div>
  );
}
