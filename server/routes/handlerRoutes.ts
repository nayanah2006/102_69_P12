import mongoose from 'mongoose';
import { Router, type Response } from 'express';
import { Handler } from '../models/Handler.ts';
import {
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';

const router = Router();

router.get('/', async (_req, res: Response) => {
  try {
    const handlers: any[] = await mongoose.model('Handler').find({} as any).sort({ zone: 1, isPrimary: -1, officerCode: 1 });
    res.json({ success: true, handlers });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to load handlers.',
    });
  }
});

router.put(
  '/:id/availability',
  requireAuth,
  requireRole(['handler', 'admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { isAvailable } = req.body as { isAvailable?: boolean };
      if (typeof isAvailable !== 'boolean') {
        res.status(400).json({
          success: false,
          message: 'Boolean isAvailable field is required.',
        });
        return;
      }

      const handler: any = await mongoose.model('Handler').findById(req.params.id);
      if (!handler) {
        res.status(404).json({ success: false, message: 'Handler not found.' });
        return;
      }

      if (
        req.user?.role === 'handler' &&
        String(handler.userId) !== req.user.userId &&
        String(handler._id) !== req.user.handlerProfileId
      ) {
        res.status(403).json({
          success: false,
          message: 'Handlers can only modify their own availability.',
        });
        return;
      }

      handler.isAvailable = isAvailable;
      await handler.save();

      res.json({
        success: true,
        message: `${handler.name} availability set to ${isAvailable ? 'Available' : 'Unavailable'}.`,
        handler,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update handler availability.',
      });
    }
  }
);

router.put(
  '/:id/capacity',
  requireAuth,
  requireRole(['handler', 'admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { maxCapacity } = req.body as { maxCapacity?: number };
      if (typeof maxCapacity !== 'number' || !Number.isInteger(maxCapacity) || maxCapacity < 1 || maxCapacity > 100) {
        res.status(400).json({
          success: false,
          message: 'maxCapacity must be an integer between 1 and 100.',
        });
        return;
      }

      const handler: any = await mongoose.model('Handler').findById(req.params.id);
      if (!handler) {
        res.status(404).json({ success: false, message: 'Handler not found.' });
        return;
      }

      if (
        req.user?.role === 'handler' &&
        String(handler.userId) !== req.user.userId &&
        String(handler._id) !== req.user.handlerProfileId
      ) {
        res.status(403).json({
          success: false,
          message: 'Handlers can only modify their own workload capacity.',
        });
        return;
      }

      handler.maxCapacity = maxCapacity;
      await handler.save();

      res.json({
        success: true,
        message: `${handler.name} capacity updated to ${maxCapacity}.`,
        handler,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update handler capacity.',
      });
    }
  }
);

export default router;
