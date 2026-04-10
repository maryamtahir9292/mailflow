import express from 'express';
import EmailStatus from '../models/EmailStatus.js';
import { requireTokens } from '../lib/middleware.js';
import { isDBConnected } from '../lib/db.js';

const router = express.Router();

router.use(requireTokens);

// GET /api/email-status — get all statuses for current inbox
router.get('/', async (req, res) => {
  if (!isDBConnected()) return res.json({ statuses: {} });

  try {
    const all = await EmailStatus.find({});
    const statuses = {};
    for (const s of all) {
      statuses[s.emailId] = {
        status:           s.status,
        priority:         s.priority || 'normal',
        needsCallback:    s.needsCallback,
        callbackNote:     s.callbackNote,
        categoryOverride: s.categoryOverride,
        assignedTo:       s.assignedTo,
        lastRepliedAt:    s.lastRepliedAt,
        replyCount:       s.replyCount || 0,
      };
    }
    res.json({ statuses });
  } catch (err) {
    console.error('EmailStatus fetch error:', err.message);
    res.status(500).json({ error: 'Failed to load email statuses' });
  }
});

// PUT /api/email-status/:emailId — update status for a single email
router.put('/:emailId', async (req, res) => {
  if (!isDBConnected()) return res.json({ success: true, saved: false });

  const { emailId } = req.params;
  const { status, priority, needsCallback, callbackNote, categoryOverride, lastRepliedAt, replyCount } = req.body;

  try {
    const update = {};
    if (status !== undefined)           update.status = status;
    if (priority !== undefined)         update.priority = priority;
    if (needsCallback !== undefined)    update.needsCallback = needsCallback;
    if (callbackNote !== undefined)     update.callbackNote = callbackNote;
    if (categoryOverride !== undefined) update.categoryOverride = categoryOverride;
    if (lastRepliedAt !== undefined)    update.lastRepliedAt = lastRepliedAt;
    if (replyCount !== undefined)       update.replyCount = replyCount;
    update.updatedAt = new Date();

    await EmailStatus.findOneAndUpdate(
      { emailId },
      { $set: update, $setOnInsert: { emailId, createdAt: new Date() } },
      { upsert: true, new: true }
    );

    res.json({ success: true, saved: true });
  } catch (err) {
    console.error('EmailStatus update error:', err.message);
    res.status(500).json({ error: 'Failed to save email status' });
  }
});

// POST /api/email-status/:emailId/replied — auto-transition after agent reply
router.post('/:emailId/replied', async (req, res) => {
  if (!isDBConnected()) return res.json({ success: true, saved: false });

  const { emailId } = req.params;

  try {
    await EmailStatus.findOneAndUpdate(
      { emailId },
      {
        $set: {
          status: 'awaiting_reply',
          lastRepliedAt: new Date(),
          updatedAt: new Date(),
        },
        $inc: { replyCount: 1 },
        $setOnInsert: { emailId, createdAt: new Date() },
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, saved: true, newStatus: 'awaiting_reply' });
  } catch (err) {
    console.error('EmailStatus replied error:', err.message);
    res.status(500).json({ error: 'Failed to update reply status' });
  }
});

// POST /api/email-status/bulk-init — initialize new emails as 'new' status
// Called on email load for emails that don't have a status yet
router.post('/bulk-init', async (req, res) => {
  if (!isDBConnected()) return res.json({ success: true, saved: false });

  const { emailIds } = req.body;
  if (!emailIds || !emailIds.length) return res.json({ success: true, initialized: 0 });

  try {
    const ops = emailIds.map(emailId => ({
      updateOne: {
        filter: { emailId },
        update: {
          $setOnInsert: {
            emailId,
            status: 'new',
            priority: 'normal',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    const result = await EmailStatus.bulkWrite(ops, { ordered: false });
    res.json({ success: true, initialized: result.upsertedCount });
  } catch (err) {
    console.error('EmailStatus bulk-init error:', err.message);
    res.status(500).json({ error: 'Failed to initialize email statuses' });
  }
});

export default router;
