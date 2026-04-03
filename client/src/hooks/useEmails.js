import { useState, useEffect, useCallback, useMemo } from 'react';
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
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedId,     setSelectedId]     = useState(null); // store ID only
  const [callbackIds,    setCallbackIds]    = useState(new Set());
  const [callbackNotes,  setCallbackNotes]  = useState(new Map());
  const [doneIds,        setDoneIds]        = useState(new Set());
  const [bodyLoading,    setBodyLoading]    = useState(false);

  // Derive selected email fresh from emails array — avoids stale ref issues
  const selectedEmail = useMemo(
    () => emails.find(e => e.id === selectedId) || null,
    [emails, selectedId]
  );

  // Select email and lazily fetch its full body if not yet loaded
  const setSelectedEmail = useCallback(async (email) => {
    if (!email?.id) { setSelectedId(null); return; }
    setSelectedId(email.id);

    // Body already loaded — nothing to do
    if (email.body) return;

    // Fetch full body on demand
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
  }, []);

  const aiUpgradeCategories = useCallback(async (loadedEmails) => {
    if (!loadedEmails.length) return;
    try {
      // Limit to first 50 — keyword categories cover the rest,
      // and the Groq free tier is 6000 TPM (~4 batches of 25)
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
      // Silent — keyword categories already showing, AI upgrade is best-effort
    }
  }, []);

  // Load saved workflow statuses from MongoDB and apply to local state
  const loadSavedStatuses = useCallback(async (loadedEmails) => {
    try {
      const data = await apiFetch('/api/email-status');
      if (!data.statuses || Object.keys(data.statuses).length === 0) return;

      const newDoneIds     = new Set();
      const newCallbackIds = new Set();
      const newNotes       = new Map();
      const categoryOverrides = {};

      for (const [emailId, s] of Object.entries(data.statuses)) {
        if (s.status === 'done')  newDoneIds.add(emailId);
        if (s.needsCallback)      newCallbackIds.add(emailId);
        if (s.callbackNote)       newNotes.set(emailId, s.callbackNote);
        if (s.categoryOverride)   categoryOverrides[emailId] = s.categoryOverride;
      }

      setDoneIds(newDoneIds);
      setCallbackIds(newCallbackIds);
      setCallbackNotes(newNotes);

      // Apply category overrides to emails
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
      // Load saved statuses + AI upgrade — both non-blocking
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
      // AI upgrade for newly loaded emails
      aiUpgradeCategories(data.emails || []);
    } catch (err) {
      console.error('Load more error:', err.message);
    } finally {
      setLoadingMore(false);
    }
  }, [nextPageToken, loadingMore, aiUpgradeCategories]);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  // Auto-load remaining pages when on callbacks tab to find all flagged emails.
  // callbackIds in deps so this re-runs when loadSavedStatuses settles (it's async).
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
      // Persist to MongoDB
      saveStatus(id, { needsCallback: !wasSet });
      return next;
    });
  }, []);

  const toggleDone = useCallback((id) => {
    setDoneIds(prev => {
      const next = new Set(prev);
      const wasDone = next.has(id);
      wasDone ? next.delete(id) : next.add(id);
      // Persist to MongoDB
      saveStatus(id, { status: wasDone ? 'pending' : 'done' });
      return next;
    });
  }, []);

  const setCallbackNote = useCallback((id, note) => {
    setCallbackNotes(prev => {
      const next = new Map(prev);
      note.trim() ? next.set(id, note) : next.delete(id);
      return next;
    });
    // Debounce save — don't save on every keystroke
    clearTimeout(setCallbackNote._timer);
    setCallbackNote._timer = setTimeout(() => {
      saveStatus(id, { callbackNote: note.trim() });
    }, 800);
  }, []);

  // Recategorize — updates in emails array + persists override to MongoDB
  const recategorize = useCallback((id, newCategory) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, category: newCategory } : e));
    saveStatus(id, { categoryOverride: newCategory });
  }, []);

  const filtered = useMemo(() => {
    if (activeCategory === 'callbacks')  return emails.filter(e => callbackIds.has(e.id));
    if (activeCategory === 'done')       return emails.filter(e => doneIds.has(e.id));
    if (activeCategory === 'pending')    return emails.filter(e => !doneIds.has(e.id));
    if (activeCategory === 'today')      return emails.filter(e => dateGroup(e.date) === 'today');
    if (activeCategory === 'yesterday')  return emails.filter(e => dateGroup(e.date) === 'yesterday');
    if (activeCategory === 'older')      return emails.filter(e => dateGroup(e.date) === 'older');
    if (activeCategory === 'all')        return emails;
    return emails.filter(e => e.category === activeCategory);
  }, [activeCategory, emails, callbackIds, doneIds]);

  const counts = useMemo(() => {
    const acc = CATEGORIES.reduce((a, cat) => {
      a[cat.id] = cat.id === 'all'
        ? emails.length
        : emails.filter(e => e.category === cat.id).length;
      return a;
    }, {});
    acc.callbacks  = emails.filter(e => callbackIds.has(e.id)).length;
    acc.done       = emails.filter(e => doneIds.has(e.id)).length;
    acc.pending    = emails.filter(e => !doneIds.has(e.id)).length;
    acc.today      = emails.filter(e => dateGroup(e.date) === 'today').length;
    acc.yesterday  = emails.filter(e => dateGroup(e.date) === 'yesterday').length;
    acc.older      = emails.filter(e => dateGroup(e.date) === 'older').length;
    return acc;
  }, [emails, callbackIds, doneIds]);

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
  };
}
