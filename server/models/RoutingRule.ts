import mongoose, { Schema } from 'mongoose';

export interface IRoutingRule {
  _id?: mongoose.Types.ObjectId;
  prefix: string;
  zone: string;
  zoneName: string;
  primaryHandlerId: mongoose.Types.ObjectId;
  backupHandlerIds: mongoose.Types.ObjectId[];
  isActive: boolean;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const RoutingRuleSchema = new Schema<IRoutingRule>(
  {
    prefix: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      match: /^[A-Z]{3}$/,
      index: true,
    },
    zone: { type: String, required: true, trim: true, index: true },
    zoneName: { type: String, required: true, trim: true },
    primaryHandlerId: { type: Schema.Types.ObjectId, ref: 'Handler', required: true },
    backupHandlerIds: [{ type: Schema.Types.ObjectId, ref: 'Handler' }],
    isActive: { type: Boolean, default: true },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

export const RoutingRule =
  mongoose.models.RoutingRule || mongoose.model('RoutingRule', RoutingRuleSchema);
