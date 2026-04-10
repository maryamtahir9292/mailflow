import { useState }   from 'react';
import { useEmails }  from '../hooks/useEmails.js';
import Navbar         from '../components/Navbar.jsx';
import Sidebar        from '../components/Sidebar.jsx';
import EmailList      from '../components/EmailList.jsx';
import EmailDetail    from '../components/EmailDetail.jsx';
import ComposeModal   from '../components/ComposeModal.jsx';
import './Dashboard.css';

export default function Dashboard({ auth, navigate, notifs }) {
  const emailState             = useEmails(auth.loggedIn);
  const [composing, setComposing] = useState(false);

  return (
    <div className="dashboard">
      <Navbar
        user={auth.user}
        onLogout={auth.logout}
        onSwitch={auth.switchAccount}
        onRefresh={emailState.refetch}
        loading={emailState.loading}
        onCompose={() => setComposing(true)}
        page="inbox"
        navigate={navigate}
        notifs={notifs}
      />

      {composing && <ComposeModal onClose={() => setComposing(false)} />}

      <div className="dashboard-body">
        <Sidebar
          activeCategory={emailState.activeCategory}
          onSelect={emailState.setActiveCategory}
          counts={emailState.counts}
        />
        <EmailList
          emails={emailState.filtered}
          loading={emailState.loading}
          loadingMore={emailState.loadingMore}
          error={emailState.error}
          selectedId={emailState.selectedEmail?.id}
          onSelect={emailState.setSelectedEmail}
          activeCategory={emailState.activeCategory}
          onLoadMore={emailState.loadMore}
          hasMore={!!emailState.nextPageToken}
          doneIds={emailState.doneIds}
          statusMap={emailState.statusMap}
        />
        <EmailDetail
          key={emailState.selectedEmail?.id}
          email={emailState.selectedEmail}
          user={auth.user}
          bodyLoading={emailState.bodyLoading}
          onCategoryChange={emailState.recategorize}
          onToggleCallback={emailState.toggleCallback}
          isCallbackSet={emailState.callbackIds.has(emailState.selectedEmail?.id)}
          callbackNote={emailState.callbackNotes.get(emailState.selectedEmail?.id) || ''}
          onCallbackNoteChange={emailState.setCallbackNote}
          isDone={emailState.doneIds?.has(emailState.selectedEmail?.id)}
          onToggleDone={emailState.toggleDone}
          emailStatus={emailState.statusMap?.get(emailState.selectedEmail?.id)}
          onStatusChange={emailState.setEmailStatus}
          onPriorityChange={emailState.setEmailPriority}
          onMarkReplied={emailState.markReplied}
        />
      </div>
    </div>
  );
}
