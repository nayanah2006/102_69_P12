import { Router, type Response } from 'express';
import { Complaint } from '../models/Complaint.ts';
import { COMPLAINT_CATEGORIES } from '../../shared/classificationEngine.ts';
import { Escalation } from '../models/Escalation.ts';

const router = Router();

router.get('/summary', async (_req, res: Response) => {
  try {
    const allComplaints = await Complaint.find().lean();
    const total = allComplaints.length;
    const resolved = allComplaints.filter((c) => c.currentStatus === 'Resolved').length;
    const unresolved = total - resolved;
    const pending = allComplaints.filter((c) => c.currentStatus === 'Pending').length;
    const assigned = allComplaints.filter((c) => c.currentStatus === 'Assigned').length;
    const inProgress = allComplaints.filter((c) => c.currentStatus === 'In Progress').length;
    const criticalCount = allComplaints.filter((c) => c.priority === 'CRITICAL').length;
    const highPriorityCount = allComplaints.filter(
      (c) => c.priority === 'CRITICAL' || c.priority === 'HIGH'
    ).length;

    const now = Date.now();
    let slaCompliantCount = 0;
    let slaBreachedCount = 0;
    for (const c of allComplaints) {
      const deadlineMs = new Date(c.slaDeadline).getTime();
      if (c.currentStatus === 'Resolved' && c.resolutionTimestamp) {
        if (new Date(c.resolutionTimestamp).getTime() <= deadlineMs) {
          slaCompliantCount += 1;
        } else {
          slaBreachedCount += 1;
        }
      } else if (now <= deadlineMs) {
        slaCompliantCount += 1;
      } else {
        slaBreachedCount += 1;
      }
    }

    const slaComplianceRate = total > 0 ? Math.round((slaCompliantCount / total) * 100) : 100;

    // Monthly complaint statistics grouped by YYYY-MM
    const monthlyMap = new Map<string, { month: string; total: number; resolved: number; critical: number }>();
    for (const c of allComplaints) {
      const monthKey = (c.complaintDate || '').slice(0, 7) || new Date(c.submissionTimestamp).toISOString().slice(0, 7);
      const entry = monthlyMap.get(monthKey) || { month: monthKey, total: 0, resolved: 0, critical: 0 };
      entry.total += 1;
      if (c.currentStatus === 'Resolved') entry.resolved += 1;
      if (c.priority === 'CRITICAL') entry.critical += 1;
      monthlyMap.set(monthKey, entry);
    }
    const monthlyStats = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month));

    const openEscalations = await Escalation.countDocuments({ status: 'open' });

    res.json({
      success: true,
      summary: {
        total,
        resolved,
        unresolved,
        pending,
        assigned,
        inProgress,
        criticalCount,
        highPriorityCount,
        slaCompliantCount,
        slaBreachedCount,
        slaComplianceRate,
        openEscalations,
        monthlyStats,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to compute analytics summary.',
    });
  }
});

router.get('/categories', async (_req, res: Response) => {
  try {
    const agg = await Complaint.aggregate([
      {
        $group: {
          _id: '$detectedCategory',
          count: { $sum: 1 },
          resolved: {
            $sum: { $cond: [{ $eq: ['$currentStatus', 'Resolved'] }, 1, 0] },
          },
          critical: {
            $sum: { $cond: [{ $eq: ['$priority', 'CRITICAL'] }, 1, 0] },
          },
        },
      },
    ]);

    const aggMap = new Map(agg.map((item) => [item._id, item]));
    const categories = COMPLAINT_CATEGORIES.map((cat) => {
      const found = aggMap.get(cat);
      return {
        category: cat,
        count: found?.count || 0,
        resolved: found?.resolved || 0,
        unresolved: (found?.count || 0) - (found?.resolved || 0),
        critical: found?.critical || 0,
      };
    });

    res.json({ success: true, categories });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to compute category analytics.',
    });
  }
});

router.get('/zones', async (_req, res: Response) => {
  try {
    const agg = await Complaint.aggregate([
      {
        $group: {
          _id: '$assignedZone',
          count: { $sum: 1 },
          resolved: {
            $sum: { $cond: [{ $eq: ['$currentStatus', 'Resolved'] }, 1, 0] },
          },
          critical: {
            $sum: { $cond: [{ $eq: ['$priority', 'CRITICAL'] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const baseZones = ['Zone 1', 'Zone 2', 'Zone 3', 'Zone 4'];
    const aggMap = new Map(agg.map((item) => [item._id, item]));
    const zones = baseZones.map((zone) => {
      const found = aggMap.get(zone);
      return {
        zone,
        count: found?.count || 0,
        resolved: found?.resolved || 0,
        unresolved: (found?.count || 0) - (found?.resolved || 0),
        critical: found?.critical || 0,
      };
    });

    // Append Central Fallback Queue if any complaints landed there
    const fallback = aggMap.get('Central Fallback Queue');
    if (fallback) {
      zones.push({
        zone: 'Central Fallback Queue',
        count: fallback.count,
        resolved: fallback.resolved,
        unresolved: fallback.count - fallback.resolved,
        critical: fallback.critical,
      });
    }

    res.json({ success: true, zones });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to compute zone analytics.',
    });
  }
});

export default router;
