import { Router } from 'express';
import CannedResponse from '../models/CannedResponse.js';
import { requireAuth } from '../lib/middleware.js';
import { isDBConnected } from '../lib/db.js';

const router = Router();

// ── GET /api/canned-responses ────────────────────────────────────────────────
// List all active canned responses (optionally filter by category)
router.get('/', requireAuth, async (req, res) => {
  try {
    if (!isDBConnected()) return res.json({ responses: [] });
    const filter = { isActive: true };
    if (req.query.category) filter.category = req.query.category;
    const responses = await CannedResponse.find(filter)
      .sort({ usageCount: -1, title: 1 })
      .lean();
    res.json({ responses });
  } catch (err) {
    console.error('Canned responses list error:', err.message);
    res.status(500).json({ error: 'Failed to load canned responses' });
  }
});

// ── POST /api/canned-responses ───────────────────────────────────────────────
// Create a new canned response
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, body, category, shortcut, tags } = req.body;
    if (!title || !body) return res.status(400).json({ error: 'Title and body are required' });
    const cr = await CannedResponse.create({
      title, body,
      category: category || 'general',
      shortcut: shortcut || '',
      tags: tags || [],
      createdBy: req.session.user?.id || null,
    });
    res.status(201).json({ response: cr });
  } catch (err) {
    console.error('Canned response create error:', err.message);
    res.status(500).json({ error: 'Failed to create canned response' });
  }
});

// ── PUT /api/canned-responses/:id ────────────────────────────────────────────
// Update an existing canned response
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { title, body, category, shortcut, tags } = req.body;
    const cr = await CannedResponse.findByIdAndUpdate(
      req.params.id,
      { title, body, category, shortcut, tags },
      { new: true, runValidators: true }
    );
    if (!cr) return res.status(404).json({ error: 'Not found' });
    res.json({ response: cr });
  } catch (err) {
    console.error('Canned response update error:', err.message);
    res.status(500).json({ error: 'Failed to update canned response' });
  }
});

// ── DELETE /api/canned-responses/:id ─────────────────────────────────────────
// Soft-delete (deactivate)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const cr = await CannedResponse.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!cr) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Canned response delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete canned response' });
  }
});

// ── POST /api/canned-responses/:id/use ───────────────────────────────────────
// Increment usage count + apply variable substitution
router.post('/:id/use', requireAuth, async (req, res) => {
  try {
    const cr = await CannedResponse.findById(req.params.id);
    if (!cr) return res.status(404).json({ error: 'Not found' });

    cr.usageCount += 1;
    await cr.save();

    // Apply variable substitution
    const vars = req.body.variables || {};
    let text = cr.body;
    for (const [key, val] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
    }

    res.json({ text, title: cr.title });
  } catch (err) {
    console.error('Canned response use error:', err.message);
    res.status(500).json({ error: 'Failed to use canned response' });
  }
});

// ── POST /api/canned-responses/seed ──────────────────────────────────────────
// Seed default templates (one-time, won't duplicate)
router.post('/seed', requireAuth, async (req, res) => {
  try {
    const count = await CannedResponse.countDocuments();
    if (count > 0) return res.json({ message: 'Templates already exist', count });

    const defaults = [
      {
        title: 'Refund Approved',
        body: 'Hi {customer_name},\n\nThank you for reaching out. We have reviewed your request and approved a full refund for your order.\n\nThe refund of {amount} will be processed within 5-7 business days and credited back to your original payment method.\n\nIf you have any questions, please don\'t hesitate to reach out.\n\nBest regards,\n{agent_name}',
        category: 'refund',
        shortcut: '/refund-approved',
        tags: ['refund', 'approved'],
      },
      {
        title: 'Replacement Shipping',
        body: 'Hi {customer_name},\n\nWe\'re sorry to hear about the issue with your order. A replacement has been dispatched and you should receive it within {delivery_days} business days.\n\nYour new tracking number is: {tracking_number}\n\nWe apologize for the inconvenience.\n\nBest regards,\n{agent_name}',
        category: 'replacement',
        shortcut: '/replacement-sent',
        tags: ['replacement', 'shipping'],
      },
      {
        title: 'Return Instructions',
        body: 'Hi {customer_name},\n\nThank you for contacting us. To process your return, please follow these steps:\n\n1. Pack the item securely in its original packaging\n2. Include the return form (attached to your order confirmation)\n3. Ship to: {return_address}\n\nOnce we receive and inspect the item, your refund will be processed within 5-7 business days.\n\nBest regards,\n{agent_name}',
        category: 'returns',
        shortcut: '/return-instructions',
        tags: ['return', 'instructions'],
      },
      {
        title: 'Damaged Item — Apology',
        body: 'Hi {customer_name},\n\nWe\'re very sorry to hear that your item arrived damaged. This is not the experience we want for our customers.\n\nCould you please share a photo of the damaged item? This will help us process your claim quickly.\n\nOnce we receive the photo, we\'ll arrange a replacement or refund — whichever you prefer.\n\nSincerely,\n{agent_name}',
        category: 'damage',
        shortcut: '/damaged-apology',
        tags: ['damage', 'apology', 'photo'],
      },
      {
        title: 'Delivery Delay',
        body: 'Hi {customer_name},\n\nWe understand your concern about the delivery delay. We\'ve checked with our shipping partner and your package is currently {status}.\n\nEstimated delivery: {estimated_date}\nTracking: {tracking_number}\n\nWe\'re monitoring this closely and will update you if anything changes.\n\nBest regards,\n{agent_name}',
        category: 'delivery',
        shortcut: '/delivery-delay',
        tags: ['delivery', 'delay', 'tracking'],
      },
      {
        title: 'General Greeting',
        body: 'Hi {customer_name},\n\nThank you for contacting MailFlow Support! We\'ve received your message and our team is looking into it.\n\nWe\'ll get back to you within 24 hours with an update.\n\nBest regards,\n{agent_name}',
        category: 'greeting',
        shortcut: '/greeting',
        tags: ['greeting', 'acknowledgment'],
      },
      {
        title: 'Ticket Resolved — Closing',
        body: 'Hi {customer_name},\n\nWe\'re glad we could help resolve your issue! Your ticket has been marked as resolved.\n\nIf you need anything else in the future, don\'t hesitate to reach out.\n\nThank you for your patience, and have a great day!\n\nBest regards,\n{agent_name}',
        category: 'closing',
        shortcut: '/closing',
        tags: ['closing', 'resolved'],
      },
    ];

    await CannedResponse.insertMany(defaults.map(d => ({
      ...d,
      createdBy: req.session.user?.id || null,
    })));

    res.json({ message: 'Seeded default templates', count: defaults.length });
  } catch (err) {
    console.error('Seed error:', err.message);
    res.status(500).json({ error: 'Failed to seed templates' });
  }
});

export default router;
