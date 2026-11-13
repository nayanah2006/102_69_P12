import mongoose, { Schema } from 'mongoose';
import { COMPLAINT_CATEGORIES, type ComplaintCategory } from '../../shared/classificationEngine.ts';

export interface IClassification {
  _id?: mongoose.Types.ObjectId;
  complaintId: mongoose.Types.ObjectId;
  detectedCategory: ComplaintCategory;
  userSelectedCategory?: string;
  matchedKeywords: string[];
  allMatchedByCategory: Record<string, string[]>;
  categoryScores: Record<string, number>;
  multipleMatchesDetected: boolean;
  deterministicRuleApplied: string;
  unknownKeywords: boolean;
  needsAdminReview: boolean;
  classificationSource: 'keyword_engine' | 'user_declared_pending_review' | 'admin_override';
  reviewedBy?: mongoose.Types.ObjectId | null;
  reviewedAt?: Date | null;
  reviewNotes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const ClassificationSchema = new Schema<IClassification>(
  {
    complaintId: { type: Schema.Types.ObjectId, ref: 'Complaint', required: true, index: true },
    detectedCategory: { type: String, enum: COMPLAINT_CATEGORIES, required: true },
    userSelectedCategory: { type: String, default: '' },
    matchedKeywords: { type: [String], default: [] },
    allMatchedByCategory: { type: Schema.Types.Mixed, default: {} },
    categoryScores: { type: Schema.Types.Mixed, default: {} },
    multipleMatchesDetected: { type: Boolean, default: false },
    deterministicRuleApplied: { type: String, required: true },
    unknownKeywords: { type: Boolean, default: false },
    needsAdminReview: { type: Boolean, default: false },
    classificationSource: {
      type: String,
      enum: ['keyword_engine', 'user_declared_pending_review', 'admin_override'],
      default: 'keyword_engine',
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reviewNotes: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Classification =
  mongoose.models.Classification ||
  mongoose.model('Classification', ClassificationSchema);
