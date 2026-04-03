import './EmptyState.css';

const STATES = {
  damage:      { icon: '⚡', title: 'No damage reports',       text: 'No emails about damaged or broken products.' },
  returns:     { icon: '↩️', title: 'No return requests',      text: 'No emails requesting product returns.' },
  refund:      { icon: '💳', title: 'No refund requests',      text: 'No emails requesting refunds or compensation.' },
  replacement: { icon: '🔄', title: 'No replacement requests', text: 'No emails requesting product exchanges.' },
  delivery:    { icon: '📦', title: 'No delivery issues',      text: 'No emails about delivery problems.' },
  general:     { icon: '💬', title: 'No general emails',       text: 'No general customer inquiries.' },
  all:         { icon: '📭', title: 'Inbox is empty',          text: 'No emails found. Try refreshing.' },
  callbacks:   { icon: '📞', title: 'No callbacks needed',     text: 'No emails have been flagged for a callback.' },
  select:      { icon: '👆', title: 'Select an email',         text: 'Choose an email from the list to read and reply.' },
};

export default function EmptyState({ category, type }) {
  const key = type || category || 'all';
  const { icon, title, text } = STATES[key] || STATES.all;

  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-text">{text}</div>
    </div>
  );
}
