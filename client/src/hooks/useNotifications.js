import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../api/client.js';

const POLL_INTERVAL = 30000; // 30 seconds

// Web Audio API — generate a short notification chime
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    // Two-tone chime
    osc.frequency.setValueAtTime(880, ctx.currentTime);       // A5
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1); // ~C#6
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Audio not available — silent
  }
}

function showDesktopNotification(title, body) {
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'mailflow-new-email',
      renotify: true,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    // Auto-close after 8 seconds
    setTimeout(() => n.close(), 8000);
  } catch {
    // Desktop notifications not supported
  }
}

export function useNotifications(loggedIn) {
  const [data, setData] = useState({
    hasNew: false,
    newCount: 0,
    unreadCount: 0,
    notifications: [],
  });
  const [permissionState, setPermissionState] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevUnreadRef = useRef(null);
  const timerRef = useRef(null);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermissionState(result);
  }, []);

  const check = useCallback(async () => {
    if (!loggedIn) return;
    try {
      const result = await apiFetch('/api/notifications/check');
      setData(result);

      // Play sound + show desktop notification for new emails
      if (result.hasNew && result.newCount > 0 && prevUnreadRef.current !== null) {
        if (soundEnabled) playNotificationSound();

        // Desktop notification
        if (result.newCount === 1 && result.notifications?.[0]) {
          const n = result.notifications[0];
          showDesktopNotification(
            `New email from ${n.title}`,
            n.message
          );
        } else {
          showDesktopNotification(
            'MailFlow',
            `${result.newCount} new email${result.newCount > 1 ? 's' : ''} received`
          );
        }

        // Update document title
        document.title = `(${result.unreadCount}) MailFlow — Customer Support`;
      } else if (result.unreadCount === 0) {
        document.title = 'MailFlow — Customer Support';
      } else {
        document.title = `(${result.unreadCount}) MailFlow — Customer Support`;
      }

      prevUnreadRef.current = result.unreadCount;
    } catch {
      // Silent — notification check is best-effort
    }
  }, [loggedIn, soundEnabled]);

  const markAllRead = useCallback(async () => {
    try {
      await apiFetch('/api/notifications/mark-read', { method: 'POST' });
      setData(prev => ({
        ...prev,
        notifications: prev.notifications.map(n => ({ ...n, read: true })),
      }));
    } catch {
      // Silent
    }
  }, []);

  // Start polling
  useEffect(() => {
    if (!loggedIn) return;

    // Initial check after 2 seconds (let emails load first)
    const initialTimer = setTimeout(() => {
      check();
    }, 2000);

    // Then poll every 30s
    timerRef.current = setInterval(check, POLL_INTERVAL);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(timerRef.current);
    };
  }, [loggedIn, check]);

  // Request notification permission on first load
  useEffect(() => {
    if (loggedIn && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      // Slight delay so it doesn't feel aggressive
      const t = setTimeout(requestPermission, 5000);
      return () => clearTimeout(t);
    }
  }, [loggedIn, requestPermission]);

  return {
    ...data,
    permissionState,
    soundEnabled,
    setSoundEnabled,
    requestPermission,
    markAllRead,
    refetch: check,
  };
}
