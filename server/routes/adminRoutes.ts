import mongoose from 'mongoose';
import { Router, type Response } from 'express';
import { User } from '../models/User.ts';
import { Classification } from '../models/Classification.ts';
import {
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';

const router = Router();

router.get('/users', requireAuth, requireRole(['admin']), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await mongoose.model('User').find({} as any)
      .select('-passwordHash')
      .populate('handlerProfileId', 'officerCode zone isAvailable currentWorkload maxCapacity')
      .sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to list users.',
    });
  }
});

router.get('/classifications/review', requireAuth, requireRole(['admin']), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const items = await mongoose.model('Classification').find({ needsAdminReview: true } as any)
      .populate('complaintId', 'reportId restaurantName originalIdentifier description detectedCategory priority currentStatus')
      .sort({ createdAt: -1 });
    res.json({ success: true, items });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch pending classification reviews.',
    });
  }
});

export default router;
