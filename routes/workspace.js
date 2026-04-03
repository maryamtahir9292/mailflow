import express from 'express';
import User from '../models/User.js';
import { requireAuth, requireManager } from '../lib/middleware.js';

const router = express.Router();

// GET /api/workspace/members
router.get('/members', requireAuth, async (req, res) => {
  try {
    const users = await User.find({}, {
      name: 1, email: 1, picture: 1, role: 1, lastLogin: 1, isActive: 1, createdAt: 1
    }).sort({ createdAt: 1 });
    res.json({ members: users });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get team members' });
  }
});

// PUT /api/workspace/members/:userId/role
router.put('/members/:userId/role', requireAuth, requireManager, async (req, res) => {
  const { userId } = req.params;
  const { role }   = req.body;

  if (!['owner', 'manager', 'agent'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const user = await User.findByIdAndUpdate(
      userId, { role }, { new: true, select: 'name email role' }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// DELETE /api/workspace/members/:userId
router.delete('/members/:userId', requireAuth, requireManager, async (req, res) => {
  const { userId } = req.params;
  if (req.session.user.id === userId) {
    return res.status(400).json({ error: 'You cannot remove yourself' });
  }
  try {
    const user = await User.findByIdAndUpdate(
      userId, { isActive: false }, { new: true, select: 'name email' }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// PUT /api/workspace/members/:userId/reactivate
router.put('/members/:userId/reactivate', requireAuth, requireManager, async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await User.findByIdAndUpdate(
      userId, { isActive: true }, { new: true, select: 'name email' }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reactivate member' });
  }
});

export default router;