import { useState, useRef, useEffect } from 'react';
import { apiFetch } from '../api/client.js';
import { useCannedResponses } from '../hooks/useCannedResponses.js';
import CannedResponsesPanel from './CannedResponsesPanel.jsx';
import Spinner from './Spinner.jsx';
import './AiReplyPanel.css';

function extractEmail(from = '') {
  const m = from.match(/<(.+?)>/);
  return m ? m[1] : from;
}

/**
 * AI Reply flow:
 *  Step 1 — Agent writes reply in English (manually or AI-generated)
 *  Step 2 — Click "Translate & Preview" → auto-detects customer language → translates
 *  Step 3 — Agent verifies translation → sends in customer's language
 */
export default function AiReplyPanel({ email, onReplySent }) {
  const [open,        setOpen]        = useState(true);
  const [step,        setStep]        = useState('write');  // 'write' | 'preview'
  const [generating,  setGenerating]  = useState(false);
  const [translating, setTranslating] = useState(false);
  const [sending,     setSending]     = useState(false);
  const [reply,       setReply]       = useState('');
  const [translated,  setTranslated]  = useState(null);  // { language, wasTranslated, translatedReply }
  const [sent,        setSent]        = useState(false);
  const [error,       setError]       = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const templateRef = useRef(null);
  const canned = useCannedResponses();

  // Close templates panel when clicking outside
  useEffect(() => {
    if (!showTemplates) return;
    const handler = (e) => {
      if (templateRef.current && !templateRef.current.contains(e.target)) {
        setShowTemplates(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTemplates]);

  const reset = () => {
    setStep('write');
    setReply('');
    setTranslated(null);
    setSent(false);
    setError('');
  };

  // Generate English draft via AI
  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const data = await apiFetch('/api/reply/generate', {
        method: 'POST',
        body: JSON.stringify({
          emailSubject: email.subject,
          emailBody:    email.body || email.snippet,
          category:     email.category,
          fromEmail:    email.from,
        }),
      });
      setReply(data.reply || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  // Detect customer language and translate
  const handleTranslate = async () => {
    if (!reply.trim()) return;
    setStep('preview');
    setTranslating(true);
    setError('');
    try {
      const data = await apiFetch('/api/reply/translate-outgoing', {
        method: 'POST',
        body: JSON.stringify({
          replyText:    reply,
          customerText: email.body || email.snippet || '',
        }),
      });
      setTranslated(data);
    } catch (err) {
      setError('Translation failed — you can edit and send the English version.');
      setTranslated({ wasTranslated: false, language: 'English', translatedReply: reply });
    } finally {
      setTranslating(false);
    }
  };

  // Send the final reply — works from both step 1 (English) and step 2 (translated)
  const handleSend = async (textOverride) => {
    const textToSend = textOverride ?? translated?.translatedReply ?? reply;
    console.log('[AiReplyPanel] handleSend called, textToSend length:', textToSend?.length, 'to:', extractEmail(email?.from));
    if (!textToSend?.trim()) {
      setError('Reply text is empty — please write a reply first.');
      return;
    }
    setSending(true);
    setError('');
    try {
      await apiFetch('/api/send', {
        method: 'POST',
        body: JSON.stringify({
          to:        extractEmail(email.from),
          subject:   email.subject,
          body:      textToSend,
          threadId:  email.threadId,
          messageId: email.messageId,
        }),
      });
      reset();
      setSent(true);
      onReplySent?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="ai-panel">

      {/* ── Toggle header ────────────────────────────────────────────────── */}
      <button className="ai-panel-toggle" onClick={() => setOpen(!open)}>
        <span className="ai-panel-toggle-left">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#f97316">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          AI Reply Assistant
        </span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="ai-panel-body">

          {/* ── Success state ────────────────────────────────────────────── */}
          {sent && (
            <div className="ai-status ai-status--success">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              Reply sent successfully!
              <button className="ai-btn ai-btn--secondary" style={{ marginLeft: 'auto', padding: '3px 10px', fontSize: '11px' }} onClick={() => setSent(false)}>
                Write Another
              </button>
            </div>
          )}

          {!sent && (
            <>
              {/* ════════════════════════════════════════════════════════════
                  STEP 1 — Write in English
              ════════════════════════════════════════════════════════════ */}
              {step === 'write' && (
                <>
                  <div className="ai-step-label">
                    <span className="ai-step-num">1</span>
                    Write your reply in English
                  </div>

                  <textarea
                    className="ai-textarea"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={4}
                    placeholder="Type your reply in English — it will be auto-translated to the customer's language before sending."
                    disabled={generating}
                  />

                  <div className="ai-actions">
                    <button
                      className="ai-generate-btn ai-generate-btn--small"
                      onClick={handleGenerate}
                      disabled={generating}
                    >
                      {generating
                        ? <><Spinner size={12} color="white" /> Generating…</>
                        : <>{reply ? '↺ Regenerate' : '✨ Generate AI Draft'}</>}
                    </button>

                    <div className="ai-template-wrap" ref={templateRef}>
                      <button
                        className={`ai-btn ai-btn--template ${showTemplates ? 'ai-btn--template-active' : ''}`}
                        onClick={() => setShowTemplates(!showTemplates)}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                          <path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>
                        </svg>
                        Templates
                      </button>
                      {showTemplates && (
                        <div className="ai-template-dropdown">
                          <CannedResponsesPanel
                            responses={canned.responses}
                            loading={canned.loading}
                            onInsert={(text) => { setReply(text); setShowTemplates(false); }}
                            onSeed={canned.seed}
                            onCreate={canned.create}
                            onUpdate={canned.update}
                            onRemove={canned.remove}
                            onUse={canned.use}
                          />
                        </div>
                      )}
                    </div>

                    {reply && !generating && (
                      <button className="ai-btn ai-btn--clear" onClick={reset}>
                        Clear
                      </button>
                    )}
                  </div>

                  {reply && !generating && (
                    <div className="ai-send-row">
                      <button className="ai-btn ai-btn--translate" onClick={handleTranslate}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="2" y1="12" x2="22" y2="12"/>
                          <path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>
                        </svg>
                        Translate &amp; Send →
                      </button>
                      <button
                        className="ai-btn ai-btn--send"
                        onClick={() => handleSend(reply)}
                        disabled={sending}
                      >
                        {sending ? (
                          <><Spinner size={12} color="white" /> Sending…</>
                        ) : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                              <line x1="22" y1="2" x2="11" y2="13"/>
                              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                            </svg>
                            Send in English
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* ════════════════════════════════════════════════════════════
                  STEP 2 — Translated preview — verify then send
              ════════════════════════════════════════════════════════════ */}
              {step === 'preview' && (
                <div className="ai-preview-box">

                  {/* Header */}
                  <div className="ai-preview-header">
                    <div className="ai-step-label" style={{ marginBottom: 0 }}>
                      <span className="ai-step-num">2</span>
                      {translating ? 'Detecting language & translating…' : 'Verify translation then send'}
                    </div>
                    {!translating && translated && (
                      <span className={`ai-preview-lang-chip ${translated.wasTranslated ? 'ai-preview-lang-chip--translated' : ''}`}>
                        {translated.wasTranslated ? `🌐 ${translated.language}` : '🇬🇧 English'}
                      </span>
                    )}
                  </div>

                  {/* Translation banner */}
                  {!translating && translated?.wasTranslated && (
                    <div className="ai-translation-banner">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="2" y1="12" x2="22" y2="12"/>
                        <path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>
                      </svg>
                      Auto-translated from English → <strong>{translated.language}</strong>. Edit if needed before sending.
                    </div>
                  )}
                  {!translating && translated && !translated.wasTranslated && (
                    <div className="ai-translation-banner ai-translation-banner--english">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                      </svg>
                      Customer emailed in English — reply will be sent in English.
                    </div>
                  )}

                  {/* Your English draft — read only reference */}
                  <div className="ai-original-label">Your English draft</div>
                  <div className="ai-original-text">{reply}</div>

                  {/* Translation loading */}
                  {translating && (
                    <div className="ai-translating-row">
                      <Spinner size={15} color="#2563eb" />
                      <span>Detecting customer language and translating…</span>
                    </div>
                  )}

                  {/* Translated / final reply — editable */}
                  {!translating && translated && (
                    <>
                      <div className="ai-original-label" style={{ marginTop: 8 }}>
                        {translated.wasTranslated
                          ? `${translated.language} translation — edit if needed`
                          : 'Final reply (English)'}
                      </div>
                      <textarea
                        className="ai-textarea ai-textarea--preview"
                        value={translated.translatedReply}
                        onChange={(e) => setTranslated({ ...translated, translatedReply: e.target.value })}
                        rows={5}
                      />
                    </>
                  )}

                  {/* Actions */}
                  <div className="ai-actions" style={{ marginTop: 6 }}>
                    <button className="ai-btn ai-btn--secondary" onClick={() => { setStep('write'); setTranslated(null); }}>
                      ← Back to English
                    </button>
                    <button
                      className="ai-btn ai-btn--send"
                      onClick={handleSend}
                      disabled={sending || translating || !translated}
                    >
                      {sending ? (
                        <><Spinner size={12} color="white" /> Sending…</>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                            <line x1="22" y1="2" x2="11" y2="13"/>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                          </svg>
                          {translated?.wasTranslated
                            ? `Send in ${translated.language}`
                            : 'Send Reply'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Error ──────────────────────────────────────────────────── */}
              {error && (
                <div className="ai-status ai-status--error">⚠️ {error}</div>
              )}
            </>
          )}

        </div>
      )}
    </div>
  );
}
