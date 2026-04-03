import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client.js';
import './TeamPanel.css';

const ROLE_LABELS = { owner: 'Owner', manager: 'Manager', agent: 'Agent' };
const ROLE_COLORS = { owner: '#f97316', manager: '#8b5cf6', agent: '#3b82f6' };

export default function TeamPanel({ currentUser, onClose }) {
  const [members, setMembers]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState(null);
  const [saving,  setSaving]    = useState(null); // userId being saved

  const canManage = currentUser?.role === 'owner' || currentUser?.role === 'manager';

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch('/api/workspace/members');
      setMembers(data.members || []);
    } catch (err) {
      setError('Failed to load team members');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  async function changeRole(userId, newRole) {
    setSaving(userId);
    try {
      await apiFetch(`/api/workspace/members/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole }),
      });
      setMembers(prev => prev.map(m => m._id === userId ? { ...m, role: newRole } : m));
    } catch {
      alert('Failed to update role. Please try again.');
    } finally {
      setSaving(null);
    }
  }

  async function removeMember(userId, name) {
    if (!confirm(`Remove ${name} from the team? They will lose access to MailFlow.`)) return;
    setSaving(userId);
    try {
      await apiFetch(`/api/workspace/members/${userId}`, { method: 'DELETE' });
      setMembers(prev => prev.map(m => m._id === userId ? { ...m, isActive: false } : m));
    } catch {
      alert('Failed to remove member. Please try again.');
    } finally {
      setSaving(null);
    }
  }

  async function reactivateMember(userId) {
    setSaving(userId);
    try {
      await apiFetch(`/api/workspace/members/${userId}/reactivate`, { method: 'PUT' });
      setMembers(prev => prev.map(m => m._id === userId ? { ...m, isActive: true } : m));
    } catch {
      alert('Failed to reactivate member.');
    } finally {
      setSaving(null);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('nl-NL', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  const activeMembers   = members.filter(m => m.isActive !== false);
  const inactiveMembers = members.filter(m => m.isActive === false);

  return (
    <div className="team-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="team-panel">

        {/* Header */}
        <div className="team-header">
          <div className="team-header-left">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
            </svg>
            <h2>Team Members</h2>
            <span className="team-count">{activeMembers.length}</span>
          </div>
          <button className="team-close" onClick={onClose}>✕</button>
        </div>

        {/* How to add new member */}
        {canManage && (
          <div className="team-invite-info">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>To add a new team member — share the MailFlow link with them. When they sign in with Google for the first time, they join as <strong>Agent</strong>. You can change their role below.</span>
          </div>
        )}

        {/* Body */}
        <div className="team-body">
          {loading && (
            <div className="team-loading">Loading team members…</div>
          )}

          {error && (
            <div className="team-error">{error}</div>
          )}

          {!loading && !error && (
            <>
              {/* Active members */}
              <table className="team-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Role</th>
                    <th>Last Login</th>
                    <th>Joined</th>
                    {canManage && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {activeMembers.map(member => {
                    const isMe      = member._id === currentUser?.id;
                    const isSaving  = saving === member._id;
                    const roleColor = ROLE_COLORS[member.role] || '#64748b';

                    return (
                      <tr key={member._id} className={isMe ? 'team-row--me' : ''}>
                        {/* Avatar + name + email */}
                        <td className="team-cell-member">
                          {member.picture
                            ? <img src={member.picture} alt="" className="team-avatar" />
                            : <div className="team-avatar-placeholder">{member.name?.[0]}</div>
                          }
                          <div className="team-member-info">
                            <span className="team-member-name">
                              {member.name}
                              {isMe && <span className="team-you-badge">You</span>}
                            </span>
                            <span className="team-member-email">{member.email}</span>
                          </div>
                        </td>

                        {/* Role */}
                        <td>
                          {canManage && !isMe ? (
                            <select
                              className="team-role-select"
                              value={member.role}
                              disabled={isSaving}
                              style={{ borderColor: roleColor, color: roleColor }}
                              onChange={e => changeRole(member._id, e.target.value)}
                            >
                              <option value="owner">Owner</option>
                              <option value="manager">Manager</option>
                              <option value="agent">Agent</option>
                            </select>
                          ) : (
                            <span className="team-role-badge" style={{ background: roleColor + '20', color: roleColor }}>
                              {ROLE_LABELS[member.role] || member.role}
                            </span>
                          )}
                        </td>

                        {/* Last login */}
                        <td className="team-cell-date">{formatDate(member.lastLogin)}</td>

                        {/* Joined */}
                        <td className="team-cell-date">{formatDate(member.createdAt)}</td>

                        {/* Actions */}
                        {canManage && (
                          <td>
                            {!isMe && (
                              <button
                                className="team-remove-btn"
                                disabled={isSaving}
                                onClick={() => removeMember(member._id, member.name)}
                              >
                                {isSaving ? '…' : 'Remove'}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Removed members */}
              {inactiveMembers.length > 0 && canManage && (
                <div className="team-removed-section">
                  <div className="team-removed-title">Removed Members</div>
                  {inactiveMembers.map(member => (
                    <div key={member._id} className="team-removed-row">
                      <span className="team-removed-name">{member.name}</span>
                      <span className="team-removed-email">{member.email}</span>
                      <button
                        className="team-reactivate-btn"
                        disabled={saving === member._id}
                        onClick={() => reactivateMember(member._id)}
                      >
                        Reactivate
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
