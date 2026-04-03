import TicketRow from './TicketRow.jsx';
import Spinner   from '../Spinner.jsx';

export default function TicketList({ tickets, loading, error, selectedId, onSelect }) {
  if (loading) {
    return (
      <div className="ticket-list ticket-list--center">
        <Spinner size={28} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="ticket-list ticket-list--center">
        <p style={{ color: '#ef4444', fontSize: 14 }}>{error}</p>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="ticket-list ticket-list--center">
        <p style={{ color: '#9ca3af', fontSize: 14 }}>No tickets found</p>
      </div>
    );
  }

  return (
    <div className="ticket-list">
      {tickets.map(ticket => (
        <TicketRow
          key={ticket._id}
          ticket={ticket}
          selected={ticket._id === selectedId}
          onClick={onSelect}
        />
      ))}
    </div>
  );
}
