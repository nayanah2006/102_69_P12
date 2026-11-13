import mongoose, { Schema } from 'mongoose';

export type AssignmentType = 'primary' | 'backup' | 'emergency' | 'queued' | 'fallback';

export interface IAssignment {
  _id?: mongoose.Types.ObjectId;
  complaintId: mongoose.Types.ObjectId;
  reportId: string;
  zone: string;
  restoPrefix: string;
  handlerId?: mongoose.Types.ObjectId | null;
  handlerName: string;
  assignmentType: AssignmentType;
  priority: 'STANDARD' | 'HIGH' | 'CRITICAL';
  priorityOverride: boolean;
  assignedAt?: Date | null;
  routingDecisionLog: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

const AssignmentSchema = new Schema<IAssignment>(
  {
    complaintId: {
      type: Schema.Types.ObjectId,
      ref: 'Complaint',
      required: true,
      unique: true,
      index: true,
    },
    reportId: { type: String, required: true, index: true },
    zone: { type: String, required: true, index: true },
    restoPrefix: { type: String, required: true },
    handlerId: { type: Schema.Types.ObjectId, ref: 'Handler', default: null, index: true },
    handlerName: { type: String, default: 'Unassigned (Queued)' },
    assignmentType: {
      type: String,
      enum: ['primary', 'backup', 'emergency', 'queued', 'fallback'],
      required: true,
    },
    priority: { type: String, enum: ['STANDARD', 'HIGH', 'CRITICAL'], required: true },
    priorityOverride: { type: Boolean, default: false },
    assignedAt: { type: Date, default: null },
    routingDecisionLog: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const Assignment =
  mongoose.models.Assignment || mongoose.model('Assignment', AssignmentSchema);
