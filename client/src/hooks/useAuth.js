import { useState, useEffect, useCallback } from 'react';
import { apiFetch, tokenStore } from '../api/client.js';

const API_BASE = import.meta.env.VITE_API_URL || '';

// After OAuth callback the server redirects to /#t=<JWT>.
// This function extracts the token from the hash, stores it in localStorage,
// and cleans the hash from the URL — all before the first API call.
function extractHashToken() {
  const hash = window.location.hash;
  if (hash.startsWith('#t=')) {
    const token = decodeURIComponent(hash.slice(3));
    tokenStore.set(token);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    console.log('[auth] session token extracted from URL hash');
    return true;
  }
  return false;
}

export function useAuth() {
  const [state, setState] = useState({ loading: true, loggedIn: false, user: null });

  const refetch = useCallback(async () => {
    try {
      const data = await apiFetch('/auth/status');
      setState({ loading: false, loggedIn: data.loggedIn, user: data.user, offline: false });
    } catch (err) {
      const offline = err.message === 'Failed to fetch' || err.message?.includes('NetworkError');
      setState({ loading: false, loggedIn: false, user: null, offline });
    }
  }, []);

  useEffect(() => {
    // Extract hash token synchronously first, THEN fetch status
    // so the Bearer token is in localStorage before the request fires
    extractHashToken();
    refetch();
  }, [refetch]);

  const login         = () => { window.location.href = `${API_BASE}/auth/google`; };
  const switchAccount = () => { window.location.href = `${API_BASE}/auth/switch`; };
  const logout        = async () => {
    await apiFetch('/auth/logout');
    tokenStore.clear();
    setState({ loading: false, loggedIn: false, user: null });
  };

  return { ...state, login, logout, switchAccount, refetch };
}
