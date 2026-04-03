import { useState, useEffect, useRef } from 'react';
import { apiFetch }        from '../api/client.js';
import { CAT_META, CATEGORY_IDS } from '../lib/categories.js';
import AiReplyPanel        from './AiReplyPanel.jsx';
import Spinner             from './Spinner.jsx';
import EmptyState          from './EmptyState.jsx';
import './EmailDetail.css';

function parseFrom(from = '') {
  const m = from.match(/^"?([^"<]+)"?\s*<(.+?)>/);
  return m ? { name: m[1].trim(), email: m[2] } : { name: from, email: from };
}

function formatFullDate(raw) {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d)) return raw;
  return d.toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'long',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function EmailDetail({ email, user, onCategoryChange, onToggleCallback, isCallbackSet, callbackNote, onCallbackNoteChange, isDone, onToggleDone }) {
  const [translating,     setTranslating]     = useState(false);
  const [translation,     setTranslation]     = useState(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [showCatPicker,   setShowCatPicker]   = useState(false);
  const [catSuggestion,   setCatSuggestion]   = useState(null);  // { suggestedCategory, confidence, reason }
  const catPickerRef = useRef(null);

  // Reset state when email changes
  useEffect(() => {
    setTranslation(null);
    setTranslating(false);
    setShowTranslation(false);
    setShowCatPicker(false);
    setCatSuggestion(null);
  }, [email?.id]);

  // Close picker when clicking outside
  useEffect(() => {
    if (!showCatPicker) return;
    const handler = (e) => {
      if (catPickerRef.current && !catPickerRef.current.contains(e.target)) {
        setShowCatPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCatPicker]);

  if (!email) {
    return (
      <div className="email-detail email-detail--empty">
        <EmptyState type="select" />
      </div>
    );
  }

  const sender = parseFrom(email.from);
  const cat    = CAT_META[email.category] || CAT_META.general;

  /* ── Translate handler ────────────────────────────────────────────────── */
  const handleTranslate = async () => {
    // If we already have a result, just toggle visibility
    if (translation) {
      setShowTranslation(!showTranslation);
      return;
    }

    setTranslating(true);
    setShowTranslation(true);
    try {
      const result = await apiFetch('/api/reply/translate', {
        method: 'POST',
        body: JSON.stringify({ text: email.body || email.snippet }),
      });
      setTranslation(result);
    } catch (err) {
      setTranslation({ error: err.message });
    } finally {
      setTranslating(false);
    }
  };

  const translateLabel = translating
    ? 'Translating…'
    : translation && showTranslation
      ? 'Hide Translation'
      : translation
        ? 'Show Translation'
        : 'Translate to English';

  return (
    <div className="email-detail">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="email-detail-header">
        <div className="detail-subject-row">
          <h2 className="detail-subject">{email.subject}</h2>

          {/* Clickable category badge — opens picker */}
          <div className="cat-picker-wrap" ref={catPickerRef}>
            <button
              className="detail-category-badge"
              style={{ background: cat.bg, color: cat.color }}
              onClick={() => setShowCatPicker(!showCatPicker)}
              title="Click to change category"
            >
              {cat.label}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: 4 }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {showCatPicker && (
              <div className="cat-picker-dropdown">
                <p className="cat-picker-label">Move to category:</p>
                {CATEGORY_IDS.map(id => {
                  const c = CAT_META[id];
                  const isActive = email.category === id;
                  return (
                    <button
                      key={id}
                      className={`cat-picker-option ${isActive ? 'cat-picker-option--active' : ''}`}
                      style={{ '--opt-color': c.color, '--opt-bg': c.bg }}
                      onClick={() => {
                        onCategoryChange(email.id, id);
                        setShowCatPicker(false);
                      }}
                    >
                      <span className="cat-picker-dot" style={{ background: c.color }} />
                      {c.label}
                      {isActive && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ marginLeft: 'auto' }}>
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="detail-meta">
          <div className="meta-row">
            <span className="meta-label">From</span>
            <span className="meta-value">
              <strong>{sender.name}</strong>
              {sender.name !== sender.email && (
                <span className="meta-email"> &lt;{sender.email}&gt;</span>
              )}
            </span>
          </div>
          <div className="meta-row">
            <span className="meta-label">To</span>
            <span className="meta-value">{email.to || user?.email || 'me'}</span>
          </div>
          <div className="meta-row">
            <span className="meta-label">Date</span>
            <span className="meta-value">{formatFullDate(email.date)}</span>
          </div>
        </div>

        {/* ── Action bar ────────────────────────────────────────────── */}
        <div className="detail-actions">
          <button
            className={`translate-btn ${translating ? 'translate-btn--loading' : ''} ${translation && showTranslation ? 'translate-btn--active' : ''}`}
            onClick={handleTranslate}
            disabled={translating}
            title="Translate email to English"
          >
            {translating ? (
              <Spinner size={13} color="#2563eb" />
            ) : (
              /* Globe / language icon */
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2"  y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>
              </svg>
            )}
            {translateLabel}
          </button>
          {/* Mark as Done toggle — like callback button */}
          <button
            className={`done-btn ${isDone ? 'done-btn--active' : ''}`}
            onClick={() => onToggleDone(email.id)}
            title={isDone ? 'Click to mark as pending again' : 'Click to mark as done'}
          >
            {isDone ? (
              /* Filled checkmark circle — done state */
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            ) : (
              /* Empty circle — not done state */
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/>
              </svg>
            )}
            {isDone ? '✓ Marked Done' : 'Mark as Done'}
          </button>

          {/* Callback button */}
          <button
            className={`callback-btn ${isCallbackSet ? 'callback-btn--active' : ''}`}
            onClick={() => onToggleCallback(email.id)}
            title={isCallbackSet ? 'Remove callback flag' : 'Flag for team callback'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
            </svg>
            {isCallbackSet ? '✓ Callback Scheduled' : 'Needs Callback'}
          </button>
        </div>

      </div>

      {/* ── Email body ─────────────────────────────────────────────────── */}
      <div className="email-detail-body">

        {/* ── AI category suggestion banner ────────────────────────────── */}
        {catSuggestion && (
          <div className="cat-suggestion-banner">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <span className="cat-suggestion-text">
              AI suggests <strong>{catSuggestion.suggestedCategory}</strong>
              <span className="cat-suggestion-reason"> — {catSuggestion.reason}</span>
            </span>
            <button
              className="cat-suggestion-apply"
              onClick={() => {
                onCategoryChange(email.id, catSuggestion.suggestedCategory);
                setCatSuggestion(null);
              }}
            >
              Apply
            </button>
            <button className="cat-suggestion-dismiss" onClick={() => setCatSuggestion(null)}>
              ✕
            </button>
          </div>
        )}

        {/* ── Callback notes — inside scrollable body ──────────────────── */}
        {isCallbackSet && (
          <div className="callback-notes-panel">
            <div className="callback-notes-header">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Callback Notes
              <span className="callback-notes-hint">phone number, best time to call, assigned to…</span>
            </div>
            <textarea
              className="callback-notes-input"
              value={callbackNote || ''}
              onChange={(e) => onCallbackNoteChange(email.id, e.target.value)}
              placeholder={`Customer: ${parseFrom(email.from).name}\nPhone: \nBest time to call: \nAssigned to: \nNotes: `}
              rows={4}
            />
            <div className="callback-notes-footer">
              <span className="callback-notes-tip">
                📋 Fill in contact details before calling
              </span>
              <button
                className="callback-done-btn"
                onClick={() => {
                  onToggleCallback(email.id);
                  onCallbackNoteChange(email.id, '');
                }}
                title="Mark call as done and remove from callback queue"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Call Done — Remove
              </button>
            </div>
          </div>
        )}

        <div className="email-body-original">
          {email.body || email.snippet || '(no content)'}
        </div>

        {/* ── Translation result box ──────────────────────────────────── */}
        {showTranslation && (translating || translation) && (
          <div className={`
            translation-box
            ${translation?.alreadyEnglish ? 'translation-box--already-english' : ''}
            ${translation?.error ? 'translation-box--error' : ''}
          `.trim()}>

            {translating && (
              <div className="translation-loading">
                <Spinner size={16} color="#2563eb" />
                <span>Detecting language and translating…</span>
              </div>
            )}

            {!translating && translation?.error && (
              <p className="translation-error-msg">⚠️ {translation.error}</p>
            )}

            {!translating && translation?.alreadyEnglish && (
              <div className="translation-already-english">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <div>
                  <strong>This email is already in English</strong>
                  <p>Detected language: {translation.language}</p>
                </div>
              </div>
            )}

            {!translating && translation && !translation.alreadyEnglish && !translation.error && (
              <>
                <div className="translation-header">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>
                  English Translation
                  <span className="translation-lang-chip">{translation.language}</span>
                </div>
                <p className="translation-text">{translation.translation}</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── AI Reply Panel ─────────────────────────────────────────────── */}
      <AiReplyPanel email={email} user={user} onReplySent={() => !isDone && onToggleDone(email.id)} />
    </div>
  );
}
