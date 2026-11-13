import mongoose, { Schema } from 'mongoose';

export interface IHandler {
  _id?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId | null;
  officerCode: string;
  name: string;
  email: string;
  phone: string;
  zone: string;
  isPrimary: boolean;
  isAvailable: boolean;
  currentWorkload: number;
  maxCapacity: number;
  backupForZones: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

const HandlerSchema = new Schema<IHandler>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    officerCode: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    zone: { type: String, required: true, index: true },
    isPrimary: { type: Boolean, default: true },
    isAvailable: { type: Boolean, default: true, index: true },
    currentWorkload: { type: Number, default: 0, min: 0 },
    maxCapacity: { type: Number, default: 5, min: 1, max: 100 },
    backupForZones: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const Handler = mongoose.models.Handler || mongoose.model('Handler', HandlerSchema);
