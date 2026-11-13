import mongoose from 'mongoose';
import { Handler, type IHandler } from '../models/Handler.ts';
import { RoutingRule } from '../models/RoutingRule.ts';
import { Assignment, type AssignmentType } from '../models/Assignment.ts';
import { Escalation } from '../models/Escalation.ts';
import { Complaint, type IComplaint } from '../models/Complaint.ts';
import { StatusHistory } from '../models/StatusHistory.ts';
import type { PriorityLevel } from '../../shared/classificationEngine.ts';
import type { IdentifierValidationResult } from '../../shared/dfaValidator.ts';

export interface RoutingDecision {
  zone: string;
  zoneName: string;
  restoPrefix: string;
  handlerId: mongoose.Types.ObjectId | null;
  handlerName: string;
  assignmentType: AssignmentType;
  currentStatus: 'Pending' | 'Assigned';
  inWaitingQueue: boolean;
  escalated: boolean;
  escalationReason?: string;
  routingDecisionLog: string[];
  assignedAt: Date | null;
}

const PRIORITY_WEIGHT: Record<PriorityLevel, number> = {
  CRITICAL: 3,
  HIGH: 2,
  STANDARD: 1,
};

export function getPriorityWeight(priority: PriorityLevel): number {
  return PRIORITY_WEIGHT[priority] ?? 1;
}

/**
 * Deterministic queue ordering:
 * 1. Priority weight DESC (CRITICAL > HIGH > STANDARD)
 * 2. Submission timestamp ASC (FIFO)
 * 3. Report ID ASC (lexicographical deterministic tie-breaker)
 */
export function sortComplaintsDeterministically<
  T extends { priority: PriorityLevel; submissionTimestamp: Date | string; reportId: string }
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const pDiff = getPriorityWeight(b.priority) - getPriorityWeight(a.priority);
    if (pDiff !== 0) return pDiff;
    const tDiff =
      new Date(a.submissionTimestamp).getTime() - new Date(b.submissionTimestamp).getTime();
    if (tDiff !== 0) return tDiff;
    return a.reportId.localeCompare(b.reportId);
  });
}

async function tryAcquireHandlerSlot(handlerId: mongoose.Types.ObjectId | string): Promise<IHandler | null> {
  const updatedHandler = (await mongoose.model('Handler').findByIdAndUpdate(
    handlerId,
    { $inc: { currentWorkload: 1 } },
    { new: true } as any
  )) as unknown as IHandler | null;

  return updatedHandler;
}

/**
 * Routes a validated complaint to the appropriate Food Safety Officer based on
 * the extracted RESTO_CODE prefix, configurable 4-zone routing table,
 * officer availability, capacity, backup officers, emergency priority routing, and escalation rules.
 */
export async function routeValidatedComplaint(params: {
  validation: IdentifierValidationResult;
  priority: PriorityLevel;
  priorityOverride: boolean;
}): Promise<RoutingDecision> {
  const { validation, priority, priorityOverride } = params;

  if (!validation.isValid || !validation.extracted) {
    throw new Error('Routing refused: Cannot dispatch an invalid or unverified complaint identifier.');
  }

  const { restoPrefix } = validation.extracted;
  const log: string[] = [];
  log.push(`Extracted routing key prefix '${restoPrefix}' from validated identifier '${validation.identifier}'.`);
  if (priorityOverride) {
    log.push(`Priority override applied: elevated to ${priority} with mandatory 48-hour SLA.`);
  }

  const rule: any = await mongoose.model('RoutingRule').findOne({ prefix: restoPrefix, isActive: true } as any);

  if (!rule) {
    log.push(`No active routing rule found for prefix '${restoPrefix}'.`);
    log.push(`Routed to documented Central Fallback & Correction Queue.`);
    return {
      zone: 'Central Fallback Queue',
      zoneName: 'Central Fallback & Correction Queue',
      restoPrefix,
      handlerId: null,
      handlerName: 'Central Fallback Queue',
      assignmentType: 'fallback',
      currentStatus: 'Pending',
      inWaitingQueue: true,
      escalated: true,
      escalationReason: `Unknown routing prefix '${restoPrefix}' — routed to Central Fallback Queue for administrator mapping.`,
      routingDecisionLog: log,
      assignedAt: null,
    };
  }

  log.push(`Matched routing table entry: Prefix '${restoPrefix}' -> ${rule.zone} (${rule.zoneName}).`);

  // 1. Check primary officer
  const primaryCandidate: any = await mongoose.model('Handler').findById(rule.primaryHandlerId);
  if (primaryCandidate) {
    if (!primaryCandidate.isAvailable) {
      log.push(`Primary officer ${primaryCandidate.name} (${primaryCandidate.officerCode}) is currently unavailable.`);
    } else if (primaryCandidate.currentWorkload >= primaryCandidate.maxCapacity) {
      log.push(
        `Primary officer ${primaryCandidate.name} (${primaryCandidate.officerCode}) is at full capacity (${primaryCandidate.currentWorkload}/${primaryCandidate.maxCapacity}).`
      );
    } else {
      const acquired = await tryAcquireHandlerSlot(primaryCandidate._id);
      if (acquired) {
        log.push(
          `Assigned to primary officer ${acquired.name} (${acquired.officerCode}). Workload: ${acquired.currentWorkload}/${acquired.maxCapacity}.`
        );
        return {
          zone: rule.zone,
          zoneName: rule.zoneName,
          restoPrefix,
          handlerId: acquired._id as mongoose.Types.ObjectId,
          handlerName: acquired.name,
          assignmentType: 'primary',
          currentStatus: 'Assigned',
          inWaitingQueue: false,
          escalated: false,
          routingDecisionLog: log,
          assignedAt: new Date(),
        };
      }
      log.push(`Primary officer ${primaryCandidate.name} reached capacity concurrently.`);
    }
  } else {
    log.push(`Primary officer reference missing for ${rule.zone}.`);
  }

  // 2. Check backup officers configured on rule + zone backup pool
  const backupPoolHandlers: any[] = await mongoose.model('Handler').find({
    $or: [
      { _id: { $in: rule.backupHandlerIds || [] } },
      { backupForZones: rule.zone },
    ],
    _id: { $ne: rule.primaryHandlerId },
  }).sort({ currentWorkload: 1, officerCode: 1 });

  for (const backup of backupPoolHandlers) {
    if (!backup.isAvailable) {
      log.push(`Backup officer ${backup.name} (${backup.officerCode}) is unavailable.`);
      continue;
    }
    if (backup.currentWorkload >= backup.maxCapacity) {
      log.push(
        `Backup officer ${backup.name} (${backup.officerCode}) is at capacity (${backup.currentWorkload}/${backup.maxCapacity}).`
      );
      continue;
    }
    const acquiredBackup = await tryAcquireHandlerSlot(backup._id);
    if (acquiredBackup) {
      log.push(
        `Backup assignment activated: assigned to ${acquiredBackup.name} (${acquiredBackup.officerCode}) in ${acquiredBackup.zone}. Workload: ${acquiredBackup.currentWorkload}/${acquiredBackup.maxCapacity}.`
      );
      return {
        zone: rule.zone,
        zoneName: rule.zoneName,
        restoPrefix,
        handlerId: acquiredBackup._id as mongoose.Types.ObjectId,
        handlerName: acquiredBackup.name,
        assignmentType: 'backup',
        currentStatus: 'Assigned',
        inWaitingQueue: false,
        escalated: false,
        routingDecisionLog: log,
        assignedAt: new Date(),
      };
    }
  }

  // 3. Emergency cross-zone routing for CRITICAL priority complaints
  if (priority === 'CRITICAL') {
    const emergencyCandidates: any[] = await mongoose.model('Handler').find({
      isAvailable: true,
      $expr: { $lt: ['$currentWorkload', '$maxCapacity'] },
    } as any).sort({ currentWorkload: 1, officerCode: 1 });

    for (const candidate of emergencyCandidates) {
      const acquiredEmergency = await tryAcquireHandlerSlot(candidate._id);
      if (acquiredEmergency) {
        log.push(
          `Emergency cross-zone routing triggered for CRITICAL complaint: assigned to ${acquiredEmergency.name} (${acquiredEmergency.officerCode}, ${acquiredEmergency.zone}).`
        );
        return {
          zone: rule.zone,
          zoneName: rule.zoneName,
          restoPrefix,
          handlerId: acquiredEmergency._id as mongoose.Types.ObjectId,
          handlerName: acquiredEmergency.name,
          assignmentType: 'emergency',
          currentStatus: 'Assigned',
          inWaitingQueue: false,
          escalated: true,
          escalationReason: `All officers in ${rule.zone} unavailable/full; CRITICAL complaint emergency-routed to ${acquiredEmergency.name} (${acquiredEmergency.zone}).`,
          routingDecisionLog: log,
          assignedAt: new Date(),
        };
      }
    }
  }

  // 4. Escalate and place in deterministic Waiting Queue
  log.push(
    `No eligible primary, backup, or emergency officer available for ${rule.zone}. Placed in deterministic Waiting Queue and escalated.`
  );
  return {
    zone: rule.zone,
    zoneName: rule.zoneName,
    restoPrefix,
    handlerId: null,
    handlerName: 'Unassigned (Waiting Queue)',
    assignmentType: 'queued',
    currentStatus: 'Pending',
    inWaitingQueue: true,
    escalated: true,
    escalationReason: `All primary and backup officers in ${rule.zone} are unavailable or at capacity.`,
    routingDecisionLog: log,
    assignedAt: null,
  };
}

/**
 * Dispatches queued/pending complaints in deterministic priority order while
 * preventing duplicate assignments.
 */
export async function dispatchWaitingQueue(actor?: {
  userId?: string | null;
  name?: string;
  role?: string;
}): Promise<{ processed: number; assigned: number; stillQueued: number; details: Array<{ reportId: string; status: string; handlerName: string }> }> {
  const queuedComplaints: any[] = await mongoose.model('Complaint').find({
    inWaitingQueue: true,
    currentStatus: 'Pending',
  } as any);

  const ordered = sortComplaintsDeterministically(queuedComplaints);
  let assignedCount = 0;
  const details: Array<{ reportId: string; status: string; handlerName: string }> = [];

  for (const item of ordered) {
    // Duplicate assignment guard
    const existingAssignment: any = await mongoose.model('Assignment').findOne({ complaintId: item._id } as any);
    if (existingAssignment && existingAssignment.handlerId) {
      details.push({
        reportId: item.reportId,
        status: 'Skipped (Already Assigned)',
        handlerName: existingAssignment.handlerName,
      });
      continue;
    }

    const rule: any = await mongoose.model('RoutingRule').findOne({ prefix: item.restoPrefix, isActive: true } as any);
    if (!rule) {
      details.push({
        reportId: item.reportId,
        status: 'Remains in Fallback Queue (Unknown Prefix)',
        handlerName: 'Central Fallback Queue',
      });
      continue;
    }

    let acquired: IHandler | null = null;
    let assignmentType: AssignmentType = 'queued';

    acquired = await tryAcquireHandlerSlot(rule.primaryHandlerId);
    if (acquired) {
      assignmentType = 'primary';
    } else {
      const backups: any[] = await mongoose.model('Handler').find({
        $or: [{ _id: { $in: rule.backupHandlerIds || [] } }, { backupForZones: rule.zone }],
        _id: { $ne: rule.primaryHandlerId },
      } as any).sort({ currentWorkload: 1, officerCode: 1 });

      for (const b of backups) {
        acquired = await tryAcquireHandlerSlot(b._id);
        if (acquired) {
          assignmentType = 'backup';
          break;
        }
      }

      if (!acquired && item.priority === 'CRITICAL') {
        const emergencyPool: any[] = await mongoose.model('Handler').find({
          isAvailable: true,
          $expr: { $lt: ['$currentWorkload', '$maxCapacity'] },
        } as any).sort({ currentWorkload: 1, officerCode: 1 });
        for (const e of emergencyPool) {
          acquired = await tryAcquireHandlerSlot(e._id);
          if (acquired) {
            assignmentType = 'emergency';
            break;
          }
        }
      }
    }

    if (acquired) {
      const now = new Date();
      const historyEntry = await StatusHistory.create({
        complaintId: item._id,
        reportId: item.reportId,
        previousStatus: 'Pending',
        newStatus: 'Assigned',
        updatedBy: actor?.userId ? new mongoose.Types.ObjectId(actor.userId) : null,
        updatedByName: actor?.name || 'Routing Dispatcher',
        updatedByRole: actor?.role || 'admin',
        timestamp: now,
        remarks: `Queue dispatch assigned complaint to ${acquired.name} (${acquired.officerCode}) via ${assignmentType} routing.`,
      });

      await mongoose.model('Complaint').findByIdAndUpdate(
        item._id,
        {
          $set: {
            assignedZone: rule.zone,
            assignedHandlerId: acquired._id,
            assignedHandlerName: acquired.name,
            assignmentType,
            currentStatus: 'Assigned',
            inWaitingQueue: false,
            assignmentTimestamp: now,
          },
          $push: {
            routingDecisionLog: `Queue re-dispatch (${now.toISOString()}): Assigned to ${acquired.name} (${assignmentType}).`,
            statusHistory: historyEntry._id,
          },
        },
        { new: true } as any
      );

      await mongoose.model('Assignment').findOneAndUpdate(
        { complaintId: item._id } as any,
        {
          $set: {
            zone: rule.zone,
            handlerId: acquired._id,
            handlerName: acquired.name,
            assignmentType,
            assignedAt: now,
          },
          $push: {
            routingDecisionLog: `Dispatched from queue to ${acquired.name} (${assignmentType}).`,
          },
        },
        { upsert: true } as any
      );

      await Escalation.updateMany(
        { complaintId: item._id, status: 'open' },
        {
          $set: {
            status: 'resolved',
            resolvedAt: now,
            notes: `Resolved via queue dispatch to ${acquired.name}.`,
          },
        }
      );

      assignedCount += 1;
      details.push({
        reportId: item.reportId,
        status: `Assigned (${assignmentType})`,
        handlerName: acquired.name,
      });
    } else {
      details.push({
        reportId: item.reportId,
        status: 'Remains Queued (No Eligible Officer)',
        handlerName: 'Unassigned (Waiting Queue)',
      });
    }
  }

  return {
    processed: ordered.length,
    assigned: assignedCount,
    stillQueued: ordered.length - assignedCount,
    details,
  };
}
