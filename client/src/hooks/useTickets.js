import { useState, useCallback, useRef } from 'react';
import { apiFetch } from '../api/client.js';

export function useTickets() {
  const [tickets, setTickets]               = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState(null);
  const [statusCounts, setStatusCounts]     = useState({ all: 0, new: 0, open: 0, pending: 0, resolved: 0, closed: 0 });
  const [filters, setFilters]               = useState({ status: '', category: '', search: '' });
  const [customerHistory, setCustomerHistory] = useState([]);

  const abortRef = useRef(null);

  const fetchTickets = useCallback(async (overrideFilters) => {
    const active = overrideFilters ?? filters;
    setLoading(true);
    setError(null);

    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    try {
      const params = new URLSearchParams();
      if (active.status)   params.set('status',   active.status);
      if (active.category) params.set('category', active.category);
      if (active.search)   params.set('search',   active.search);

      const data = await apiFetch(`/api/tickets?${params}`);
      setTickets(data.tickets || []);
      setStatusCounts(data.statusCounts || {});
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const selectTicket = useCallback(async (idOrNull) => {
    if (!idOrNull) { setSelectedTicket(null); return; }
    try {
      const data = await apiFetch(`/api/tickets/${idOrNull}`);
      setSelectedTicket(data.ticket);
      // Also refresh customer history for this ticket's customer
      if (data.ticket?.customerEmail) {
        fetchCustomerHistory(data.ticket.customerEmail, data.ticket._id);
      }
    } catch (err) {
      console.error('selectTicket error:', err.message);
    }
  }, []);

  const fetchCustomerHistory = useCallback(async (email, excludeId) => {
    try {
      const data = await apiFetch(`/api/tickets/customer/${encodeURIComponent(email)}`);
      const others = (data.tickets || []).filter(t => t._id !== excludeId);
      setCustomerHistory(others);
    } catch (err) {
      console.error('fetchCustomerHistory error:', err.message);
    }
  }, []);

  const updateStatus = useCallback(async (id, status) => {
    try {
      const data = await apiFetch(`/api/tickets/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      // Update in list and selected
      setTickets(prev => prev.map(t => t._id === id ? { ...t, status: data.ticket.status } : t));
      setSelectedTicket(prev => prev?._id === id ? { ...prev, ...data.ticket } : prev);
      setStatusCounts(prev => ({ ...prev })); // trigger re-fetch on next load
    } catch (err) {
      console.error('updateStatus error:', err.message);
      throw err;
    }
  }, []);

  const assignTicket = useCallback(async (id, userId) => {
    try {
      const data = await apiFetch(`/api/tickets/${id}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ userId }),
      });
      setTickets(prev => prev.map(t => t._id === id ? { ...t, assignedTo: data.ticket.assignedTo } : t));
      setSelectedTicket(prev => prev?._id === id ? { ...prev, ...data.ticket } : prev);
    } catch (err) {
      console.error('assignTicket error:', err.message);
      throw err;
    }
  }, []);

  const addNote = useCallback(async (id, note) => {
    try {
      const data = await apiFetch(`/api/tickets/${id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      });
      setSelectedTicket(prev => prev?._id === id ? { ...prev, activity: data.ticket.activity } : prev);
    } catch (err) {
      console.error('addNote error:', err.message);
      throw err;
    }
  }, []);

  const createTicket = useCallback(async (payload) => {
    const data = await apiFetch('/api/tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setTickets(prev => [data.ticket, ...prev]);
    return data.ticket;
  }, []);

  const applyFilter = useCallback((updates) => {
    const next = { ...filters, ...updates };
    setFilters(next);
    fetchTickets(next);
  }, [filters, fetchTickets]);

  return {
    tickets,
    selectedTicket,
    loading,
    error,
    statusCounts,
    filters,
    customerHistory,
    fetchTickets,
    selectTicket,
    updateStatus,
    assignTicket,
    addNote,
    createTicket,
    applyFilter,
    fetchCustomerHistory,
  };
}
