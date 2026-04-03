import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client.js';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002';

export function useAuth() {
  const [state, setState] = useState({ loading: true, loggedIn: false, user: null });

  const refetch = useCallback(async () => {
    try {
      const data = await apiFetch('/auth/status');
      setState({ loading: false, loggedIn: data.loggedIn, user: data.user });
    } catch {
      setState({ loading: false, loggedIn: false, user: null });
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const login        = () => { window.location.href = `${API_BASE}/auth/google`; };
  const switchAccount = () => { window.location.href = `${API_BASE}/auth/switch`; };
  const logout       = async () => {
    await apiFetch('/auth/logout');
    setState({ loading: false, loggedIn: false, user: null });
  };

  return { ...state, login, logout, switchAccount, refetch };
}
