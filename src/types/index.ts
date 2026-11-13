import type { ComplaintCategory, PriorityLevel } from '../../shared/classificationEngine.ts';
import type { IdentifierValidationResult } from '../../shared/dfaValidator.ts';

export type UserRole = 'citizen' | 'handler' | 'admin';
export type ComplaintStatus = 'Pending' | 'Assigned' | 'In Progress' | 'Resolved';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: UserRole;
  handlerProfileId?: string | null;
}

export interface HandlerProfile {
  _id: string;
  userId?: string | null;
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
}

export interface StatusHistoryItem {
  _id: string;
  complaintId: string;
  reportId: string;
  previousStatus: ComplaintStatus | 'None';
  newStatus: ComplaintStatus;
  updatedByName: string;
  updatedByRole: string;
  timestamp: string;
  remarks: string;
}

export interface ClassificationRecord {
  _id: string;
  detectedCategory: ComplaintCategory;
  userSelectedCategory: string;
  matchedKeywords: string[];
  allMatchedByCategory: Record<string, string[]>;
  categoryScores: Record<string, number>;
  multipleMatchesDetected: boolean;
  deterministicRuleApplied: string;
  unknownKeywords: boolean;
  needsAdminReview: boolean;
  classificationSource: 'keyword_engine' | 'user_declared_pending_review' | 'admin_override';
  reviewNotes?: string;
}

export interface ComplaintRecord {
  _id: string;
  reportId: string;
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
  classificationId?: ClassificationRecord | null;
  urgencyLevel: string;
  priority: PriorityLevel;
  priorityOverride: boolean;
  slaHours: number;
  assignedZone: string;
  assignedHandlerId?: HandlerProfile | null;
  assignedHandlerName: string;
  assignmentType: 'primary' | 'backup' | 'emergency' | 'queued' | 'fallback';
  routingDecisionLog: string[];
  currentStatus: ComplaintStatus;
  inWaitingQueue: boolean;
  escalated: boolean;
  submissionTimestamp: string;
  assignmentTimestamp?: string | null;
  slaDeadline: string;
  resolutionTimestamp?: string | null;
  statusHistory: StatusHistoryItem[];
}

export interface RoutingRuleRecord {
  _id: string;
  prefix: string;
  zone: string;
  zoneName: string;
  primaryHandlerId: HandlerProfile;
  backupHandlerIds: HandlerProfile[];
  isActive: boolean;
  notes?: string;
}

export interface EscalationRecord {
  _id: string;
  complaintId: string;
  reportId: string;
  reason: string;
  zone: string;
  priority: PriorityLevel;
  status: 'open' | 'resolved';
  escalatedAt: string;
  resolvedAt?: string | null;
  notes: string;
}

export interface AssignmentRecord {
  _id: string;
  reportId: string;
  zone: string;
  restoPrefix: string;
  handlerName: string;
  assignmentType: 'primary' | 'backup' | 'emergency' | 'queued' | 'fallback';
  priority: PriorityLevel;
  priorityOverride: boolean;
  assignedAt?: string | null;
  routingDecisionLog: string[];
}

export interface AnalyticsSummary {
  total: number;
  resolved: number;
  unresolved: number;
  pending: number;
  assigned: number;
  inProgress: number;
  criticalCount: number;
  highPriorityCount: number;
  slaCompliantCount: number;
  slaBreachedCount: number;
  slaComplianceRate: number;
  openEscalations: number;
  monthlyStats: Array<{ month: string; total: number; resolved: number; critical: number }>;
}

export interface ValidateApiResponse {
  success: boolean;
  todayLocal: string;
  regexPattern: string;
  validation: IdentifierValidationResult;
}
