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
    const handler = () => auth.refetch();
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

  if (!auth.loggedIn) return <Login onLogin={auth.login} />;

  if (page === 'tickets') return <TicketsPage auth={auth} navigate={setPage} />;
  return <Dashboard auth={auth} navigate={setPage} />;
}
