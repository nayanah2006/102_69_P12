import mongoose, { Schema } from 'mongoose';

export interface IEscalation {
  _id?: mongoose.Types.ObjectId;
  complaintId: mongoose.Types.ObjectId;
  reportId: string;
  reason: string;
  zone: string;
  priority: 'STANDARD' | 'HIGH' | 'CRITICAL';
  status: 'open' | 'resolved';
  escalatedAt: Date;
  resolvedAt?: Date | null;
  notes: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const EscalationSchema = new Schema<IEscalation>(
  {
    complaintId: { type: Schema.Types.ObjectId, ref: 'Complaint', required: true, index: true },
    reportId: { type: String, required: true, index: true },
    reason: { type: String, required: true },
    zone: { type: String, required: true },
    priority: { type: String, enum: ['STANDARD', 'HIGH', 'CRITICAL'], required: true },
    status: { type: String, enum: ['open', 'resolved'], default: 'open', index: true },
    escalatedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Escalation =
  mongoose.models.Escalation || mongoose.model('Escalation', EscalationSchema);
