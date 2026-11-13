import mongoose, { Schema } from 'mongoose';

export const COMPLAINT_STATUSES = ['Pending', 'Assigned', 'In Progress', 'Resolved'] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export interface IStatusHistory {
  _id?: mongoose.Types.ObjectId;
  complaintId: mongoose.Types.ObjectId;
  reportId: string;
  previousStatus: ComplaintStatus | 'None';
  newStatus: ComplaintStatus;
  updatedBy?: mongoose.Types.ObjectId | null;
  updatedByName: string;
  updatedByRole: string;
  timestamp: Date;
  remarks: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const StatusHistorySchema = new Schema<IStatusHistory>(
  {
    complaintId: { type: Schema.Types.ObjectId, ref: 'Complaint', required: true, index: true },
    reportId: { type: String, required: true, index: true },
    previousStatus: {
      type: String,
      enum: ['None', ...COMPLAINT_STATUSES],
      required: true,
    },
    newStatus: { type: String, enum: COMPLAINT_STATUSES, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedByName: { type: String, required: true },
    updatedByRole: { type: String, required: true },
    timestamp: { type: Date, default: Date.now, index: true },
    remarks: { type: String, default: '' },
  },
  { timestamps: true }
);

export const StatusHistory =
  mongoose.models.StatusHistory ||
  mongoose.model('StatusHistory', StatusHistorySchema);
