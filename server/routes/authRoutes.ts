import mongoose from 'mongoose';
import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { User, type UserRole } from '../models/User.ts';
import { Handler } from '../models/Handler.ts';
import {
  requireAuth,
  signAuthToken,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, mobile, password, role, zone } = req.body as {
      name?: string;
      email?: string;
      mobile?: string;
      password?: string;
      role?: UserRole;
      zone?: string;
    };

    if (!name || !email || !mobile || !password) {
      res.status(400).json({
        success: false,
        message: 'Name, email, mobile number, and password are required.',
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing: any = await mongoose.model('User').findOne({ email: normalizedEmail } as any);
    if (existing) {
      res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
      return;
    }

    const allowedRole: UserRole =
      role === 'handler' || role === 'admin' || role === 'citizen' ? role : 'citizen';

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      mobile: mobile.trim(),
      passwordHash,
      role: allowedRole,
    });

    if (allowedRole === 'handler') {
      const officerCode = `FSO-${Math.floor(500 + Math.random() * 499)}`;
      const handler = await Handler.create({
        userId: user._id,
        officerCode,
        name: user.name,
        email: user.email,
        phone: user.mobile,
        zone: zone || 'Zone 1',
        isPrimary: false,
        isAvailable: true,
        currentWorkload: 0,
        maxCapacity: 5,
        backupForZones: [zone || 'Zone 1'],
      });
      user.handlerProfileId = handler._id;
      await user.save();
    }

    const token = signAuthToken({
      userId: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
      handlerProfileId: user.handlerProfileId ? String(user.handlerProfileId) : null,
    });

    res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      token,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        handlerProfileId: user.handlerProfileId ? String(user.handlerProfileId) : null,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Registration failed.',
    });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
      return;
    }

    const user: any = await mongoose.model('User').findOne({ email: email.trim().toLowerCase() } as any);
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
      return;
    }

    const token = signAuthToken({
      userId: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
      handlerProfileId: user.handlerProfileId ? String(user.handlerProfileId) : null,
    });

    res.json({
      success: true,
      message: 'Signed in successfully.',
      token,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        handlerProfileId: user.handlerProfileId ? String(user.handlerProfileId) : null,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Login failed.',
    });
  }
});

router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user: any = await mongoose.model('User').findById(req.user?.userId).select('-passwordHash');
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }
    res.json({
      success: true,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        handlerProfileId: user.handlerProfileId ? String(user.handlerProfileId) : null,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch user profile.',
    });
  }
});

export default router;
