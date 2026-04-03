import { useState, useEffect } from 'react';
import { useTickets }  from '../hooks/useTickets.js';
import TicketList      from '../components/tickets/TicketList.jsx';
import TicketDetail    from '../components/tickets/TicketDetail.jsx';
import Navbar          from '../components/Navbar.jsx';
import { apiFetch }    from '../api/client.js';
import './TicketsPage.css';

const STATUS_TABS = [
  { key: '',         label: 'All' },
  { key: 'new',      label: 'New' },
  { key: 'open',     label: 'Open' },
  { key: 'pending',  label: 'Pending' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed',   label: 'Closed' },
];

const CATEGORIES = [
  { value: '',            label: 'All categories' },
  { value: 'damage',      label: 'Damage' },
  { value: 'returns',     label: 'Returns' },
  { value: 'refund',      label: 'Refund' },
  { value: 'replacement', label: 'Replacement' },
  { value: 'delivery',    label: 'Delivery' },
  { value: 'general',     label: 'General' },
];

export default function TicketsPage({ auth, navigate }) {
  const ticketState = useTickets();
  const [members, setMembers]           = useState([]);
  const [showCreate, setShowCreate]     = useState(false);
  const [createForm, setCreateForm]     = useState({ customerEmail: '', subject: '', category: 'general' });
  const [createError, setCreateError]   = useState('');
  const [creating, setCreating]         = useState(false);

  // Load tickets and team members on mount
  useEffect(() => {
    ticketState.fetchTickets();
    apiFetch('/api/workspace/members')
      .then(d => setMembers(d.members || []))
      .catch(() => {});
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!createForm.customerEmail || !createForm.subject) {
      setCreateError('Email and subject are required');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      await ticketState.createTicket(createForm);
      setShowCreate(false);
      setCreateForm({ customerEmail: '', subject: '', category: 'general' });
      ticketState.fetchTickets();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="tickets-page">
      <Navbar
        user={auth.user}
        onLogout={auth.logout}
        onSwitch={auth.switchAccount}
        page="tickets"
        navigate={navigate}
      />

      <div className="tickets-body">
        {/* ── Left: Status sidebar ── */}
        <aside className="tickets-sidebar">
          <div className="tickets-sidebar-section">
            <div className="tickets-sidebar-label">Status</div>
            {STATUS_TABS.map(tab => (
              <button
                key={tab.key}
                className={`tickets-sidebar-tab ${ticketState.filters.status === tab.key ? 'tickets-sidebar-tab--active' : ''}`}
                onClick={() => ticketState.applyFilter({ status: tab.key })}
              >
                <span>{tab.label}</span>
                <span className="tickets-sidebar-count">
                  {tab.key === ''
                    ? ticketState.statusCounts.all
                    : (ticketState.statusCounts[tab.key] ?? 0)}
                </span>
              </button>
            ))}
          </div>

          <div className="tickets-sidebar-section">
            <div className="tickets-sidebar-label">Category</div>
            <select
              className="tickets-filter-select"
              value={ticketState.filters.category}
              onChange={e => ticketState.applyFilter({ category: e.target.value })}
            >
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="tickets-sidebar-section">
            <div className="tickets-sidebar-label">Assigned to</div>
            <select
              className="tickets-filter-select"
              onChange={e => ticketState.applyFilter({ assignedTo: e.target.value })}
            >
              <option value="">Anyone</option>
              {members.map(m => (
                <option key={m._id} value={m._id}>{m.name}</option>
              ))}
            </select>
          </div>

          <button className="tickets-create-btn" onClick={() => setShowCreate(true)}>
            + New Ticket
          </button>
        </aside>

        {/* ── Middle: Search + list ── */}
        <div className="tickets-list-panel">
          <div className="tickets-search-bar">
            <input
              type="text"
              placeholder="Search tickets…"
              className="tickets-search-input"
              value={ticketState.filters.search}
              onChange={e => ticketState.applyFilter({ search: e.target.value })}
            />
          </div>
          <TicketList
            tickets={ticketState.tickets}
            loading={ticketState.loading}
            error={ticketState.error}
            selectedId={ticketState.selectedTicket?._id}
            onSelect={ticketState.selectTicket}
          />
        </div>

        {/* ── Right: Ticket detail ── */}
        <TicketDetail
          key={ticketState.selectedTicket?._id}
          ticket={ticketState.selectedTicket}
          customerHistory={ticketState.customerHistory}
          members={members}
          onUpdateStatus={ticketState.updateStatus}
          onAssign={ticketState.assignTicket}
          onAddNote={ticketState.addNote}
          onSelectCustomerTicket={ticketState.selectTicket}
        />
      </div>

      {/* ── Create ticket modal ── */}
      {showCreate && (
        <div className="tickets-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="tickets-modal" onClick={e => e.stopPropagation()}>
            <h2 className="tickets-modal-title">New Ticket</h2>
            <form onSubmit={handleCreate}>
              <label className="tickets-modal-label">Customer Email</label>
              <input
                className="tickets-modal-input"
                type="email"
                placeholder="customer@example.com"
                value={createForm.customerEmail}
                onChange={e => setCreateForm(f => ({ ...f, customerEmail: e.target.value }))}
                required
              />
              <label className="tickets-modal-label">Subject</label>
              <input
                className="tickets-modal-input"
                type="text"
                placeholder="Describe the issue"
                value={createForm.subject}
                onChange={e => setCreateForm(f => ({ ...f, subject: e.target.value }))}
                required
              />
              <label className="tickets-modal-label">Category</label>
              <select
                className="tickets-modal-input"
                value={createForm.category}
                onChange={e => setCreateForm(f => ({ ...f, category: e.target.value }))}
              >
                {CATEGORIES.filter(c => c.value).map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              {createError && <p className="tickets-modal-error">{createError}</p>}
              <div className="tickets-modal-actions">
                <button type="button" className="tickets-modal-cancel" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className="tickets-modal-submit" disabled={creating}>
                  {creating ? 'Creating…' : 'Create Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
