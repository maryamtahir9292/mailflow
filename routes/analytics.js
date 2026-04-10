import { Router } from 'express';
import Ticket from '../models/Ticket.js';
import EmailStatus from '../models/EmailStatus.js';
import User from '../models/User.js';
import { requireTokens } from '../lib/middleware.js';
import { isDBConnected, connectDB } from '../lib/db.js';

const router = Router();

// Safely run an aggregation/query — returns fallback on any error
async function safe(fn, fallback) {
  try { return await fn(); } catch { return fallback; }
}

// ── GET /api/analytics/overview ─────────────────────────────────────────────
router.get('/overview', requireTokens, async (req, res) => {
  // Ensure DB is connected — try connecting if not yet (handles cold starts)
  if (!isDBConnected()) {
    await connectDB();
  }
  // If still not connected, return empty dashboard rather than an error
  if (!isDBConnected()) {
    return res.json({
      summary: { totalTickets: 0, todayTickets: 0, weekTickets: 0, resolvedTickets: 0, openTickets: 0, resolutionRate: 0, emailsDone: 0, emailsPending: 0, emailsAwaiting: 0 },
      resolution: { avgHours: 0, minHours: 0, maxHours: 0, resolvedCount: 0 },
      statusBreakdown: { new: 0, open: 0, pending: 0, resolved: 0, closed: 0 },
      priorityBreakdown: { low: 0, medium: 0, high: 0, urgent: 0 },
      categoryBreakdown: [], dailyVolume: [], agentPerformance: [], recentActivity: [],
    });
  }

  try {
    const now = new Date();
    const today   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo  = new Date(today.getTime() - 7  * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalTickets,
      ticketsByStatus,
      ticketsByCategory,
      ticketsByPriority,
      todayTickets,
      weekTickets,
      resolvedTickets,
      avgResolutionData,
      dailyVolume,
      agentPerformance,
      emailStatusCounts,
      recentActivity,
    ] = await Promise.all([
      safe(() => Ticket.countDocuments(), 0),
      safe(() => Ticket.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]), []),
      safe(() => Ticket.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]), []),
      safe(() => Ticket.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }]), []),
      safe(() => Ticket.countDocuments({ createdAt: { $gte: today } }), 0),
      safe(() => Ticket.countDocuments({ createdAt: { $gte: weekAgo } }), 0),
      safe(() => Ticket.countDocuments({ status: { $in: ['resolved', 'closed'] } }), 0),
      safe(() => Ticket.aggregate([
        { $match: { resolvedAt: { $ne: null }, createdAt: { $ne: null } } },
        { $project: { resolutionMs: { $subtract: ['$resolvedAt', '$createdAt'] } } },
        { $group: { _id: null, avgMs: { $avg: '$resolutionMs' }, minMs: { $min: '$resolutionMs' }, maxMs: { $max: '$resolutionMs' }, count: { $sum: 1 } } },
      ]), []),
      safe(() => Ticket.aggregate([
        { $match: { createdAt: { $gte: monthAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]), []),
      safe(() => Ticket.aggregate([
        { $match: { assignedTo: { $ne: null } } },
        { $group: { _id: '$assignedTo', total: { $sum: 1 }, resolved: { $sum: { $cond: [{ $in: ['$status', ['resolved', 'closed']] }, 1, 0] } }, open: { $sum: { $cond: [{ $in: ['$status', ['new', 'open', 'pending']] }, 1, 0] } } } },
        { $sort: { total: -1 } },
        { $limit: 10 },
      ]), []),
      safe(() => EmailStatus.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]), []),
      safe(() => Ticket.aggregate([
        { $match: { 'activity.0': { $exists: true } } },
        { $unwind: '$activity' },
        { $sort: { 'activity.at': -1 } },
        { $limit: 20 },
        { $project: { ticketNumber: 1, subject: 1, 'activity.type': 1, 'activity.from': 1, 'activity.to': 1, 'activity.note': 1, 'activity.at': 1, 'activity.by': 1 } },
      ]), []),
    ]);

    // Resolve agent names — only if we have ids
    const agentIds       = agentPerformance.map((a) => a._id).filter(Boolean);
    const activityUserIds = recentActivity.map((a) => a.activity?.by).filter(Boolean);
    const allUserIds      = [...new Set([...agentIds, ...activityUserIds])];
    const users = allUserIds.length
      ? await safe(() => User.find({ _id: { $in: allUserIds } }, { name: 1, email: 1, picture: 1 }).lean(), [])
      : [];
    const userMap = {};
    users.forEach((u) => { userMap[u._id.toString()] = u; });

    // Format breakdowns
    const statusMap = { new: 0, open: 0, pending: 0, resolved: 0, closed: 0 };
    ticketsByStatus.forEach((s) => { if (s._id) statusMap[s._id] = s.count; });

    const priorityMap = { low: 0, medium: 0, high: 0, urgent: 0 };
    ticketsByPriority.forEach((p) => { if (p._id) priorityMap[p._id] = p.count; });

    // Map pipeline statuses back for the summary card
    const emailResolvedCount = emailStatusCounts
      .filter(e => ['resolved', 'done'].includes(e._id))
      .reduce((s, e) => s + e.count, 0);
    const emailPendingCount = emailStatusCounts
      .filter(e => ['new', 'open', 'pending'].includes(e._id))
      .reduce((s, e) => s + e.count, 0);
    const emailAwaitingCount = emailStatusCounts.find(e => e._id === 'awaiting_reply')?.count || 0;

    const resolution = avgResolutionData[0] || { avgMs: 0, minMs: 0, maxMs: 0, count: 0 };
    const msToHours  = (ms) => Math.round(((ms || 0) / (1000 * 60 * 60)) * 10) / 10;

    res.json({
      summary: {
        totalTickets, todayTickets, weekTickets, resolvedTickets,
        openTickets: totalTickets - resolvedTickets,
        resolutionRate: totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0,
        emailsDone: emailResolvedCount,
        emailsPending: emailPendingCount,
        emailsAwaiting: emailAwaitingCount,
      },
      resolution: {
        avgHours: msToHours(resolution.avgMs), minHours: msToHours(resolution.minMs),
        maxHours: msToHours(resolution.maxMs), resolvedCount: resolution.count,
      },
      statusBreakdown:   statusMap,
      priorityBreakdown: priorityMap,
      categoryBreakdown: ticketsByCategory.map((c) => ({ category: c._id || 'general', count: c.count })),
      dailyVolume:       dailyVolume.map((d) => ({ date: d._id, count: d.count })),
      agentPerformance:  agentPerformance.map((a) => ({
        agent: userMap[a._id?.toString()] || { name: 'Unassigned' },
        total: a.total, resolved: a.resolved, open: a.open,
        resolutionRate: a.total > 0 ? Math.round((a.resolved / a.total) * 100) : 0,
      })),
      recentActivity: recentActivity.map((a) => ({
        ticketNumber: a.ticketNumber, subject: a.subject, ...a.activity,
        user: a.activity?.by ? userMap[a.activity.by.toString()] : null,
      })),
    });
  } catch (err) {
    console.error('Analytics error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to load analytics', detail: err.message });
  }
});

export default router;
