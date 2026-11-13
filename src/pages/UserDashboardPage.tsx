import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronDown, ChevronUp, FilePlus2 } from 'lucide-react';
import { complaintsApi } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { PriorityText, SlaCountdown, StatusText } from '../components/StatusComponents.tsx';
import type { ComplaintRecord, ComplaintStatus } from '../types/index.ts';

const STATUS_FILTERS: Array<'All' | ComplaintStatus> = [
  'All',
  'Pending',
  'Assigned',
  'In Progress',
  'Resolved',
];

export function UserDashboardPage() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | ComplaintStatus>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    complaintsApi
      .list()
      .then((res) => setComplaints(res.complaints))
      .catch((err) => {
        setErrorMsg(
          err?.response?.data?.message || 'Unable to load your complaints.'
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    return {
      total: complaints.length,
      pending: complaints.filter((c) => c.currentStatus === 'Pending').length,
      assigned: complaints.filter((c) => c.currentStatus === 'Assigned').length,
      inProgress: complaints.filter((c) => c.currentStatus === 'In Progress').length,
      resolved: complaints.filter((c) => c.currentStatus === 'Resolved').length,
    };
  }, [complaints]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return complaints.filter((c) => {
      if (statusFilter !== 'All' && c.currentStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        c.reportId.toLowerCase().includes(q) ||
        c.originalIdentifier.toLowerCase().includes(q) ||
        c.restaurantName.toLowerCase().includes(q)
      );
    });
  }, [complaints, searchTerm, statusFilter]);

  const progressPercent = (status: ComplaintStatus) => {
    if (status === 'Pending') return 25;
    if (status === 'Assigned') return 50;
    if (status === 'In Progress') return 75;
    return 100;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display">
            Citizen Complaint Dashboard
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {user?.role === 'admin'
              ? 'Viewing all registered citizen complaints across all districts.'
              : 'Track your submitted restaurant complaints, assigned officers, and resolution progress.'}
          </p>
        </div>
        <Link
          to="/submit"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <FilePlus2 className="w-4 h-4" />
          <span>New Complaint</span>
        </Link>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: 'Total Complaints', value: counts.total, tone: 'text-slate-900' },
          { label: 'Pending', value: counts.pending, tone: 'text-amber-700' },
          { label: 'Assigned', value: counts.assigned, tone: 'text-sky-700' },
          { label: 'In Progress', value: counts.inProgress, tone: 'text-indigo-700' },
          { label: 'Resolved', value: counts.resolved, tone: 'text-emerald-700' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500">{kpi.label}</p>
            <p className={`text-2xl font-bold font-mono tabular-nums mt-1 ${kpi.tone}`}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Search & Segmented Status Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Complaint ID (CMP-...) or Restaurant..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {STATUS_FILTERS.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === st
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <p className="text-sm font-medium text-slate-800">
            No complaints match your current filter.
          </p>
          <p className="text-xs text-slate-500">
            Submit a new restaurant complaint to track validation, routing, and resolution SLA.
          </p>
          <div>
            <Link
              to="/submit"
              className="inline-block px-4 py-2 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors"
            >
              Submit First Complaint
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
          {filtered.map((item) => {
            const isExpanded = expandedId === item._id;
            const pct = progressPercent(item.currentStatus);
            return (
              <div key={item._id} className="p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
                      <span className="font-semibold text-slate-900">{item.reportId}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.originalIdentifier}</span>
                      <span aria-hidden="true">·</span>
                      <span>Filed {item.complaintDate}</span>
                    </div>
                    <h2 className="text-base font-semibold text-slate-900 font-display">
                      {item.restaurantName}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span>{item.detectedCategory}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.assignedZone}</span>
                      <span aria-hidden="true">·</span>
                      <span>Officer: {item.assignedHandlerName}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-3">
                      <PriorityText priority={item.priority} override={item.priorityOverride} />
                      <StatusText status={item.currentStatus} />
                    </div>
                    <SlaCountdown
                      slaDeadline={item.slaDeadline}
                      status={item.currentStatus}
                      resolutionTimestamp={item.resolutionTimestamp}
                    />
                  </div>
                </div>

                {/* Resolution Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Resolution Progress</span>
                    <span className="font-mono tabular-nums">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        item.currentStatus === 'Resolved' ? 'bg-emerald-600' : 'bg-sky-700'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <Link
                    to={`/track?id=${encodeURIComponent(item.reportId)}`}
                    className="text-xs font-medium text-sky-700 hover:text-sky-900"
                  >
                    Open Full Audit View
                  </Link>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : item._id)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                  >
                    <span>{isExpanded ? 'Hide History' : 'Status History'}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {isExpanded && (
                  <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                    <p className="text-slate-700">{item.description}</p>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg divide-y divide-slate-200">
                      {item.statusHistory.map((h) => (
                        <div key={h._id} className="p-2.5 flex flex-wrap justify-between gap-2">
                          <div>
                            <span className="font-semibold text-slate-900">
                              {h.previousStatus} → {h.newStatus}
                            </span>
                            <span className="text-slate-600 ml-2">{h.remarks}</span>
                          </div>
                          <span className="font-mono text-slate-500 tabular-nums">
                            {new Date(h.timestamp).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
