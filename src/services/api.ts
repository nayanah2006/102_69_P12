import axios from 'axios';
import type {
  AnalyticsSummary,
  AssignmentRecord,
  AuthUser,
  ComplaintRecord,
  ComplaintStatus,
  EscalationRecord,
  HandlerProfile,
  RoutingRuleRecord,
  UserRole,
  ValidateApiResponse,
} from '../types/index.ts';
import type { ClassificationResult } from '../../shared/classificationEngine.ts';

const TOKEN_KEY = 'foodguard_auth_token';

export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function saveAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export const authApi = {
  async register(payload: {
    name: string;
    email: string;
    mobile: string;
    password: string;
    role?: UserRole;
    zone?: string;
  }): Promise<{ token: string; user: AuthUser }> {
    const { data } = await apiClient.post('/auth/register', payload);
    return data;
  },
  async login(payload: { email: string; password: string }): Promise<{ token: string; user: AuthUser }> {
    const { data } = await apiClient.post('/auth/login', payload);
    return data;
  },
  async me(): Promise<{ user: AuthUser }> {
    const { data } = await apiClient.get('/auth/me');
    return data;
  },
};

export const validationApi = {
  async validate(payload: { identifier: string; complaintDate?: string }): Promise<ValidateApiResponse> {
    const { data } = await apiClient.post('/validate', payload, {
      validateStatus: (status) => status === 200 || status === 400,
    });
    return data;
  },
  async classify(payload: {
    description: string;
    userSelectedCategory?: string;
    urgencyLevel?: string;
  }): Promise<{ classification: ClassificationResult }> {
    const { data } = await apiClient.post('/classify', payload);
    return data;
  },
};

export const complaintsApi = {
  async submit(payload: {
    reporterName: string;
    reporterEmail: string;
    reporterMobile: string;
    restaurantName: string;
    restaurantDistrict: string;
    originalIdentifier: string;
    complaintDate: string;
    complaintCategory?: string;
    description: string;
    urgencyLevel: string;
  }): Promise<{ complaint: ComplaintRecord; message: string }> {
    const { data } = await apiClient.post('/complaints', payload);
    return data;
  },
  async list(params?: {
    search?: string;
    status?: string;
    category?: string;
    zone?: string;
  }): Promise<{ complaints: ComplaintRecord[]; count: number }> {
    const { data } = await apiClient.get('/complaints', { params });
    return data;
  },
  async getById(id: string): Promise<{ complaint: ComplaintRecord }> {
    const { data } = await apiClient.get(`/complaints/${encodeURIComponent(id)}`);
    return data;
  },
  async track(reportId: string): Promise<{ complaint: ComplaintRecord }> {
    const { data } = await apiClient.get(`/complaints/track/${encodeURIComponent(reportId)}`);
    return data;
  },
  async updateStatus(
    id: string,
    payload: { newStatus: ComplaintStatus; remarks?: string }
  ): Promise<{ complaint: ComplaintRecord; message: string }> {
    const { data } = await apiClient.put(`/complaints/${encodeURIComponent(id)}/status`, payload);
    return data;
  },
  async overrideClassification(
    id: string,
    payload: { category: string; reviewNotes?: string }
  ): Promise<{ complaint: ComplaintRecord; message: string }> {
    const { data } = await apiClient.put(
      `/complaints/${encodeURIComponent(id)}/classification`,
      payload
    );
    return data;
  },
};

export const routingApi = {
  async getTable(): Promise<{ rules: RoutingRuleRecord[]; handlers: HandlerProfile[] }> {
    const { data } = await apiClient.get('/routing/table');
    return data;
  },
  async createRule(payload: {
    prefix: string;
    zone: string;
    zoneName: string;
    primaryHandlerId: string;
    backupHandlerIds?: string[];
    notes?: string;
  }): Promise<{ rule: RoutingRuleRecord; message: string }> {
    const { data } = await apiClient.post('/routing/table', payload);
    return data;
  },
  async updateRule(
    id: string,
    payload: Partial<{
      zone: string;
      zoneName: string;
      primaryHandlerId: string;
      backupHandlerIds: string[];
      isActive: boolean;
      notes: string;
    }>
  ): Promise<{ rule: RoutingRuleRecord; message: string }> {
    const { data } = await apiClient.put(`/routing/table/${id}`, payload);
    return data;
  },
  async getQueue(): Promise<{
    queue: ComplaintRecord[];
    escalations: EscalationRecord[];
    recentAssignments: AssignmentRecord[];
  }> {
    const { data } = await apiClient.get('/routing/queue');
    return data;
  },
  async dispatchQueue(): Promise<{
    message: string;
    result: {
      processed: number;
      assigned: number;
      stillQueued: number;
      details: Array<{ reportId: string; status: string; handlerName: string }>;
    };
  }> {
    const { data } = await apiClient.post('/routing/dispatch');
    return data;
  },
};

export const handlersApi = {
  async list(): Promise<{ handlers: HandlerProfile[] }> {
    const { data } = await apiClient.get('/handlers');
    return data;
  },
  async setAvailability(
    id: string,
    isAvailable: boolean
  ): Promise<{ handler: HandlerProfile; message: string }> {
    const { data } = await apiClient.put(`/handlers/${id}/availability`, { isAvailable });
    return data;
  },
  async setCapacity(
    id: string,
    maxCapacity: number
  ): Promise<{ handler: HandlerProfile; message: string }> {
    const { data } = await apiClient.put(`/handlers/${id}/capacity`, { maxCapacity });
    return data;
  },
};

export const analyticsApi = {
  async summary(): Promise<{ summary: AnalyticsSummary }> {
    const { data } = await apiClient.get('/analytics/summary');
    return data;
  },
  async categories(): Promise<{
    categories: Array<{
      category: string;
      count: number;
      resolved: number;
      unresolved: number;
      critical: number;
    }>;
  }> {
    const { data } = await apiClient.get('/analytics/categories');
    return data;
  },
  async zones(): Promise<{
    zones: Array<{
      zone: string;
      count: number;
      resolved: number;
      unresolved: number;
      critical: number;
    }>;
  }> {
    const { data } = await apiClient.get('/analytics/zones');
    return data;
  },
};

export const adminApi = {
  async pendingClassifications(): Promise<{
    items: Array<{
      _id: string;
      detectedCategory: string;
      deterministicRuleApplied: string;
      unknownKeywords: boolean;
      multipleMatchesDetected: boolean;
      matchedKeywords: string[];
      complaintId: {
        _id: string;
        reportId: string;
        restaurantName: string;
        originalIdentifier: string;
        description: string;
        detectedCategory: string;
        priority: string;
        currentStatus: string;
      };
    }>;
  }> {
    const { data } = await apiClient.get('/admin/classifications/review');
    return data;
  },
};
