import { useEffect, useState } from 'react';
import { useAuth }    from './hooks/useAuth.js';
import Login          from './pages/Login.jsx';
import Dashboard      from './pages/Dashboard.jsx';
import TicketsPage    from './pages/TicketsPage.jsx';
import Spinner        from './components/Spinner.jsx';

export default function App() {
  const auth = useAuth();
  const [page, setPage] = useState('inbox'); // 'inbox' | 'tickets'

  // Clean up OAuth redirect params from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('auth') || params.has('error')) {
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // Global 401 handler — session expired → return to login screen
  useEffect(() => {
    const handler = () => { auth.refetch().catch(() => {}); };
    window.addEventListener('auth:expired', handler);
    return () => window.removeEventListener('auth:expired', handler);
  }, [auth.refetch]);

  if (auth.loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <Spinner size={36} />
      </div>
    );
  }

  if (auth.offline) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12, fontFamily: 'Arial, sans-serif', background: '#f8fafc', color: '#1e293b' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0119 12.55"/><path d="M5 12.55a10.94 10.94 0 015.17-2.39"/><path d="M10.71 5.05A16 16 0 0122.56 9"/><path d="M1.42 9a15.91 15.91 0 014.7-2.88"/><path d="M8.53 16.11a6 6 0 016.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 16 }}>Cannot connect to server</p>
        <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Make sure the backend is running on port 3002</p>
        <button onClick={auth.refetch} style={{ marginTop: 8, padding: '7px 18px', border: 'none', borderRadius: 6, background: '#1e3a5f', color: 'white', cursor: 'pointer', fontSize: 13 }}>
          Retry
        </button>
      </div>
    );
  }

  if (!auth.loggedIn) return <Login onLogin={auth.login} />;

  if (page === 'tickets') return <TicketsPage auth={auth} navigate={setPage} />;
  return <Dashboard auth={auth} navigate={setPage} />;
}
