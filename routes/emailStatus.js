import express from 'express';
import EmailStatus from '../models/EmailStatus.js';
import { requireTokens } from '../lib/middleware.js';
import { isDBConnected } from '../lib/db.js';

const router = express.Router();

router.use(requireTokens);

// GET /api/email-status — get all statuses for current inbox
// Frontend calls this after loading emails to overlay saved workflow state
router.get('/', async (req, res) => {
  if (!isDBConnected()) return res.json({ statuses: {} });

  try {
    const all = await EmailStatus.find({});
    // Return as a map: { emailId: { status, needsCallback, callbackNote, categoryOverride } }
    const statuses = {};
    for (const s of all) {
      statuses[s.emailId] = {
        status:           s.status,
        needsCallback:    s.needsCallback,
        callbackNote:     s.callbackNote,
        categoryOverride: s.categoryOverride,
        assignedTo:       s.assignedTo,
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
  const { status, needsCallback, callbackNote, categoryOverride } = req.body;

  try {
    const update = {};
    if (status !== undefined)           update.status = status;
    if (needsCallback !== undefined)    update.needsCallback = needsCallback;
    if (callbackNote !== undefined)     update.callbackNote = callbackNote;
    if (categoryOverride !== undefined) update.categoryOverride = categoryOverride;
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

export default router;
