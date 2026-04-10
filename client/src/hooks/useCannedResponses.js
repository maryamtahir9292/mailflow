import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client.js';

export function useCannedResponses() {
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/canned-responses');
      setResponses(data.responses || []);
    } catch {
      // Silent — templates are optional
    } finally {
      setLoading(false);
    }
  }, []);

  const seed = useCallback(async () => {
    try {
      await apiFetch('/api/canned-responses/seed', { method: 'POST' });
      await fetch();
    } catch { /* silent */ }
  }, [fetch]);

  const create = useCallback(async (template) => {
    try {
      const data = await apiFetch('/api/canned-responses', {
        method: 'POST',
        body: JSON.stringify(template),
      });
      setResponses(prev => [data.response, ...prev]);
      return data.response;
    } catch (err) {
      throw err;
    }
  }, []);

  const update = useCallback(async (id, template) => {
    try {
      const data = await apiFetch(`/api/canned-responses/${id}`, {
        method: 'PUT',
        body: JSON.stringify(template),
      });
      setResponses(prev => prev.map(r => r._id === id ? data.response : r));
      return data.response;
    } catch (err) {
      throw err;
    }
  }, []);

  const remove = useCallback(async (id) => {
    try {
      await apiFetch(`/api/canned-responses/${id}`, { method: 'DELETE' });
      setResponses(prev => prev.filter(r => r._id !== id));
    } catch { /* silent */ }
  }, []);

  const use = useCallback(async (id, variables = {}) => {
    try {
      const data = await apiFetch(`/api/canned-responses/${id}/use`, {
        method: 'POST',
        body: JSON.stringify({ variables }),
      });
      // Update usage count locally
      setResponses(prev => prev.map(r =>
        r._id === id ? { ...r, usageCount: (r.usageCount || 0) + 1 } : r
      ));
      return data.text;
    } catch (err) {
      throw err;
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { responses, loading, refetch: fetch, seed, create, update, remove, use };
}
