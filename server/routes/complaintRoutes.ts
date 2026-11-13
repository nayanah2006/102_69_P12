import { Router, type Response } from 'express';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { Complaint } from '../models/Complaint.ts';
import { Classification } from '../models/Classification.ts';
import { Assignment } from '../models/Assignment.ts';
import { Escalation } from '../models/Escalation.ts';
import { Handler } from '../models/Handler.ts';
import { COMPLAINT_STATUSES, StatusHistory, type ComplaintStatus } from '../models/StatusHistory.ts';
import {
  optionalAuth,
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';
import { validateComplaintIdentifier } from '../../shared/dfaValidator.ts';
import { validateCalendarDate } from '../../shared/dateValidator.ts';
import {
  classifyComplaint,
  isValidComplaintCategory,
} from '../../shared/classificationEngine.ts';
import { routeValidatedComplaint } from '../engines/routingEngine.ts';

const router = Router();

function generateUniqueReportId(): string {
  const year = new Date().getFullYear();
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `CMP-${year}-${suffix}`;
}

/**
 * POST /api/complaints
 * Submits, validates (DFA + Regex + Calendar Date), classifies, routes, and persists a complaint.
 */
router.post('/', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      reporterName,
      reporterEmail,
      reporterMobile,
      restaurantName,
      restaurantDistrict,
      originalIdentifier,
      complaintDate,
      complaintCategory,
      description,
      urgencyLevel,
    } = req.body as Record<string, string | undefined>;

    if (
      !reporterName?.trim() ||
      !reporterEmail?.trim() ||
      !reporterMobile?.trim() ||
      !restaurantName?.trim() ||
      !restaurantDistrict?.trim() ||
      !description?.trim()
    ) {
      res.status(400).json({
        success: false,
        message:
          'All reporter details, restaurant name, district, identifier, date, and description are required.',
      });
      return;
    }

    // 1. Strict calendar date validation
    const dateCheck = validateCalendarDate(complaintDate);
    if (!dateCheck.isValid) {
      res.status(400).json({
        success: false,
        errorCode: dateCheck.errorCode,
        message: dateCheck.message,
        dateValidation: dateCheck,
      });
      return;
    }

    // 2. Dual DFA + Regex + extracted date identifier validation
    const idValidation = validateComplaintIdentifier(originalIdentifier, {
      expectedComplaintDate: dateCheck.normalizedDate || complaintDate,
    });
    if (!idValidation.isValid || !idValidation.extracted) {
      res.status(400).json({
        success: false,
        errorCode: idValidation.errorCode,
        message: idValidation.message,
        validation: idValidation,
      });
      return;
    }

    // 3. Duplicate complaint prevention
    const existingByIdentifier: any = await mongoose.model('Complaint').findOne({
      originalIdentifier: idValidation.identifier,
    } as any);
    if (existingByIdentifier) {
      res.status(409).json({
        success: false,
        errorCode: 'DUPLICATE_COMPLAINT',
        message: `Duplicate complaint rejected: identifier '${idValidation.identifier}' is already registered under ${existingByIdentifier.reportId}.`,
        existingReportId: existingByIdentifier.reportId,
      });
      return;
    }

    // 4. Classification engine
    const classification = classifyComplaint(description, {
      userSelectedCategory: complaintCategory,
      userUrgency: urgencyLevel,
    });

    const normalizedEmail = reporterEmail.trim().toLowerCase();
    const existingSemanticDuplicate: any = await mongoose.model('Complaint').findOne({
      reporterEmail: normalizedEmail,
      restaurantName: restaurantName.trim(),
      complaintDate: dateCheck.normalizedDate,
      detectedCategory: classification.category,
      currentStatus: { $ne: 'Resolved' },
    } as any);
    if (existingSemanticDuplicate) {
      res.status(409).json({
        success: false,
        errorCode: 'DUPLICATE_COMPLAINT',
        message: `An active ${classification.category} complaint for '${restaurantName.trim()}' on ${dateCheck.normalizedDate} already exists (${existingSemanticDuplicate.reportId}).`,
        existingReportId: existingSemanticDuplicate.reportId,
      });
      return;
    }

    // 5. Intelligent 4-Zone Routing & Dispatch
    const routing = await routeValidatedComplaint({
      validation: idValidation,
      priority: classification.priority,
      priorityOverride: classification.priorityOverride,
    });

    const reportId = generateUniqueReportId();
    const submissionTimestamp = new Date();
    const slaDeadline = new Date(
      submissionTimestamp.getTime() + classification.slaHours * 60 * 60 * 1000
    );

    const complaint = await Complaint.create({
      reportId,
      userId: req.user?.userId ? new mongoose.Types.ObjectId(req.user.userId) : null,
      reporterName: reporterName.trim(),
      reporterEmail: normalizedEmail,
      reporterMobile: reporterMobile.trim(),
      restaurantName: restaurantName.trim(),
      restaurantDistrict: restaurantDistrict.trim(),
      originalIdentifier: idValidation.identifier,
      restoCode: idValidation.extracted.restoCode,
      restoPrefix: idValidation.extracted.restoPrefix,
      complaintDate: dateCheck.normalizedDate!,
      description: description.trim(),
      validationOutcome: 'ACCEPTED',
      validationMessage: idValidation.message,
      dfaFinalState: idValidation.finalDfaState,
      regexMatched: idValidation.regexAccepted,
      userSelectedCategory: complaintCategory || '',
      detectedCategory: classification.category,
      matchedKeywords: classification.matchedKeywords,
      urgencyLevel: urgencyLevel || 'Standard',
      priority: classification.priority,
      priorityOverride: classification.priorityOverride,
      slaHours: classification.slaHours,
      assignedZone: routing.zone,
      assignedHandlerId: routing.handlerId,
      assignedHandlerName: routing.handlerName,
      assignmentType: routing.assignmentType,
      routingDecisionLog: routing.routingDecisionLog,
      currentStatus: routing.currentStatus,
      inWaitingQueue: routing.inWaitingQueue,
      escalated: routing.escalated,
      submissionTimestamp,
      assignmentTimestamp: routing.assignedAt,
      slaDeadline,
      resolutionTimestamp: null,
    });

    const classificationDoc = await Classification.create({
      complaintId: complaint._id,
      detectedCategory: classification.category,
      userSelectedCategory: complaintCategory || '',
      matchedKeywords: classification.matchedKeywords,
      allMatchedByCategory: classification.allMatchedByCategory,
      categoryScores: classification.categoryScores,
      multipleMatchesDetected: classification.multipleMatchesDetected,
      deterministicRuleApplied: classification.deterministicRuleApplied,
      unknownKeywords: classification.unknownKeywords,
      needsAdminReview: classification.needsAdminReview,
      classificationSource: classification.classificationSource,
    });

    await Assignment.create({
      complaintId: complaint._id,
      reportId: complaint.reportId,
      zone: routing.zone,
      restoPrefix: idValidation.extracted.restoPrefix,
      handlerId: routing.handlerId,
      handlerName: routing.handlerName,
      assignmentType: routing.assignmentType,
      priority: classification.priority,
      priorityOverride: classification.priorityOverride,
      assignedAt: routing.assignedAt,
      routingDecisionLog: routing.routingDecisionLog,
    });

    if (routing.escalated && routing.escalationReason) {
      await Escalation.create({
        complaintId: complaint._id,
        reportId: complaint.reportId,
        reason: routing.escalationReason,
        zone: routing.zone,
        priority: classification.priority,
        status: routing.handlerId ? 'resolved' : 'open',
        escalatedAt: submissionTimestamp,
        resolvedAt: routing.handlerId ? submissionTimestamp : null,
        notes: routing.routingDecisionLog.join(' | '),
      });
    }

    const initialHistory = await StatusHistory.create({
      complaintId: complaint._id,
      reportId: complaint.reportId,
      previousStatus: 'None',
      newStatus: routing.currentStatus,
      updatedBy: req.user?.userId ? new mongoose.Types.ObjectId(req.user.userId) : null,
      updatedByName: req.user?.name || reporterName.trim(),
      updatedByRole: req.user?.role || 'citizen',
      timestamp: submissionTimestamp,
      remarks:
        routing.currentStatus === 'Assigned'
          ? `Complaint validated (DFA & Regex) and assigned to ${routing.handlerName} (${routing.zone}, ${routing.assignmentType} assignment).`
          : `Complaint validated (DFA & Regex) and placed in ${routing.zone} waiting queue.`,
    });

    complaint.classificationId = classificationDoc._id as mongoose.Types.ObjectId;
    complaint.statusHistory = [initialHistory._id as mongoose.Types.ObjectId];
    await complaint.save();

    const populated = await mongoose.model('Complaint').findById(complaint._id)
      .populate('classificationId')
      .populate('statusHistory')
      .populate('assignedHandlerId', 'name officerCode zone email phone isAvailable');

    res.status(201).json({
      success: true,
      message: 'Complaint submitted, validated, classified, and routed successfully.',
      complaint: populated,
      validation: idValidation,
      classification,
      routing,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to submit complaint.',
    });
  }
});

/**
 * GET /api/complaints
 * Role-scoped complaint listing with search and filtering.
 */
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, status, category, zone } = req.query as Record<string, string | undefined>;
    const filter: Record<string, unknown> = {};

    if (req.user?.role === 'citizen') {
      filter.$or = [
        { userId: new mongoose.Types.ObjectId(req.user.userId) },
        { reporterEmail: req.user.email },
      ];
    } else if (req.user?.role === 'handler') {
      if (req.user.handlerProfileId) {
        filter.assignedHandlerId = new mongoose.Types.ObjectId(req.user.handlerProfileId);
      } else {
        const handlerDoc: any = await mongoose.model('Handler').findOne({ userId: req.user.userId } as any);
        if (handlerDoc) {
          filter.assignedHandlerId = handlerDoc._id;
        } else {
          res.json({ success: true, complaints: [] });
          return;
        }
      }
    }

    if (status && status !== 'All') {
      filter.currentStatus = status;
    }
    if (category && category !== 'All') {
      filter.detectedCategory = category;
    }
    if (zone && zone !== 'All') {
      filter.assignedZone = zone;
    }
    if (search && search.trim()) {
      const q = search.trim();
      filter.$and = [
        ...(Array.isArray(filter.$and) ? filter.$and : []),
        {
          $or: [
            { reportId: { $regex: q, $options: 'i' } },
            { originalIdentifier: { $regex: q, $options: 'i' } },
            { restaurantName: { $regex: q, $options: 'i' } },
          ],
        },
      ];
    }

    const complaints = await mongoose.model('Complaint').find(filter as any)
      .populate('statusHistory')
      .populate('classificationId')
      .populate('assignedHandlerId', 'name officerCode zone email phone isAvailable currentWorkload maxCapacity')
      .sort({ submissionTimestamp: -1 });

    res.json({
      success: true,
      count: complaints.length,
      complaints,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch complaints.',
    });
  }
});

/**
 * GET /api/complaints/track/:reportId
 * Track complaint progress by unique reportId (e.g., CMP-2026-...) or originalIdentifier.
 */
router.get('/track/:reportId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const key = req.params.reportId?.trim();
    if (!key) {
      res.status(400).json({ success: false, message: 'Report ID is required.' });
      return;
    }

    const complaint = await mongoose.model('Complaint').findOne({
      $or: [{ reportId: key }, { originalIdentifier: key }],
    } as any)
      .populate('statusHistory')
      .populate('classificationId')
      .populate('assignedHandlerId', 'name officerCode zone email phone');

    if (!complaint) {
      res.status(404).json({
        success: false,
        message: `No complaint found matching '${key}'.`,
      });
      return;
    }

    res.json({
      success: true,
      complaint,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to track complaint.',
    });
  }
});

/**
 * GET /api/complaints/:id
 */
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const idParam = req.params.id;
    const query = mongoose.isValidObjectId(idParam)
      ? { _id: idParam }
      : { reportId: idParam };

    const complaint: any = await mongoose.model('Complaint').findOne(query as any)
      .populate('statusHistory')
      .populate('classificationId')
      .populate('assignedHandlerId', 'name officerCode zone email phone isAvailable currentWorkload maxCapacity');

    if (!complaint) {
      res.status(404).json({ success: false, message: 'Complaint not found.' });
      return;
    }

    if (
      req.user?.role === 'citizen' &&
      String(complaint.userId) !== req.user.userId &&
      complaint.reporterEmail !== req.user.email
    ) {
      res.status(403).json({
        success: false,
        message: 'Citizens can only view their own complaints.',
      });
      return;
    }

    res.json({ success: true, complaint });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch complaint details.',
    });
  }
});

/**
 * PUT /api/complaints/:id/status
 * Updates complaint status with full audit history and handler workload release on resolution.
 */
router.put(
  '/:id/status',
  requireAuth,
  requireRole(['handler', 'admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { newStatus, remarks } = req.body as {
        newStatus?: ComplaintStatus;
        remarks?: string;
      };

      if (!newStatus || !(COMPLAINT_STATUSES as readonly string[]).includes(newStatus)) {
        res.status(400).json({
          success: false,
          message: `Invalid status. Allowed values: ${COMPLAINT_STATUSES.join(', ')}.`,
        });
        return;
      }

      const idParam = req.params.id;
      const query = mongoose.isValidObjectId(idParam)
        ? { _id: idParam }
        : { reportId: idParam };

      const complaint: any = await mongoose.model('Complaint').findOne(query as any);
      if (!complaint) {
        res.status(404).json({ success: false, message: 'Complaint not found.' });
        return;
      }

      // Handlers can only update complaints assigned to them
      if (req.user?.role === 'handler') {
        const handlerDoc: any =
          (req.user.handlerProfileId
            ? await mongoose.model('Handler').findById(req.user.handlerProfileId)
            : null) || (await mongoose.model('Handler').findOne({ userId: req.user.userId } as any));

        if (!handlerDoc || String(complaint.assignedHandlerId) !== String(handlerDoc._id)) {
          res.status(403).json({
            success: false,
            message: 'Handlers can only update complaints assigned to them.',
          });
          return;
        }
      }

      const previousStatus = complaint.currentStatus;
      const now = new Date();

      const historyEntry = await StatusHistory.create({
        complaintId: complaint._id,
        reportId: complaint.reportId,
        previousStatus,
        newStatus,
        updatedBy: req.user?.userId ? new mongoose.Types.ObjectId(req.user.userId) : null,
        updatedByName: req.user?.name || 'System Officer',
        updatedByRole: req.user?.role || 'handler',
        timestamp: now,
        remarks: remarks?.trim() || `Status updated from ${previousStatus} to ${newStatus}.`,
      });

      complaint.currentStatus = newStatus;
      complaint.statusHistory.push(historyEntry._id as mongoose.Types.ObjectId);
      if (newStatus !== 'Pending') {
        complaint.inWaitingQueue = false;
      }

      // Release handler capacity slot when transitioning to Resolved
      if (newStatus === 'Resolved' && previousStatus !== 'Resolved') {
        complaint.resolutionTimestamp = now;
        if (complaint.assignedHandlerId) {
          await mongoose.model('Handler').findOneAndUpdate(
            { _id: complaint.assignedHandlerId, currentWorkload: { $gt: 0 } } as any,
            { $inc: { currentWorkload: -1 } } as any
          );
        }
        await mongoose.model('Escalation').updateMany(
          { complaintId: complaint._id, status: 'open' } as any,
          { $set: { status: 'resolved', resolvedAt: now, notes: 'Complaint resolved.' } } as any
        );
      }

      await complaint.save();

      const updated = await mongoose.model('Complaint').findById(complaint._id)
        .populate('statusHistory')
        .populate('classificationId')
        .populate('assignedHandlerId', 'name officerCode zone email phone isAvailable currentWorkload maxCapacity');

      res.json({
        success: true,
        message: `Complaint ${complaint.reportId} updated to ${newStatus}.`,
        complaint: updated,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update complaint status.',
      });
    }
  }
);

/**
 * PUT /api/complaints/:id/classification
 * Allows authorized administrators to review and override a complaint's classification.
 */
router.put(
  '/:id/classification',
  requireAuth,
  requireRole(['admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { category, reviewNotes } = req.body as {
        category?: string;
        reviewNotes?: string;
      };

      if (!isValidComplaintCategory(category)) {
        res.status(400).json({
          success: false,
          message: 'Category must be one of: Hygiene, Adulteration, Mislabelling, Foreign Object, Service.',
        });
        return;
      }

      const idParam = req.params.id;
      const query = mongoose.isValidObjectId(idParam)
        ? { _id: idParam }
        : { reportId: idParam };

      const complaint: any = await mongoose.model('Complaint').findOne(query as any);
      if (!complaint) {
        res.status(404).json({ success: false, message: 'Complaint not found.' });
        return;
      }

      const isHighRisk = category === 'Adulteration' || category === 'Foreign Object';
      complaint.detectedCategory = category;
      if (isHighRisk) {
        complaint.priority = 'CRITICAL';
        complaint.slaHours = 48;
        complaint.slaDeadline = new Date(
          complaint.submissionTimestamp.getTime() + 48 * 60 * 60 * 1000
        );
      }
      await complaint.save();

      await mongoose.model('Classification').findOneAndUpdate(
        { complaintId: complaint._id } as any,
        {
          $set: {
            detectedCategory: category,
            needsAdminReview: false,
            classificationSource: 'admin_override',
            reviewedBy: req.user?.userId ? new mongoose.Types.ObjectId(req.user.userId) : null,
            reviewedAt: new Date(),
            reviewNotes: reviewNotes?.trim() || 'Reviewed and confirmed by Administrator.',
          },
        } as any
      );

      const updated = await mongoose.model('Complaint').findById(complaint._id)
        .populate('classificationId')
        .populate('statusHistory');

      res.json({
        success: true,
        message: `Classification updated to '${category}'.`,
        complaint: updated,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to review classification.',
      });
    }
  }
);

export default router;
