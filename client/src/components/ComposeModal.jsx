import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../api/client.js';
import Spinner from './Spinner.jsx';
import './ComposeModal.css';

export default function ComposeModal({ onClose }) {
  const [to,       setTo]       = useState('');
  const [subject,  setSubject]  = useState('');
  const [body,     setBody]     = useState('');
  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(false);
  const [error,    setError]    = useState('');
  const toRef = useRef(null);

  // Focus "To" field on open
  useEffect(() => { toRef.current?.focus(); }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSend = async () => {
    if (!to.trim() || !body.trim()) {
      setError('To and message body are required.');
      return;
    }
    setSending(true);
    setError('');
    try {
      await apiFetch('/api/send', {
        method: 'POST',
        body: JSON.stringify({ to: to.trim(), subject: subject.trim(), body }),
      });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="compose-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="compose-modal">

        {/* Header */}
        <div className="compose-header">
          <div className="compose-header-left">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <span>New Email</span>
          </div>
          <button className="compose-close" onClick={onClose} title="Close (Esc)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Sent confirmation */}
        {sent ? (
          <div className="compose-sent">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <h3>Email sent!</h3>
            <p>Your message was sent successfully.</p>
            <div className="compose-sent-actions">
              <button className="compose-btn compose-btn--secondary" onClick={() => { setSent(false); setTo(''); setSubject(''); setBody(''); }}>
                Write Another
              </button>
              <button className="compose-btn compose-btn--primary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="compose-body">
            {/* To */}
            <div className="compose-field">
              <label className="compose-label">To</label>
              <input
                ref={toRef}
                className="compose-input"
                type="email"
                placeholder="recipient@example.com"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>

            {/* Subject */}
            <div className="compose-field">
              <label className="compose-label">Subject</label>
              <input
                className="compose-input"
                type="text"
                placeholder="Enter subject…"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            {/* Body */}
            <div className="compose-field compose-field--grow">
              <label className="compose-label">Message</label>
              <textarea
                className="compose-textarea"
                placeholder="Write your message here…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>

            {/* Error */}
            {error && (
              <p className="compose-error">⚠️ {error}</p>
            )}

            {/* Footer */}
            <div className="compose-footer">
              <button className="compose-btn compose-btn--secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                className="compose-btn compose-btn--primary"
                onClick={handleSend}
                disabled={sending || !to.trim() || !body.trim()}
              >
                {sending ? (
                  <><Spinner size={13} color="white" /> Sending…</>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                    Send Email
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
