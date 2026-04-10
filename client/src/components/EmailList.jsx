import { useEffect, useRef, useState } from 'react';
import EmailRow   from './EmailRow.jsx';
import EmptyState from './EmptyState.jsx';
import Spinner    from './Spinner.jsx';
import './EmailList.css';

function SkeletonRow({ index }) {
  return (
    <div className="skeleton-row" style={{ animationDelay: `${index * 0.06}s` }}>
      <div className="skeleton-row-top">
        <div className="skeleton skeleton-name" />
        <div className="skeleton skeleton-date" />
      </div>
      <div className="skeleton skeleton-subject" />
      <div className="skeleton-row-bottom">
        <div className="skeleton skeleton-snippet" />
        <div className="skeleton skeleton-badge" />
      </div>
    </div>
  );
}

export default function EmailList({
  emails, loading, loadingMore, error,
  selectedId, onSelect, activeCategory,
  onLoadMore, hasMore, doneIds, statusMap,
}) {
  const [query, setQuery] = useState('');

  const TITLES = {
    queue:          'Smart Queue',
    all:            'All Emails',
    new:            'New Emails',
    open:           'Open Emails',
    awaiting_reply: 'Awaiting Reply',
    resolved:       'Resolved',
    callbacks:      'Needs Callback',
    done:           'Done Emails',
    pending:        'Pending Emails',
    today:          "Today's Emails",
    yesterday:      "Yesterday's Emails",
    older:          'Older Emails',
  };
  const title = TITLES[activeCategory]
    ?? (activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1));

  // Apply search filter on top of category-filtered emails
  const q = query.trim().toLowerCase();
  const visible = q
    ? emails.filter(e =>
        e.subject?.toLowerCase().includes(q) ||
        e.from?.toLowerCase().includes(q) ||
        e.snippet?.toLowerCase().includes(q)
      )
    : emails;

  // Sentinel div at the bottom — fires loadMore when scrolled into view
  const sentinelRef = useRef(null);
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading || loadingMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onLoadMore?.(); },
      { rootMargin: '200px', threshold: 0 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, onLoadMore]);

  return (
    <div className="email-list">
      <div className="email-list-header">
        <span className="email-list-title">{title}</span>
        <span className="email-list-count">
          {loading ? '…' : `${visible.length}${!q && hasMore ? '+' : ''} ${visible.length === 1 ? 'email' : 'emails'}`}
        </span>
      </div>

      {/* Search bar */}
      <div className="email-list-search">
        <svg className="email-list-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className="email-list-search-input"
          type="text"
          placeholder="Search emails…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {query && (
          <button className="email-list-search-clear" onClick={() => setQuery('')} title="Clear">
            ×
          </button>
        )}
      </div>

      <div className="email-list-body">
        {/* Skeleton loading — initial load */}
        {loading && Array.from({ length: 7 }).map((_, i) => (
          <SkeletonRow key={i} index={i} />
        ))}

        {/* Error */}
        {!loading && error && (
          <div className="email-list-state email-list-state--error">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && visible.length === 0 && (
          q
            ? <div className="email-list-no-results">No emails match "{query}"</div>
            : loadingMore && activeCategory === 'callbacks'
              ? (
                <div className="email-list-state" style={{ gap: 10, color: '#94a3b8' }}>
                  <Spinner size={20} color="#94a3b8" />
                  <span>Searching for callback emails…</span>
                </div>
              )
              : <EmptyState category={activeCategory} />
        )}

        {/* Email rows */}
        {!loading && !error && visible.map((email, i) => {
          const s = statusMap?.get(email.id);
          return (
            <EmailRow
              key={email.id}
              email={email}
              index={i}
              isSelected={email.id === selectedId}
              onClick={() => onSelect(email)}
              isDone={doneIds?.has(email.id)}
              status={s?.status}
              priority={s?.priority}
            />
          );
        })}

        {/* Load more — sentinel for auto-scroll + manual button fallback */}
        {!loading && hasMore && (
          <div ref={sentinelRef} className="email-list-sentinel">
            {loadingMore ? (
              <div className="email-list-loading-more">
                <Spinner size={16} color="#94a3b8" />
                <span>Loading more emails…</span>
              </div>
            ) : (
              <button className="email-list-load-more-btn" onClick={onLoadMore}>
                Load more emails
              </button>
            )}
          </div>
        )}

        {/* End of inbox */}
        {!loading && !hasMore && emails.length > 0 && (
          <div className="email-list-end">All emails loaded · {emails.length} total</div>
        )}
      </div>
    </div>
  );
}
