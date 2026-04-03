import { useState, useEffect } from 'react';
import CustomerHistory from './CustomerHistory.jsx';
import { CAT_META } from '../../lib/categories.js';

const STATUSES   = ['new', 'open', 'pending', 'resolved', 'closed'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const STATUS_COLORS = {
  new:      { bg: '#eff6ff', text: '#1d4ed8' },
  open:     { bg: '#f0fdf4', text: '#15803d' },
  pending:  { bg: '#fffbeb', text: '#b45309' },
  resolved: { bg: '#f5f3ff', text: '#6d28d9' },
  closed:   { bg: '#f9fafb', text: '#6b7280' },
};

const PRIORITY_COLORS = {
  low:    '#6b7280',
  medium: '#f59e0b',
  high:   '#ef4444',
  urgent: '#7c3aed',
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString();
}

function ActivityEntry({ entry }) {
  const by = entry.by?.name || 'System';
  const at = formatDate(entry.at);

  let text = '';
  switch (entry.type) {
    case 'created':       text = `Ticket created`; break;
    case 'status_changed': text = `Status changed from "${entry.from}" to "${entry.to}"`; break;
    case 'assigned':      text = entry.note || `Assignment changed`; break;
    case 'note':          text = null; break;
    case 'replied':       text = 'Reply sent to customer'; break;
    default:              text = entry.note || entry.type;
  }

  return (
    <div className={`activity-entry activity-entry--${entry.type}`}>
      <div className="activity-entry-meta">
        <span className="activity-entry-by">{by}</span>
        <span className="activity-entry-at">{at}</span>
      </div>
      {entry.type === 'note' ? (
        <div className="activity-entry-note">{entry.note}</div>
      ) : (
        <div className="activity-entry-text">{text}</div>
      )}
    </div>
  );
}

function MessageBubble({ message }) {
  const isOutbound = message.direction === 'outbound';
  return (
    <div className={`message-bubble message-bubble--${isOutbound ? 'outbound' : 'inbound'}`}>
      <div className="message-bubble-meta">
        <span className="message-bubble-from">{message.from}</span>
        <span className="message-bubble-date">{formatDate(message.date)}</span>
      </div>
      <div className="message-bubble-body">{message.body || message.snippet}</div>
    </div>
  );
}

export default function TicketDetail({
  ticket,
  customerHistory,
  members,
  onUpdateStatus,
  onAssign,
  onAddNote,
  onSelectCustomerTicket,
}) {
  const [noteText, setNoteText]   = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Reset note when ticket changes
  useEffect(() => { setNoteText(''); }, [ticket?._id]);

  if (!ticket) {
    return (
      <div className="ticket-detail ticket-detail--empty">
        <p>Select a ticket to view details</p>
      </div>
    );
  }

  const cat    = CAT_META[ticket.category] || CAT_META.general;
  const status = STATUS_COLORS[ticket.status] || STATUS_COLORS.new;

  async function handleSaveNote() {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await onAddNote(ticket._id, noteText);
      setNoteText('');
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <div className="ticket-detail">
      {/* ── Header ── */}
      <div className="ticket-detail-header">
        <div className="ticket-detail-title-row">
          <span className="ticket-detail-number">{ticket.ticketNumber}</span>
          <span className="ticket-badge" style={{ background: cat.bg, color: cat.text }}>
            {cat.label}
          </span>
          <span
            className="ticket-badge"
            style={{ background: PRIORITY_COLORS[ticket.priority] + '22', color: PRIORITY_COLORS[ticket.priority] }}
          >
            {ticket.priority}
          </span>
        </div>
        <div className="ticket-detail-subject">{ticket.subject}</div>
        <div className="ticket-detail-customer">{ticket.customerEmail}</div>

        <div className="ticket-detail-controls">
          {/* Status selector */}
          <select
            className="ticket-control-select"
            value={ticket.status}
            style={{ background: status.bg, color: status.text }}
            onChange={e => onUpdateStatus(ticket._id, e.target.value)}
          >
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Assignee selector */}
          <select
            className="ticket-control-select"
            value={ticket.assignedTo?._id || ticket.assignedTo || ''}
            onChange={e => onAssign(ticket._id, e.target.value || null)}
          >
            <option value="">Unassigned</option>
            {(members || []).map(m => (
              <option key={m._id} value={m._id}>{m.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="ticket-detail-body">
        {/* ── Conversation ── */}
        <section className="ticket-section">
          <h3 className="ticket-section-title">Conversation ({ticket.messages?.length || 0})</h3>
          <div className="ticket-messages">
            {(ticket.messages || []).map((msg, i) => (
              <MessageBubble key={msg.gmailMessageId || i} message={msg} />
            ))}
            {(!ticket.messages || ticket.messages.length === 0) && (
              <p style={{ color: '#9ca3af', fontSize: 13 }}>No messages yet</p>
            )}
          </div>
        </section>

        {/* ── Customer history ── */}
        <section className="ticket-section">
          <h3 className="ticket-section-title">Customer History</h3>
          <CustomerHistory
            email={ticket.customerEmail}
            tickets={customerHistory}
            onSelect={onSelectCustomerTicket}
          />
        </section>

        {/* ── Activity log ── */}
        <section className="ticket-section">
          <h3 className="ticket-section-title">Activity Log</h3>
          <div className="activity-log">
            {(ticket.activity || []).map((entry, i) => (
              <ActivityEntry key={i} entry={entry} />
            ))}
            {(!ticket.activity || ticket.activity.length === 0) && (
              <p style={{ color: '#9ca3af', fontSize: 13 }}>No activity yet</p>
            )}
          </div>
        </section>

        {/* ── Add note ── */}
        <section className="ticket-section ticket-section--note">
          <h3 className="ticket-section-title">Add Internal Note</h3>
          <textarea
            className="ticket-note-input"
            placeholder="Write a private note (not sent to customer)…"
            value={noteText}
            rows={3}
            onChange={e => setNoteText(e.target.value)}
          />
          <button
            className="ticket-note-save-btn"
            disabled={!noteText.trim() || savingNote}
            onClick={handleSaveNote}
          >
            {savingNote ? 'Saving…' : 'Save Note'}
          </button>
        </section>
      </div>
    </div>
  );
}
