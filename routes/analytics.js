import { Router } from 'express';
import Ticket from '../models/Ticket.js';
import EmailStatus from '../models/EmailStatus.js';
import User from '../models/User.js';
import { requireAuth } from '../lib/middleware.js';

const router = Router();

// ── GET /api/analytics/overview ─────────────────────────────────────────────
// Returns all dashboard metrics in a single call
router.get('/overview', requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
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
      Ticket.countDocuments(),
      Ticket.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Ticket.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Ticket.aggregate([
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
      Ticket.countDocuments({ createdAt: { $gte: today } }),
      Ticket.countDocuments({ createdAt: { $gte: weekAgo } }),
      Ticket.countDocuments({ status: { $in: ['resolved', 'closed'] } }),
      Ticket.aggregate([
        { $match: { resolvedAt: { $ne: null }, createdAt: { $ne: null } } },
        { $project: { resolutionMs: { $subtract: ['$resolvedAt', '$createdAt'] } } },
        { $group: { _id: null, avgMs: { $avg: '$resolutionMs' }, minMs: { $min: '$resolutionMs' }, maxMs: { $max: '$resolutionMs' }, count: { $sum: 1 } } },
      ]),
      Ticket.aggregate([
        { $match: { createdAt: { $gte: monthAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Ticket.aggregate([
        { $match: { assignedTo: { $ne: null } } },
        { $group: { _id: '$assignedTo', total: { $sum: 1 }, resolved: { $sum: { $cond: [{ $in: ['$status', ['resolved', 'closed']] }, 1, 0] } }, open: { $sum: { $cond: [{ $in: ['$status', ['new', 'open', 'pending']] }, 1, 0] } } } },
        { $sort: { total: -1 } },
        { $limit: 10 },
      ]),
      EmailStatus.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Ticket.aggregate([
        { $unwind: '$activity' },
        { $sort: { 'activity.at': -1 } },
        { $limit: 20 },
        { $project: { ticketNumber: 1, subject: 1, 'activity.type': 1, 'activity.from': 1, 'activity.to': 1, 'activity.note': 1, 'activity.at': 1, 'activity.by': 1 } },
      ]),
    ]);

    // Resolve agent names
    const agentIds = agentPerformance.map((a) => a._id);
    const activityUserIds = recentActivity.map((a) => a.activity?.by).filter(Boolean);
    const allUserIds = [...new Set([...agentIds, ...activityUserIds])];
    const users = await User.find({ _id: { $in: allUserIds } }, { name: 1, email: 1, picture: 1 }).lean();
    const userMap = {};
    users.forEach((u) => { userMap[u._id.toString()] = u; });

    // Format breakdowns
    const statusMap = { new: 0, open: 0, pending: 0, resolved: 0, closed: 0 };
    ticketsByStatus.forEach((s) => { if (s._id) statusMap[s._id] = s.count; });

    const priorityMap = { low: 0, medium: 0, high: 0, urgent: 0 };
    ticketsByPriority.forEach((p) => { if (p._id) priorityMap[p._id] = p.count; });

    const emailDoneCount = emailStatusCounts.find((e) => e._id === 'done')?.count || 0;
    const emailPendingCount = emailStatusCounts.find((e) => e._id === 'pending')?.count || 0;

    const resolution = avgResolutionData[0] || { avgMs: 0, minMs: 0, maxMs: 0, count: 0 };
    const msToHours = (ms) => Math.round((ms / (1000 * 60 * 60)) * 10) / 10;

    res.json({
      summary: {
        totalTickets, todayTickets, weekTickets, resolvedTickets,
        openTickets: totalTickets - resolvedTickets,
        resolutionRate: totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0,
        emailsDone: emailDoneCount,
        emailsPending: emailPendingCount,
      },
      resolution: {
        avgHours: msToHours(resolution.avgMs), minHours: msToHours(resolution.minMs),
        maxHours: msToHours(resolution.maxMs), resolvedCount: resolution.count,
      },
      statusBreakdown: statusMap,
      priorityBreakdown: priorityMap,
      categoryBreakdown: ticketsByCategory.map((c) => ({ category: c._id || 'general', count: c.count })),
      dailyVolume: dailyVolume.map((d) => ({ date: d._id, count: d.count })),
      agentPerformance: agentPerformance.map((a) => ({
        agent: userMap[a._id.toString()] || { name: 'Unassigned' },
        total: a.total, resolved: a.resolved, open: a.open,
        resolutionRate: a.total > 0 ? Math.round((a.resolved / a.total) * 100) : 0,
      })),
      recentActivity: recentActivity.map((a) => ({
        ticketNumber: a.ticketNumber, subject: a.subject, ...a.activity,
        user: a.activity?.by ? userMap[a.activity.by.toString()] : null,
      })),
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

export default router;
