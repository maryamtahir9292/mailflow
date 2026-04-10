import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { apiFetch } from '../api/client.js';
import { CATEGORIES } from '../lib/categories.js';
export { CATEGORIES }; // re-export so Sidebar can still import from here

/** Returns 'today' | 'yesterday' | 'older' for a raw email date string */
function dateGroup(dateStr) {
  if (!dateStr) return 'older';
  const d = new Date(dateStr);
  if (isNaN(d)) return 'older';
  const now        = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yestStart  = new Date(todayStart);
  yestStart.setDate(yestStart.getDate() - 1);
  const emailDay   = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (emailDay >= todayStart) return 'today';
  if (emailDay >= yestStart)  return 'yesterday';
  return 'older';
}

/** Pipeline status metadata */
export const PIPELINE_STATUSES = {
  new:             { label: 'New',             color: '#3b82f6', bg: '#eff6ff', icon: 'inbox' },
  open:            { label: 'Open',            color: '#f59e0b', bg: '#fffbeb', icon: 'folder-open' },
  awaiting_reply:  { label: 'Awaiting Reply',  color: '#8b5cf6', bg: '#faf5ff', icon: 'clock' },
  resolved:        { label: 'Resolved',        color: '#10b981', bg: '#f0fdf4', icon: 'check' },
};

/** Smart sort — prioritize what needs attention most */
function smartSort(emails, statusMap, callbackIds) {
  return [...emails].sort((a, b) => {
    const sa = statusMap.get(a.id) || {};
    const sb = statusMap.get(b.id) || {};

    // 1. Priority weight: urgent=0, high=1, normal=2, low=3
    const prioOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    const pa = prioOrder[sa.priority] ?? 2;
    const pb = prioOrder[sb.priority] ?? 2;
    if (pa !== pb) return pa - pb;

    // 2. Callbacks float to top
    const aCb = callbackIds.has(a.id) ? 0 : 1;
    const bCb = callbackIds.has(b.id) ? 0 : 1;
    if (aCb !== bCb) return aCb - bCb;

    // 3. Status order: new first, then open, then awaiting
    const statusOrder = { new: 0, open: 1, awaiting_reply: 2, pending: 1, resolved: 3, done: 3 };
    const soa = statusOrder[sa.status] ?? 0;
    const sob = statusOrder[sb.status] ?? 0;
    if (soa !== sob) return soa - sob;

    // 4. Oldest unanswered first (longest wait = highest urgency)
    const da = new Date(a.date).getTime() || 0;
    const db = new Date(b.date).getTime() || 0;
    return da - db; // older first within same priority
  });
}

// Helper — save status to backend (fire-and-forget, non-blocking)
function saveStatus(emailId, updates) {
  apiFetch(`/api/email-status/${emailId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  }).catch(() => { /* silent — local state is already updated */ });
}

export function useEmails(loggedIn) {
  const [emails,         setEmails]         = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [loadingMore,    setLoadingMore]    = useState(false);
  const [error,          setError]          = useState(null);
  const [nextPageToken,  setNextPageToken]  = useState(null);
  const [activeCategory, setActiveCategory] = useState('queue');  // default to smart queue
  const [selectedId,     setSelectedId]     = useState(null);
  const [callbackIds,    setCallbackIds]    = useState(new Set());
  const [callbackNotes,  setCallbackNotes]  = useState(new Map());
  const [doneIds,        setDoneIds]        = useState(new Set());
  const [statusMap,      setStatusMap]      = useState(new Map()); // emailId -> { status, priority, ... }
  const [bodyLoading,    setBodyLoading]    = useState(false);
  const callbackNoteTimer = useRef(null);

  // Derive selected email fresh from emails array
  const selectedEmail = useMemo(
    () => emails.find(e => e.id === selectedId) || null,
    [emails, selectedId]
  );

  // Select email and lazily fetch its full body
  const setSelectedEmail = useCallback(async (email) => {
    if (!email?.id) { setSelectedId(null); return; }
    setSelectedId(email.id);

    // Auto-transition: new -> open when agent opens an email
    const s = statusMap.get(email.id);
    if (!s || s.status === 'new') {
      setStatusMap(prev => {
        const next = new Map(prev);
        next.set(email.id, { ...(next.get(email.id) || {}), status: 'open' });
        return next;
      });
      saveStatus(email.id, { status: 'open' });
    }

    if (email.body) return;
    setBodyLoading(true);
    try {
      const data = await apiFetch(`/api/emails/${email.id}`);
      setEmails(prev => prev.map(e =>
        e.id === email.id ? { ...e, body: data.body || '' } : e
      ));
    } catch (err) {
      console.warn('Failed to load email body:', err.message);
    } finally {
      setBodyLoading(false);
    }
  }, [statusMap]);

  const aiUpgradeCategories = useCallback(async (loadedEmails) => {
    if (!loadedEmails.length) return;
    try {
      const payload = loadedEmails.slice(0, 50).map(e => ({
        id: e.id, subject: e.subject, body: e.body, snippet: e.snippet,
      }));
      const data = await apiFetch('/api/emails/categorize', {
        method: 'POST',
        body: JSON.stringify({ emails: payload }),
      });
      if (data.categories && Object.keys(data.categories).length > 0) {
        setEmails(prev => prev.map(e =>
          data.categories[e.id] ? { ...e, category: data.categories[e.id] } : e
        ));
      }
    } catch {
      // Silent — keyword categories already showing
    }
  }, []);

  // Load saved workflow statuses from MongoDB
  const loadSavedStatuses = useCallback(async (loadedEmails) => {
    try {
      const data = await apiFetch('/api/email-status');
      if (!data.statuses || Object.keys(data.statuses).length === 0) {
        // Initialize all loaded emails as 'new' in bulk
        const ids = loadedEmails.map(e => e.id);
        apiFetch('/api/email-status/bulk-init', {
          method: 'POST',
          body: JSON.stringify({ emailIds: ids }),
        }).catch(() => {});
        return;
      }

      const newDoneIds     = new Set();
      const newCallbackIds = new Set();
      const newNotes       = new Map();
      const newStatusMap   = new Map();
      const categoryOverrides = {};

      for (const [emailId, s] of Object.entries(data.statuses)) {
        // Map old statuses to new pipeline
        let mappedStatus = s.status;
        if (mappedStatus === 'done') mappedStatus = 'resolved';
        if (mappedStatus === 'pending') mappedStatus = 'new';

        newStatusMap.set(emailId, {
          status:        mappedStatus,
          priority:      s.priority || 'normal',
          lastRepliedAt: s.lastRepliedAt,
          replyCount:    s.replyCount || 0,
        });

        if (mappedStatus === 'resolved' || s.status === 'done') newDoneIds.add(emailId);
        if (s.needsCallback)      newCallbackIds.add(emailId);
        if (s.callbackNote)       newNotes.set(emailId, s.callbackNote);
        if (s.categoryOverride)   categoryOverrides[emailId] = s.categoryOverride;
      }

      setStatusMap(newStatusMap);
      setDoneIds(newDoneIds);
      setCallbackIds(newCallbackIds);
      setCallbackNotes(newNotes);

      // Initialize emails without status
      const missingIds = loadedEmails
        .filter(e => !data.statuses[e.id])
        .map(e => e.id);
      if (missingIds.length > 0) {
        apiFetch('/api/email-status/bulk-init', {
          method: 'POST',
          body: JSON.stringify({ emailIds: missingIds }),
        }).catch(() => {});
        // Set local state for missing
        missingIds.forEach(id => {
          newStatusMap.set(id, { status: 'new', priority: 'normal', replyCount: 0 });
        });
        setStatusMap(new Map(newStatusMap));
      }

      if (Object.keys(categoryOverrides).length > 0) {
        setEmails(prev => prev.map(e =>
          categoryOverrides[e.id] ? { ...e, category: categoryOverrides[e.id] } : e
        ));
      }
    } catch {
      // Silent — app works fine without saved statuses
    }
  }, []);

  const fetchEmails = useCallback(async () => {
    if (!loggedIn) return;
    setLoading(true);
    setError(null);
    setEmails([]);
    setNextPageToken(null);
    setSelectedId(null);
    try {
      const data = await apiFetch('/api/emails');
      const loaded = data.emails || [];
      setEmails(loaded);
      setNextPageToken(data.nextPageToken || null);
      loadSavedStatuses(loaded);
      aiUpgradeCategories(loaded);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [loggedIn, aiUpgradeCategories, loadSavedStatuses]);

  const loadMore = useCallback(async () => {
    if (!nextPageToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await apiFetch(`/api/emails?pageToken=${nextPageToken}`);
      let newEmails = [];
      setEmails(prev => {
        const ids = new Set(prev.map(e => e.id));
        newEmails = (data.emails || []).filter(e => !ids.has(e.id));
        return [...prev, ...newEmails];
      });
      setNextPageToken(data.nextPageToken || null);
      aiUpgradeCategories(data.emails || []);
    } catch (err) {
      console.error('Load more error:', err.message);
    } finally {
      setLoadingMore(false);
    }
  }, [nextPageToken, loadingMore, aiUpgradeCategories]);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  useEffect(() => {
    if (activeCategory === 'callbacks' && !loading && !loadingMore && nextPageToken) {
      loadMore();
    }
  }, [activeCategory, nextPageToken, loading, loadingMore, loadMore, callbackIds]);

  const toggleCallback = useCallback((id) => {
    setCallbackIds(prev => {
      const next = new Set(prev);
      const wasSet = next.has(id);
      wasSet ? next.delete(id) : next.add(id);
      saveStatus(id, { needsCallback: !wasSet });
      return next;
    });
  }, []);

  // Update pipeline status
  const setEmailStatus = useCallback((id, newStatus) => {
    setStatusMap(prev => {
      const next = new Map(prev);
      next.set(id, { ...(next.get(id) || {}), status: newStatus });
      return next;
    });
    // Sync doneIds for backward compat
    if (newStatus === 'resolved') {
      setDoneIds(prev => new Set(prev).add(id));
    } else {
      setDoneIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
    saveStatus(id, { status: newStatus });
  }, []);

  // Set priority
  const setEmailPriority = useCallback((id, priority) => {
    setStatusMap(prev => {
      const next = new Map(prev);
      next.set(id, { ...(next.get(id) || {}), priority });
      return next;
    });
    saveStatus(id, { priority });
  }, []);

  // Mark as replied — auto-transition to awaiting_reply
  const markReplied = useCallback((id) => {
    setStatusMap(prev => {
      const next = new Map(prev);
      const current = next.get(id) || {};
      next.set(id, {
        ...current,
        status: 'awaiting_reply',
        lastRepliedAt: new Date().toISOString(),
        replyCount: (current.replyCount || 0) + 1,
      });
      return next;
    });
    apiFetch(`/api/email-status/${id}/replied`, { method: 'POST' })
      .catch(() => {});
  }, []);

  // Legacy toggleDone — maps to resolved/new
  const toggleDone = useCallback((id) => {
    const current = statusMap.get(id);
    const isResolved = current?.status === 'resolved';
    setEmailStatus(id, isResolved ? 'open' : 'resolved');
  }, [statusMap, setEmailStatus]);

  const setCallbackNote = useCallback((id, note) => {
    setCallbackNotes(prev => {
      const next = new Map(prev);
      note.trim() ? next.set(id, note) : next.delete(id);
      return next;
    });
    clearTimeout(callbackNoteTimer.current);
    callbackNoteTimer.current = setTimeout(() => {
      saveStatus(id, { callbackNote: note.trim() });
    }, 800);
  }, []);

  const recategorize = useCallback((id, newCategory) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, category: newCategory } : e));
    saveStatus(id, { categoryOverride: newCategory });
  }, []);

  // Filtered & sorted emails
  const filtered = useMemo(() => {
    let result;

    if (activeCategory === 'queue') {
      // Smart queue: show everything except resolved, smart-sorted
      result = emails.filter(e => {
        const s = statusMap.get(e.id);
        return !s || (s.status !== 'resolved');
      });
      return smartSort(result, statusMap, callbackIds);
    }
    if (activeCategory === 'new')             return emails.filter(e => { const s = statusMap.get(e.id); return !s || s.status === 'new'; });
    if (activeCategory === 'open')            return emails.filter(e => statusMap.get(e.id)?.status === 'open');
    if (activeCategory === 'awaiting_reply')  return emails.filter(e => statusMap.get(e.id)?.status === 'awaiting_reply');
    if (activeCategory === 'resolved')        return emails.filter(e => statusMap.get(e.id)?.status === 'resolved' || doneIds.has(e.id));
    if (activeCategory === 'callbacks')       return emails.filter(e => callbackIds.has(e.id));
    if (activeCategory === 'done')            return emails.filter(e => doneIds.has(e.id));
    if (activeCategory === 'pending')         return emails.filter(e => !doneIds.has(e.id));
    if (activeCategory === 'today')           return emails.filter(e => dateGroup(e.date) === 'today');
    if (activeCategory === 'yesterday')       return emails.filter(e => dateGroup(e.date) === 'yesterday');
    if (activeCategory === 'older')           return emails.filter(e => dateGroup(e.date) === 'older');
    if (activeCategory === 'all')             return emails;
    return emails.filter(e => e.category === activeCategory);
  }, [activeCategory, emails, callbackIds, doneIds, statusMap]);

  const counts = useMemo(() => {
    const acc = CATEGORIES.reduce((a, cat) => {
      a[cat.id] = cat.id === 'all'
        ? emails.length
        : emails.filter(e => e.category === cat.id).length;
      return a;
    }, {});

    // Pipeline counts
    let newCount = 0, openCount = 0, awaitingCount = 0, resolvedCount = 0;
    for (const e of emails) {
      const s = statusMap.get(e.id);
      const status = s?.status || 'new';
      if (status === 'new')             newCount++;
      else if (status === 'open')       openCount++;
      else if (status === 'awaiting_reply') awaitingCount++;
      else if (status === 'resolved' || status === 'done') resolvedCount++;
      else newCount++; // fallback for 'pending'
    }
    acc.queue           = newCount + openCount + awaitingCount; // actionable items
    acc.new_status      = newCount;
    acc.open            = openCount;
    acc.awaiting_reply  = awaitingCount;
    acc.resolved        = resolvedCount;

    acc.callbacks  = emails.filter(e => callbackIds.has(e.id)).length;
    acc.done       = emails.filter(e => doneIds.has(e.id)).length;
    acc.pending    = emails.filter(e => !doneIds.has(e.id)).length;
    acc.today      = emails.filter(e => dateGroup(e.date) === 'today').length;
    acc.yesterday  = emails.filter(e => dateGroup(e.date) === 'yesterday').length;
    acc.older      = emails.filter(e => dateGroup(e.date) === 'older').length;
    return acc;
  }, [emails, callbackIds, doneIds, statusMap]);

  return {
    emails, filtered, loading, loadingMore, error,
    nextPageToken, loadMore,
    activeCategory, setActiveCategory,
    selectedEmail, setSelectedEmail, bodyLoading,
    counts, refetch: fetchEmails,
    recategorize,
    callbackIds, toggleCallback,
    callbackNotes, setCallbackNote,
    doneIds, toggleDone,
    // New pipeline features
    statusMap, setEmailStatus, setEmailPriority, markReplied,
  };
}
