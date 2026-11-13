import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User } from '../models/User.ts';
import { Handler } from '../models/Handler.ts';
import { RoutingRule } from '../models/RoutingRule.ts';
import { Complaint } from '../models/Complaint.ts';
import { Classification } from '../models/Classification.ts';
import { Assignment } from '../models/Assignment.ts';
import { StatusHistory } from '../models/StatusHistory.ts';
import { validateComplaintIdentifier } from '../../shared/dfaValidator.ts';
import { classifyComplaint } from '../../shared/classificationEngine.ts';
import { getLocalTodayDateString } from '../../shared/dateValidator.ts';

let memoryServer: MongoMemoryServer | null = null;

export async function connectDatabase(options?: { ephemeral?: boolean }): Promise<string> {
  if (mongoose.connection.readyState === 1) {
    return process.env.MONGODB_URI || 'connected';
  }

  const externalUri = process.env.MONGODB_URI?.trim();
  if (externalUri) {
    await mongoose.connect(externalUri);
    return externalUri;
  }

  if (options?.ephemeral) {
    memoryServer = await MongoMemoryServer.create();
  } else {
    const dbPath = path.resolve(process.cwd(), '.mongodb-data');
    fs.mkdirSync(dbPath, { recursive: true });
    try {
      memoryServer = await MongoMemoryServer.create({
        instance: {
          dbPath,
          storageEngine: 'wiredTiger',
        },
      });
    } catch {
      // Fallback to ephemeral if persistent lock exists from crashed process
      memoryServer = await MongoMemoryServer.create();
    }
  }

  const uri = memoryServer.getUri();
  await mongoose.connect(uri);
  return uri;
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

/**
 * Seeds the 4 configurable district zones, primary & backup Food Safety Officers,
 * demo Citizen/Handler/Admin accounts, and initial baseline complaints if the database is empty.
 */
export async function seedInitialData(): Promise<void> {
  const existingRules = await RoutingRule.countDocuments();
  if (existingRules > 0) {
    return;
  }

  const passwordHash = await bcrypt.hash('Password@123', 10);

  // 1. Create 4 Primary Officers + 2 Backup Officers across 4 Zones
  const officer1 = await Handler.create({
    officerCode: 'FSO-101',
    name: 'Officer Rajesh Verma',
    email: 'officer1@foodguard.gov',
    phone: '+91-98450-10001',
    zone: 'Zone 1',
    isPrimary: true,
    isAvailable: true,
    currentWorkload: 0,
    maxCapacity: 5,
    backupForZones: ['Zone 2'],
  });

  const officer2 = await Handler.create({
    officerCode: 'FSO-201',
    name: 'Officer Meera Nair',
    email: 'officer2@foodguard.gov',
    phone: '+91-98450-10002',
    zone: 'Zone 2',
    isPrimary: true,
    isAvailable: true,
    currentWorkload: 0,
    maxCapacity: 5,
    backupForZones: ['Zone 1'],
  });

  const officer3 = await Handler.create({
    officerCode: 'FSO-301',
    name: 'Officer Arvind Kulkarni',
    email: 'officer3@foodguard.gov',
    phone: '+91-98450-10003',
    zone: 'Zone 3',
    isPrimary: true,
    isAvailable: true,
    currentWorkload: 0,
    maxCapacity: 5,
    backupForZones: ['Zone 4'],
  });

  const officer4 = await Handler.create({
    officerCode: 'FSO-401',
    name: 'Officer Priya Deshmukh',
    email: 'officer4@foodguard.gov',
    phone: '+91-98450-10004',
    zone: 'Zone 4',
    isPrimary: true,
    isAvailable: true,
    currentWorkload: 0,
    maxCapacity: 5,
    backupForZones: ['Zone 3'],
  });

  const backupNorth = await Handler.create({
    officerCode: 'FSO-901',
    name: 'Officer Vikramaditya Rao (Reserve)',
    email: 'backup.north@foodguard.gov',
    phone: '+91-98450-10901',
    zone: 'Zone 1',
    isPrimary: false,
    isAvailable: true,
    currentWorkload: 0,
    maxCapacity: 6,
    backupForZones: ['Zone 1', 'Zone 2'],
  });

  const backupSouth = await Handler.create({
    officerCode: 'FSO-902',
    name: 'Officer Kavitha Subramanian (Reserve)',
    email: 'backup.south@foodguard.gov',
    phone: '+91-98450-10902',
    zone: 'Zone 3',
    isPrimary: false,
    isAvailable: true,
    currentWorkload: 0,
    maxCapacity: 6,
    backupForZones: ['Zone 3', 'Zone 4'],
  });

  // 2. Create User Accounts (Citizen, Handlers, Admin)
  const citizenUser = await User.create({
    name: 'Ananya Sharma',
    email: 'citizen@foodguard.gov',
    mobile: '9876543210',
    passwordHash,
    role: 'citizen',
  });

  const handlerUser1 = await User.create({
    name: officer1.name,
    email: officer1.email,
    mobile: '9845010001',
    passwordHash,
    role: 'handler',
    handlerProfileId: officer1._id,
  });
  officer1.userId = handlerUser1._id as mongoose.Types.ObjectId;
  await officer1.save();

  const handlerUser2 = await User.create({
    name: officer2.name,
    email: officer2.email,
    mobile: '9845010002',
    passwordHash,
    role: 'handler',
    handlerProfileId: officer2._id,
  });
  officer2.userId = handlerUser2._id as mongoose.Types.ObjectId;
  await officer2.save();

  const handlerUser3 = await User.create({
    name: officer3.name,
    email: officer3.email,
    mobile: '9845010003',
    passwordHash,
    role: 'handler',
    handlerProfileId: officer3._id,
  });
  officer3.userId = handlerUser3._id as mongoose.Types.ObjectId;
  await officer3.save();

  const handlerUser4 = await User.create({
    name: officer4.name,
    email: officer4.email,
    mobile: '9845010004',
    passwordHash,
    role: 'handler',
    handlerProfileId: officer4._id,
  });
  officer4.userId = handlerUser4._id as mongoose.Types.ObjectId;
  await officer4.save();

  const adminUser = await User.create({
    name: 'Chief Food Safety Commissioner',
    email: 'admin@foodguard.gov',
    mobile: '9845000001',
    passwordHash,
    role: 'admin',
  });

  // 3. Create Configurable 4-Zone Routing Table
  await RoutingRule.insertMany([
    {
      prefix: 'ABC',
      zone: 'Zone 1',
      zoneName: 'Zone 1 — Central & Downtown District',
      primaryHandlerId: officer1._id,
      backupHandlerIds: [backupNorth._id, officer2._id],
      isActive: true,
      notes: 'Primary municipal commercial dining corridor.',
    },
    {
      prefix: 'DEF',
      zone: 'Zone 2',
      zoneName: 'Zone 2 — East & Tech Park District',
      primaryHandlerId: officer2._id,
      backupHandlerIds: [backupNorth._id, officer1._id],
      isActive: true,
      notes: 'East IT corridor and food courts.',
    },
    {
      prefix: 'GHI',
      zone: 'Zone 3',
      zoneName: 'Zone 3 — South & Heritage Market District',
      primaryHandlerId: officer3._id,
      backupHandlerIds: [backupSouth._id, officer4._id],
      isActive: true,
      notes: 'South market and traditional eateries.',
    },
    {
      prefix: 'JKL',
      zone: 'Zone 4',
      zoneName: 'Zone 4 — West & Transit Hub District',
      primaryHandlerId: officer4._id,
      backupHandlerIds: [backupSouth._id, officer3._id],
      isActive: true,
      notes: 'West highway, rail terminal, and cloud kitchens.',
    },
  ]);

  // 4. Seed 4 realistic baseline complaints across the 4 zones for immediate analytics & dashboard richness
  const todayStr = getLocalTodayDateString();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const yesterdayStr = getLocalTodayDateString(yesterday);
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const twoDaysAgoStr = getLocalTodayDateString(twoDaysAgo);

  const sampleRecords = [
    {
      reportId: 'CMP-2026-1001',
      identifier: `COMP-${todayStr}-ABC1234`,
      date: todayStr,
      restaurantName: 'Spice Garden Bistro',
      restaurantDistrict: 'Zone 1 — Central District',
      description: 'Found chemical mixing and synthetic dye in paneer gravy; suspected food adulteration.',
      userSelectedCategory: 'Adulteration',
      urgencyLevel: 'High',
      handler: officer1,
      zone: 'Zone 1',
      status: 'In Progress' as const,
      submissionTimestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
    },
    {
      reportId: 'CMP-2026-1002',
      identifier: `COMP-${yesterdayStr}-DEF2048`,
      date: yesterdayStr,
      restaurantName: 'Metro Wok Express',
      restaurantDistrict: 'Zone 2 — East Tech Park',
      description: 'Customer discovered plastic in food and hair in food during lunch delivery.',
      userSelectedCategory: 'Foreign Object',
      urgencyLevel: 'Standard',
      handler: officer2,
      zone: 'Zone 2',
      status: 'Assigned' as const,
      submissionTimestamp: new Date(Date.now() - 26 * 60 * 60 * 1000),
    },
    {
      reportId: 'CMP-2026-1003',
      identifier: `COMP-${yesterdayStr}-GHI3310`,
      date: yesterdayStr,
      restaurantName: 'Heritage Tiffin House',
      restaurantDistrict: 'Zone 3 — South Market',
      description: 'Dirty kitchen with cockroaches and poor sanitation near open food prep counters.',
      userSelectedCategory: 'Hygiene',
      urgencyLevel: 'High',
      handler: officer3,
      zone: 'Zone 3',
      status: 'Resolved' as const,
      submissionTimestamp: new Date(Date.now() - 36 * 60 * 60 * 1000),
    },
    {
      reportId: 'CMP-2026-1004',
      identifier: `COMP-${twoDaysAgoStr}-JKL4092`,
      date: twoDaysAgoStr,
      restaurantName: 'Transit Bakery & Cafe',
      restaurantDistrict: 'Zone 4 — West Hub',
      description: 'Packaged pastries sold with wrong expiry date and incorrect food labels.',
      userSelectedCategory: 'Mislabelling',
      urgencyLevel: 'Standard',
      handler: officer4,
      zone: 'Zone 4',
      status: 'Resolved' as const,
      submissionTimestamp: new Date(Date.now() - 52 * 60 * 60 * 1000),
    },
  ];

  for (const sample of sampleRecords) {
    const val = validateComplaintIdentifier(sample.identifier, { expectedComplaintDate: sample.date });
    const cls = classifyComplaint(sample.description, {
      userSelectedCategory: sample.userSelectedCategory,
      userUrgency: sample.urgencyLevel,
    });

    const slaDeadline = new Date(sample.submissionTimestamp.getTime() + cls.slaHours * 60 * 60 * 1000);
    const resolvedAt = sample.status === 'Resolved' ? new Date(sample.submissionTimestamp.getTime() + 18 * 60 * 60 * 1000) : null;

    const complaint = await Complaint.create({
      reportId: sample.reportId,
      userId: citizenUser._id,
      reporterName: citizenUser.name,
      reporterEmail: citizenUser.email,
      reporterMobile: citizenUser.mobile,
      restaurantName: sample.restaurantName,
      restaurantDistrict: sample.restaurantDistrict,
      originalIdentifier: sample.identifier,
      restoCode: val.extracted?.restoCode || sample.identifier.slice(-7),
      restoPrefix: val.extracted?.restoPrefix || sample.identifier.slice(-7, -4),
      complaintDate: sample.date,
      description: sample.description,
      validationOutcome: 'ACCEPTED',
      validationMessage: val.message,
      dfaFinalState: val.finalDfaState,
      regexMatched: val.regexAccepted,
      userSelectedCategory: sample.userSelectedCategory,
      detectedCategory: cls.category,
      matchedKeywords: cls.matchedKeywords,
      urgencyLevel: sample.urgencyLevel,
      priority: cls.priority,
      priorityOverride: cls.priorityOverride,
      slaHours: cls.slaHours,
      assignedZone: sample.zone,
      assignedHandlerId: sample.handler._id,
      assignedHandlerName: sample.handler.name,
      assignmentType: 'primary',
      routingDecisionLog: [
        `Extracted prefix '${val.extracted?.restoPrefix}' -> ${sample.zone}.`,
        `Assigned to primary officer ${sample.handler.name} (${sample.handler.officerCode}).`,
      ],
      currentStatus: sample.status,
      inWaitingQueue: false,
      escalated: false,
      submissionTimestamp: sample.submissionTimestamp,
      assignmentTimestamp: sample.submissionTimestamp,
      slaDeadline,
      resolutionTimestamp: resolvedAt,
    });

    const clsDoc = await Classification.create({
      complaintId: complaint._id,
      detectedCategory: cls.category,
      userSelectedCategory: sample.userSelectedCategory,
      matchedKeywords: cls.matchedKeywords,
      allMatchedByCategory: cls.allMatchedByCategory,
      categoryScores: cls.categoryScores,
      multipleMatchesDetected: cls.multipleMatchesDetected,
      deterministicRuleApplied: cls.deterministicRuleApplied,
      unknownKeywords: cls.unknownKeywords,
      needsAdminReview: cls.needsAdminReview,
      classificationSource: cls.classificationSource,
    });

    await Assignment.create({
      complaintId: complaint._id,
      reportId: complaint.reportId,
      zone: sample.zone,
      restoPrefix: complaint.restoPrefix,
      handlerId: sample.handler._id,
      handlerName: sample.handler.name,
      assignmentType: 'primary',
      priority: cls.priority,
      priorityOverride: cls.priorityOverride,
      assignedAt: sample.submissionTimestamp,
      routingDecisionLog: complaint.routingDecisionLog,
    });

    const h1 = await StatusHistory.create({
      complaintId: complaint._id,
      reportId: complaint.reportId,
      previousStatus: 'None',
      newStatus: 'Assigned',
      updatedBy: adminUser._id,
      updatedByName: 'Automated Routing Engine',
      updatedByRole: 'admin',
      timestamp: sample.submissionTimestamp,
      remarks: `Validated via DFA & Regex; assigned to ${sample.handler.name}.`,
    });

    const historyIds = [h1._id];

    if (sample.status === 'In Progress' || sample.status === 'Resolved') {
      const h2 = await StatusHistory.create({
        complaintId: complaint._id,
        reportId: complaint.reportId,
        previousStatus: 'Assigned',
        newStatus: 'In Progress',
        updatedBy: sample.handler.userId || adminUser._id,
        updatedByName: sample.handler.name,
        updatedByRole: 'handler',
        timestamp: new Date(sample.submissionTimestamp.getTime() + 2 * 60 * 60 * 1000),
        remarks: 'Field inspection initiated and food sample collection scheduled.',
      });
      historyIds.push(h2._id);
    }

    if (sample.status === 'Resolved' && resolvedAt) {
      const h3 = await StatusHistory.create({
        complaintId: complaint._id,
        reportId: complaint.reportId,
        previousStatus: 'In Progress',
        newStatus: 'Resolved',
        updatedBy: sample.handler.userId || adminUser._id,
        updatedByName: sample.handler.name,
        updatedByRole: 'handler',
        timestamp: resolvedAt,
        remarks: 'Inspection completed, corrective notice served, and compliance verified.',
      });
      historyIds.push(h3._id);
    } else {
      // Active unresolved complaints count toward officer's active workload
      await mongoose.model('Handler').findByIdAndUpdate(
        sample.handler._id,
        { $inc: { currentWorkload: 1 } },
        { new: true } as any
      );
    }

    complaint.classificationId = clsDoc._id as mongoose.Types.ObjectId;
    complaint.statusHistory = historyIds as mongoose.Types.ObjectId[];
    await complaint.save();
  }
}
