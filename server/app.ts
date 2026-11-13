import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.ts';
import validationRoutes from './routes/validationRoutes.ts';
import complaintRoutes from './routes/complaintRoutes.ts';
import routingRoutes from './routes/routingRoutes.ts';
import handlerRoutes from './routes/handlerRoutes.ts';
import analyticsRoutes from './routes/analyticsRoutes.ts';
import adminRoutes from './routes/adminRoutes.ts';

export function createApiApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'foodguard-complaint-tracker', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api', validationRoutes);
  app.use('/api/complaints', complaintRoutes);
  app.use('/api/routing', routingRoutes);
  app.use('/api/handlers', handlerRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/admin', adminRoutes);

  app.use('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ success: false, message: 'API endpoint not found.' });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled API error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
    });
  });

  return app;
}
