import mongoose, { Schema } from 'mongoose';
import { COMPLAINT_CATEGORIES, type ComplaintCategory, type PriorityLevel } from '../../shared/classificationEngine.ts';
import { COMPLAINT_STATUSES, type ComplaintStatus } from './StatusHistory.ts';
import type { AssignmentType } from './Assignment.ts';

export interface IComplaint {
  _id?: mongoose.Types.ObjectId;
  reportId: string;
  userId?: mongoose.Types.ObjectId | null;
  reporterName: string;
  reporterEmail: string;
  reporterMobile: string;
  restaurantName: string;
  restaurantDistrict: string;
  originalIdentifier: string;
  restoCode: string;
  restoPrefix: string;
  complaintDate: string;
  description: string;
  validationOutcome: 'ACCEPTED' | 'REJECTED';
  validationMessage: string;
  dfaFinalState: string;
  regexMatched: boolean;
  userSelectedCategory: string;
  detectedCategory: ComplaintCategory;
  matchedKeywords: string[];
  classificationId?: mongoose.Types.ObjectId | null;
  urgencyLevel: string;
  priority: PriorityLevel;
  priorityOverride: boolean;
  slaHours: number;
  assignedZone: string;
  assignedHandlerId?: mongoose.Types.ObjectId | null;
  assignedHandlerName: string;
  assignmentType: AssignmentType;
  routingDecisionLog: string[];
  currentStatus: ComplaintStatus;
  inWaitingQueue: boolean;
  escalated: boolean;
  submissionTimestamp: Date;
  assignmentTimestamp?: Date | null;
  slaDeadline: Date;
  resolutionTimestamp?: Date | null;
  statusHistory: mongoose.Types.ObjectId[];
  createdAt?: Date;
  updatedAt?: Date;
}

const ComplaintSchema = new Schema<IComplaint>(
  {
    reportId: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    reporterName: { type: String, required: true, trim: true },
    reporterEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    reporterMobile: { type: String, required: true, trim: true },
    restaurantName: { type: String, required: true, trim: true },
    restaurantDistrict: { type: String, required: true, trim: true },
    originalIdentifier: { type: String, required: true, unique: true, trim: true, index: true },
    restoCode: { type: String, required: true, trim: true },
    restoPrefix: { type: String, required: true, trim: true, index: true },
    complaintDate: { type: String, required: true, index: true },
    description: { type: String, required: true, trim: true },
    validationOutcome: { type: String, enum: ['ACCEPTED', 'REJECTED'], required: true },
    validationMessage: { type: String, required: true },
    dfaFinalState: { type: String, required: true },
    regexMatched: { type: Boolean, required: true },
    userSelectedCategory: { type: String, default: '' },
    detectedCategory: { type: String, enum: COMPLAINT_CATEGORIES, required: true, index: true },
    matchedKeywords: { type: [String], default: [] },
    classificationId: { type: Schema.Types.ObjectId, ref: 'Classification', default: null },
    urgencyLevel: { type: String, default: 'Standard' },
    priority: { type: String, enum: ['STANDARD', 'HIGH', 'CRITICAL'], required: true, index: true },
    priorityOverride: { type: Boolean, default: false },
    slaHours: { type: Number, required: true },
    assignedZone: { type: String, required: true, index: true },
    assignedHandlerId: { type: Schema.Types.ObjectId, ref: 'Handler', default: null, index: true },
    assignedHandlerName: { type: String, default: 'Unassigned (Queued)' },
    assignmentType: {
      type: String,
      enum: ['primary', 'backup', 'emergency', 'queued', 'fallback'],
      required: true,
    },
    routingDecisionLog: { type: [String], default: [] },
    currentStatus: { type: String, enum: COMPLAINT_STATUSES, default: 'Pending', index: true },
    inWaitingQueue: { type: Boolean, default: false, index: true },
    escalated: { type: Boolean, default: false, index: true },
    submissionTimestamp: { type: Date, default: Date.now, index: true },
    assignmentTimestamp: { type: Date, default: null },
    slaDeadline: { type: Date, required: true, index: true },
    resolutionTimestamp: { type: Date, default: null },
    statusHistory: [{ type: Schema.Types.ObjectId, ref: 'StatusHistory' }],
  },
  { timestamps: true }
);

// Compound index for duplicate detection & deterministic queue sorting
ComplaintSchema.index({ priority: 1, submissionTimestamp: 1, reportId: 1 });

export const Complaint =
  mongoose.models.Complaint || mongoose.model('Complaint', ComplaintSchema);
