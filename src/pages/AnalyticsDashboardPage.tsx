import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { adminApi, analyticsApi, complaintsApi } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { COMPLAINT_CATEGORIES } from '../../shared/classificationEngine.ts';
import { ToastBanner } from '../components/StatusComponents.tsx';
import type { AnalyticsSummary } from '../types/index.ts';

const CHART_COLORS = ['#0369a1', '#dc2626', '#d97706', '#4f46e5', '#16a34a'];

export function AnalyticsDashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [categories, setCategories] = useState<
    Array<{ category: string; count: number; resolved: number; unresolved: number; critical: number }>
  >([]);
  const [zones, setZones] = useState<
    Array<{ zone: string; count: number; resolved: number; unresolved: number; critical: number }>
  >([]);
  const [pendingReviews, setPendingReviews] = useState<
    Array<{
      _id: string;
      detectedCategory: string;
      deterministicRuleApplied: string;
      complaintId: {
        _id: string;
        reportId: string;
        restaurantName: string;
        description: string;
        detectedCategory: string;
      };
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const [sRes, cRes, zRes] = await Promise.all([
        analyticsApi.summary(),
        analyticsApi.categories(),
        analyticsApi.zones(),
      ]);
      setSummary(sRes.summary);
      setCategories(cRes.categories);
      setZones(zRes.zones);

      if (isAdmin) {
        const rev = await adminApi.pendingClassifications();
        setPendingReviews(rev.items);
      }
    } catch {
      setToast({ type: 'error', message: 'Failed to load analytics data from MongoDB.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const handleOverride = async (complaintId: string, newCat: string) => {
    try {
      const res = await complaintsApi.overrideClassification(complaintId, {
        category: newCat,
        reviewNotes: 'Reviewed and confirmed by Administrator in Analytics console.',
      });
      setToast({ type: 'success', message: res.message });
      await loadAnalytics();
    } catch {
      setToast({ type: 'error', message: 'Failed to update classification.' });
    }
  };

  if (loading || !summary) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900 font-display">
          Food Safety Analytics Dashboard
        </h1>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const resolutionPie = [
    { name: 'Resolved', value: summary.resolved },
    { name: 'Unresolved', value: summary.unresolved },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 font-display">
          Food Safety Analytics Dashboard
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Live MongoDB aggregation across district zones, complaint categories, 48-hour SLA
          compliance, and monthly reporting trends.
        </p>
      </div>

      {toast && (
        <ToastBanner type={toast.type} message={toast.message} onClose={() => setToast(null)} />
      )}

      {/* Top KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Total Reports</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {summary.total}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Resolved vs Open</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
            {summary.resolved}{' '}
            <span className="text-sm font-normal text-slate-500">/ {summary.unresolved}</span>
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">High / Critical Risk</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-red-700 mt-1">
            {summary.highPriorityCount}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">SLA Compliance Rate</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-sky-700 mt-1">
            {summary.slaComplianceRate}%
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Open Escalations</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-amber-700 mt-1">
            {summary.openEscalations}
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Zone-wise Distribution */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Zone-Wise Complaint Distribution
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zones}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="zone" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="resolved" name="Resolved" stackId="a" fill="#16a34a" />
                <Bar dataKey="unresolved" name="Unresolved" stackId="a" fill="#0369a1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category-wise Distribution */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Category-Wise Complaint Distribution
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categories}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" name="Total Complaints" fill="#0f172a" />
                <Bar dataKey="critical" name="Critical (48h SLA)" fill="#dc2626" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Resolved vs Unresolved */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Resolved vs Unresolved Complaints
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={resolutionPie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  label
                >
                  {resolutionPie.map((entry, idx) => (
                    <Cell
                      key={entry.name}
                      fill={idx === 0 ? '#16a34a' : '#d97706'}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Complaint Statistics */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Monthly Complaint Statistics
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={summary.monthlyStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Total Reports"
                  stroke={CHART_COLORS[0]}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="resolved"
                  name="Resolved"
                  stroke={CHART_COLORS[4]}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="critical"
                  name="Critical 48h"
                  stroke={CHART_COLORS[1]}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Admin Classification Review Queue */}
      {isAdmin && (
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Administrator Classification Review Queue ({pendingReviews.length})
            </h2>
            <span className="text-xs text-slate-500">
              Multi-category ties & unknown-keyword reports
            </span>
          </div>

          {pendingReviews.length === 0 ? (
            <p className="text-xs text-slate-500">
              All complaint classifications are verified.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {pendingReviews.map((item) => (
                <div
                  key={item._id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                >
                  <div className="space-y-1 max-w-2xl">
                    <p className="font-mono font-semibold text-slate-900">
                      {item.complaintId?.reportId} · {item.complaintId?.restaurantName}
                    </p>
                    <p className="text-slate-700">{item.complaintId?.description}</p>
                    <p className="text-slate-500">{item.deterministicRuleApplied}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      defaultValue={item.detectedCategory}
                      onChange={(e) =>
                        handleOverride(item.complaintId._id, e.target.value)
                      }
                      className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                      aria-label={`Override category for ${item.complaintId?.reportId}`}
                    >
                      {COMPLAINT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
