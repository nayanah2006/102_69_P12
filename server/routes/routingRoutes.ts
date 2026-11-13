import mongoose from 'mongoose';
import { Router, type Response } from 'express';
import { RoutingRule } from '../models/RoutingRule.ts';
import { Complaint, type IComplaint } from '../models/Complaint.ts';
import { Escalation } from '../models/Escalation.ts';
import { Assignment } from '../models/Assignment.ts';
import { Handler } from '../models/Handler.ts';
import {
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';
import {
  dispatchWaitingQueue,
  sortComplaintsDeterministically,
} from '../engines/routingEngine.ts';

const router = Router();

/**
 * GET /api/routing/table
 * Returns configurable 4-zone routing table, officers, workloads, and backup assignments.
 */
router.get('/table', async (_req, res: Response) => {
  try {
    const rules = await mongoose.model('RoutingRule').find({} as any)
      .populate('primaryHandlerId', 'officerCode name email phone zone isAvailable currentWorkload maxCapacity')
      .populate('backupHandlerIds', 'officerCode name email phone zone isAvailable currentWorkload maxCapacity')
      .sort({ zone: 1, prefix: 1 });

    const handlers = await mongoose.model('Handler').find({} as any).sort({ zone: 1, officerCode: 1 });

    res.json({
      success: true,
      rules,
      handlers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to load routing table.',
    });
  }
});

/**
 * POST /api/routing/table
 * Allows administrators to add a new configurable prefix -> zone -> officer mapping.
 */
router.post(
  '/table',
  requireAuth,
  requireRole(['admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { prefix, zone, zoneName, primaryHandlerId, backupHandlerIds, notes } = req.body as {
        prefix?: string;
        zone?: string;
        zoneName?: string;
        primaryHandlerId?: string;
        backupHandlerIds?: string[];
        notes?: string;
      };

      const cleanPrefix = prefix?.trim().toUpperCase();
      if (!cleanPrefix || !/^[A-Z]{3}$/.test(cleanPrefix)) {
        res.status(400).json({
          success: false,
          message: 'Restaurant code prefix must be exactly 3 uppercase letters [A-Z]{3}.',
        });
        return;
      }

      if (!zone || !primaryHandlerId) {
        res.status(400).json({
          success: false,
          message: 'Zone and primary officer are required.',
        });
        return;
      }

      const existing = await mongoose.model('RoutingRule').findOne({ prefix: cleanPrefix } as any);
      if (existing) {
        res.status(409).json({
          success: false,
          message: `Routing rule for prefix '${cleanPrefix}' already exists.`,
        });
        return;
      }

      const rule = await RoutingRule.create({
        prefix: cleanPrefix,
        zone: zone.trim(),
        zoneName: zoneName?.trim() || zone.trim(),
        primaryHandlerId,
        backupHandlerIds: backupHandlerIds || [],
        notes: notes || '',
      });

      const populated = await mongoose.model('RoutingRule').findById(rule._id)
        .populate('primaryHandlerId', 'officerCode name email phone zone isAvailable currentWorkload maxCapacity')
        .populate('backupHandlerIds', 'officerCode name email phone zone isAvailable currentWorkload maxCapacity');

      res.status(201).json({
        success: true,
        message: `Routing rule '${cleanPrefix}' -> ${zone} created.`,
        rule: populated,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create routing rule.',
      });
    }
  }
);

/**
 * PUT /api/routing/table/:id
 * Allows administrators to reconfigure a routing rule's zone, primary officer, or backups.
 */
router.put(
  '/table/:id',
  requireAuth,
  requireRole(['admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { zone, zoneName, primaryHandlerId, backupHandlerIds, isActive, notes } = req.body;
      const updated = await mongoose.model('RoutingRule').findByIdAndUpdate(
        req.params.id,
        {
          ...(zone !== undefined ? { zone } : {}),
          ...(zoneName !== undefined ? { zoneName } : {}),
          ...(primaryHandlerId !== undefined ? { primaryHandlerId } : {}),
          ...(backupHandlerIds !== undefined ? { backupHandlerIds } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
          ...(notes !== undefined ? { notes } : {}),
        },
        { new: true } as any
      )
        .populate('primaryHandlerId', 'officerCode name email phone zone isAvailable currentWorkload maxCapacity')
        .populate('backupHandlerIds', 'officerCode name email phone zone isAvailable currentWorkload maxCapacity');

      if (!updated) {
        res.status(404).json({ success: false, message: 'Routing rule not found.' });
        return;
      }

      res.json({
        success: true,
        message: `Routing rule '${updated.prefix}' updated.`,
        rule: updated,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update routing rule.',
      });
    }
  }
);

/**
 * GET /api/routing/queue
 * Returns deterministic waiting queue, escalations, backup assignments, and priority overrides.
 */
router.get('/queue', async (_req, res: Response) => {
  try {
    const queuedRaw: IComplaint[] = await mongoose.model('Complaint').find({
      inWaitingQueue: true,
      currentStatus: 'Pending',
    } as any);

    const queue = sortComplaintsDeterministically(queuedRaw);
    const escalations = await mongoose.model('Escalation').find({} as any).sort({ escalatedAt: -1 }).limit(50);
    const recentAssignments = await mongoose.model('Assignment').find({} as any)
      .populate('handlerId', 'officerCode name zone')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      queue,
      escalations,
      recentAssignments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to load routing queue.',
    });
  }
});

/**
 * POST /api/routing/dispatch
 * Runs deterministic waiting queue dispatcher for pending/escalated complaints.
 */
router.post(
  '/dispatch',
  requireAuth,
  requireRole(['admin', 'handler']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await dispatchWaitingQueue({
        userId: req.user?.userId,
        name: req.user?.name,
        role: req.user?.role,
      });

      res.json({
        success: true,
        message: `Processed ${result.processed} queued complaint(s); assigned ${result.assigned}.`,
        result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Queue dispatch failed.',
      });
    }
  }
);

export default router;
