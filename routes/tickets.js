import express from 'express';
import Ticket  from '../models/Ticket.js';
import User    from '../models/User.js';
import { requireAuth, requireManager } from '../lib/middleware.js';
import { isDBConnected } from '../lib/db.js';

const router = express.Router();

// All ticket routes require a logged-in user
router.use(requireAuth);

// Guard: return 503 if DB is not connected
function requireDB(req, res, next) {
  if (!isDBConnected()) return res.status(503).json({ error: 'Database not available' });
  next();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse "Name <email>" or plain "email" from a From header. */
function parseFrom(from = '') {
  const match = from.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) return { name: match[1].trim(), email: match[2].trim().toLowerCase() };
  const email = from.trim().toLowerCase();
  return { name: '', email };
}

/** Append an activity entry and save the ticket. */
async function logActivity(ticket, entry) {
  ticket.activity.push({ ...entry, at: new Date() });
  return ticket.save();
}

// ── GET /api/tickets ──────────────────────────────────────────────────────────
// Query params: status, category, assignedTo, search, page (default 1)
router.get('/', requireDB, async (req, res) => {
  const { status, category, assignedTo, search, page = 1 } = req.query;
  const filter = {};

  if (status)     filter.status = status;
  if (category)   filter.category = category;
  if (assignedTo) filter.assignedTo = assignedTo;
  if (search) {
    const re = new RegExp(search, 'i');
    filter.$or = [{ subject: re }, { customerEmail: re }, { customerName: re }, { ticketNumber: re }];
  }

  const PAGE_SIZE = 50;
  const skip = (Number(page) - 1) * PAGE_SIZE;

  try {
    const [tickets, total] = await Promise.all([
      Ticket.find(filter)
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(PAGE_SIZE)
        .populate('assignedTo', 'name email picture')
        .lean(),
      Ticket.countDocuments(filter),
    ]);

    // Count per status for sidebar badges
    const counts = await Ticket.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const statusCounts = { new: 0, open: 0, pending: 0, resolved: 0, closed: 0, all: total };
    for (const { _id, count } of counts) {
      if (_id in statusCounts) statusCounts[_id] = count;
      statusCounts.all += (_id in statusCounts ? 0 : count); // shouldn't happen
    }
    statusCounts.all = await Ticket.countDocuments({});

    res.json({ tickets, total, page: Number(page), statusCounts });
  } catch (err) {
    console.error('Tickets list error:', err.message);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// ── GET /api/tickets/customer/:email ─────────────────────────────────────────
// Must be defined BEFORE /:id to avoid "customer" being parsed as an ID
router.get('/customer/:email', requireDB, async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase();
    const tickets = await Ticket.find({ customerEmail: email })
      .sort({ lastMessageAt: -1 })
      .select('ticketNumber subject status category priority lastMessageAt firstMessageAt assignedTo')
      .populate('assignedTo', 'name email')
      .lean();
    res.json({ tickets });
  } catch (err) {
    console.error('Customer tickets error:', err.message);
    res.status(500).json({ error: 'Failed to fetch customer tickets' });
  }
});

// ── POST /api/tickets ─────────────────────────────────────────────────────────
// Manually create a ticket
router.post('/', requireDB, async (req, res) => {
  const { customerEmail, subject, category, threadId, customerName, priority } = req.body;

  if (!customerEmail || !subject)
    return res.status(400).json({ error: 'customerEmail and subject are required' });

  try {
    const ticketNumber = await Ticket.nextNumber();
    const userId = req.session.user?.id;

    const ticket = await Ticket.create({
      ticketNumber,
      threadId:      threadId || null,
      customerEmail: customerEmail.toLowerCase(),
      customerName:  customerName || '',
      subject,
      category:      category || 'general',
      priority:      priority || 'medium',
      source:        'manual',
      firstMessageAt: new Date(),
      lastMessageAt:  new Date(),
      activity: [{
        type: 'created',
        to:   'new',
        note: 'Ticket created manually',
        by:   userId,
        at:   new Date(),
      }],
    });

    res.status(201).json({ ticket });
  } catch (err) {
    console.error('Create ticket error:', err.message);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// ── GET /api/tickets/:id ──────────────────────────────────────────────────────
router.get('/:id', requireDB, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('assignedTo', 'name email picture')
      .populate('activity.by', 'name email picture')
      .lean();

    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json({ ticket });
  } catch (err) {
    console.error('Get ticket error:', err.message);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

// ── PATCH /api/tickets/:id/status ─────────────────────────────────────────────
router.patch('/:id/status', requireDB, async (req, res) => {
  const { status } = req.body;
  const VALID = ['new', 'open', 'pending', 'resolved', 'closed'];
  if (!VALID.includes(status))
    return res.status(400).json({ error: `status must be one of: ${VALID.join(', ')}` });

  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const prev = ticket.status;
    ticket.status = status;
    if (status === 'resolved' && !ticket.resolvedAt) ticket.resolvedAt = new Date();
    if (status === 'closed'   && !ticket.closedAt)   ticket.closedAt   = new Date();

    await logActivity(ticket, {
      type: 'status_changed',
      from: prev,
      to:   status,
      by:   req.session.user?.id,
    });

    res.json({ ticket });
  } catch (err) {
    console.error('Status update error:', err.message);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// ── PATCH /api/tickets/:id/assign ─────────────────────────────────────────────
router.patch('/:id/assign', requireDB, async (req, res) => {
  const { userId } = req.body;

  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    let assigneeName = 'Unassigned';
    if (userId) {
      const user = await User.findById(userId).select('name').lean();
      if (!user) return res.status(400).json({ error: 'User not found' });
      assigneeName = user.name;
    }

    const prevId = ticket.assignedTo?.toString() || null;
    ticket.assignedTo = userId || null;

    await logActivity(ticket, {
      type: 'assigned',
      from: prevId,
      to:   userId || null,
      note: `Assigned to ${assigneeName}`,
      by:   req.session.user?.id,
    });

    const populated = await ticket.populate('assignedTo', 'name email picture');
    res.json({ ticket: populated });
  } catch (err) {
    console.error('Assign error:', err.message);
    res.status(500).json({ error: 'Failed to assign ticket' });
  }
});

// ── POST /api/tickets/:id/notes ───────────────────────────────────────────────
router.post('/:id/notes', requireDB, async (req, res) => {
  const { note } = req.body;
  if (!note?.trim()) return res.status(400).json({ error: 'note is required' });

  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    await logActivity(ticket, {
      type: 'note',
      note: note.trim(),
      by:   req.session.user?.id,
    });

    res.json({ ticket });
  } catch (err) {
    console.error('Add note error:', err.message);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

export default router;
