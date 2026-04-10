import { Router } from 'express';
import { google } from 'googleapis';
import { createAuthenticatedClient } from '../lib/oauth.js';
import { requireTokens, requireAuth } from '../lib/middleware.js';
import NotificationState from '../models/NotificationState.js';
import { isDBConnected } from '../lib/db.js';

const router = Router();

// ── GET /api/notifications/check ────────────────────────────────────────────
// Lightweight poll — uses Gmail historyId to detect new emails without fetching them all.
// Returns { hasNew, newCount, unreadCount, notifications[] }
router.get('/check', requireTokens, async (req, res) => {
  try {
    const oauth2Client = createAuthenticatedClient(req);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const userId = req.session.user?.email || 'unknown';

    // Get current Gmail profile for historyId and total messages
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const currentHistoryId = profile.data.historyId;

    // Get unread count from Gmail
    const unreadRes = await gmail.users.labels.get({
      userId: 'me',
      id: 'INBOX',
    });
    const unreadCount = unreadRes.data.messagesUnread || 0;

    // Load or create notification state
    let state = null;
    if (isDBConnected()) {
      state = await NotificationState.findOne({ userId });
    }

    let hasNew = false;
    let newCount = 0;
    let newEmails = [];

    if (state && state.lastHistoryId && state.lastHistoryId !== currentHistoryId) {
      // History changed — check what's new
      try {
        const historyRes = await gmail.users.history.list({
          userId: 'me',
          startHistoryId: state.lastHistoryId,
          historyTypes: ['messageAdded'],
          labelId: 'INBOX',
          maxResults: 20,
        });

        const history = historyRes.data.history || [];
        const addedMessages = [];
        for (const h of history) {
          if (h.messagesAdded) {
            for (const added of h.messagesAdded) {
              if (added.message?.labelIds?.includes('INBOX')) {
                addedMessages.push(added.message.id);
              }
            }
          }
        }

        newCount = addedMessages.length;
        hasNew = newCount > 0;

        // Fetch subjects for the new emails (just metadata, very fast)
        if (hasNew && addedMessages.length <= 10) {
          const details = await Promise.all(
            addedMessages.slice(0, 5).map(async (msgId) => {
              try {
                const detail = await gmail.users.messages.get({
                  userId: 'me',
                  id: msgId,
                  format: 'metadata',
                  metadataHeaders: ['Subject', 'From'],
                });
                const headers = detail.data.payload?.headers || [];
                const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
                const from = headers.find(h => h.name === 'From')?.value || '';
                const fromName = from.match(/^(.*?)\s*</) ? from.match(/^(.*?)\s*</)[1].trim() : from.split('@')[0];
                return { id: msgId, subject, from: fromName };
              } catch { return null; }
            })
          );
          newEmails = details.filter(Boolean);
        }
      } catch (err) {
        // historyId too old or invalid — just detect change
        if (err.code === 404 || err.message?.includes('notFound')) {
          hasNew = true;
          newCount = unreadCount;
        }
      }
    } else if (!state) {
      // First time — no comparison, just initialize
      hasNew = false;
      newCount = 0;
    }

    // Update state in MongoDB
    if (isDBConnected()) {
      const updateData = {
        lastHistoryId: currentHistoryId,
        lastCheckedAt: new Date(),
      };

      // Add new notification entries
      if (hasNew && newEmails.length > 0) {
        const newNotifs = newEmails.map(e => ({
          id: e.id,
          type: 'new_email',
          title: e.from,
          message: e.subject,
          read: false,
          createdAt: new Date(),
        }));

        if (state) {
          state.lastHistoryId = currentHistoryId;
          state.lastCheckedAt = new Date();
          state.notifications.push(...newNotifs);
          await state.save();
        } else {
          await NotificationState.create({
            userId,
            ...updateData,
            notifications: newNotifs,
          });
        }
      } else if (state) {
        state.lastHistoryId = currentHistoryId;
        state.lastCheckedAt = new Date();
        await state.save();
      } else {
        await NotificationState.create({ userId, ...updateData, notifications: [] });
      }
    }

    // Get stored notifications for the dropdown
    let notifications = [];
    if (isDBConnected()) {
      const freshState = await NotificationState.findOne({ userId });
      if (freshState) {
        notifications = freshState.notifications
          .slice(-20)
          .reverse()
          .map(n => ({
            id: n.id,
            type: n.type,
            title: n.title,
            message: n.message,
            read: n.read,
            createdAt: n.createdAt,
          }));
      }
    }

    res.json({
      hasNew,
      newCount,
      unreadCount,
      notifications,
    });
  } catch (err) {
    console.error('Notification check error:', err.message);
    // Don't 401 on notification check — it's a background poll
    if (err.status === 401 || err.code === 401 || err.message?.includes('invalid_grant')) {
      return res.status(401).json({ error: 'Session expired' });
    }
    res.status(500).json({ error: 'Notification check failed' });
  }
});

// ── POST /api/notifications/mark-read ───────────────────────────────────────
// Mark all notifications as read
router.post('/mark-read', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user?.email || 'unknown';
    if (isDBConnected()) {
      const state = await NotificationState.findOne({ userId });
      if (state) {
        state.notifications.forEach(n => { n.read = true; });
        await state.save();
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Mark read error:', err.message);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

export default router;
