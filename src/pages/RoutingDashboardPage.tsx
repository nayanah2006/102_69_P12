import { useEffect, useState, type FormEvent } from 'react';
import { Play, Plus } from 'lucide-react';
import { handlersApi, routingApi } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { PriorityText, ToastBanner } from '../components/StatusComponents.tsx';
import type {
  AssignmentRecord,
  ComplaintRecord,
  EscalationRecord,
  HandlerProfile,
  RoutingRuleRecord,
} from '../types/index.ts';

export function RoutingDashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [rules, setRules] = useState<RoutingRuleRecord[]>([]);
  const [handlers, setHandlers] = useState<HandlerProfile[]>([]);
  const [queue, setQueue] = useState<ComplaintRecord[]>([]);
  const [escalations, setEscalations] = useState<EscalationRecord[]>([]);
  const [recentAssignments, setRecentAssignments] = useState<AssignmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Admin add-rule form
  const [newPrefix, setNewPrefix] = useState('');
  const [newZone, setNewZone] = useState('Zone 1');
  const [newZoneName, setNewZoneName] = useState('Zone 1 — Central & Downtown District');
  const [newPrimaryId, setNewPrimaryId] = useState('');

  const loadRoutingData = async () => {
    setLoading(true);
    try {
      const [tableRes, queueRes] = await Promise.all([
        routingApi.getTable(),
        routingApi.getQueue(),
      ]);
      setRules(tableRes.rules);
      setHandlers(tableRes.handlers);
      setQueue(queueRes.queue);
      setEscalations(queueRes.escalations);
      setRecentAssignments(queueRes.recentAssignments);
      if (!newPrimaryId && tableRes.handlers.length > 0) {
        setNewPrimaryId(tableRes.handlers[0]._id);
      }
    } catch (err: unknown) {
      setToast({
        type: 'error',
        message:
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to load routing & dispatch state.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoutingData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDispatchQueue = async () => {
    try {
      const res = await routingApi.dispatchQueue();
      setToast({ type: 'success', message: res.message });
      await loadRoutingData();
    } catch (err: unknown) {
      setToast({
        type: 'error',
        message:
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Queue dispatch failed.',
      });
    }
  };

  const handleAddRule = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await routingApi.createRule({
        prefix: newPrefix.trim().toUpperCase(),
        zone: newZone,
        zoneName: newZoneName,
        primaryHandlerId: newPrimaryId,
      });
      setToast({ type: 'success', message: res.message });
      setNewPrefix('');
      await loadRoutingData();
    } catch (err: unknown) {
      setToast({
        type: 'error',
        message:
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to create routing rule.',
      });
    }
  };

  const toggleHandlerAvailability = async (h: HandlerProfile) => {
    try {
      const res = await handlersApi.setAvailability(h._id, !h.isAvailable);
      setToast({ type: 'success', message: res.message });
      await loadRoutingData();
    } catch (err: unknown) {
      setToast({
        type: 'error',
        message:
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Unable to toggle availability.',
      });
    }
  };

  const backupAssignments = recentAssignments.filter(
    (a) => a.assignmentType === 'backup' || a.assignmentType === 'emergency'
  );
  const overrideDecisions = recentAssignments.filter((a) => a.priorityOverride);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display">
            Routing & Dispatch Management
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Configurable four-zone prefix routing table, Food Safety Officer capacities, waiting
            queue, backup dispatches, and escalations.
          </p>
        </div>

        {(isAdmin || user?.role === 'handler') && (
          <button
            type="button"
            onClick={handleDispatchQueue}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Play className="w-4 h-4" />
            <span>Dispatch Waiting Queue ({queue.length})</span>
          </button>
        )}
      </div>

      {toast && (
        <ToastBanner
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* Configurable 4-Zone Routing Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            District Zone Routing Table (Prefix → Zone → Assigned Officer)
          </h2>
          <span className="text-xs text-slate-500 font-mono">
            {rules.length} active prefix mappings
          </span>
        </div>

        {loading ? (
          <div className="p-6 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold">Code Prefix</th>
                  <th className="py-3 px-4 font-semibold">District Zone</th>
                  <th className="py-3 px-4 font-semibold">Primary Officer</th>
                  <th className="py-3 px-4 font-semibold">Primary Load</th>
                  <th className="py-3 px-4 font-semibold">Backup Officers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rules.map((r) => (
                  <tr key={r._id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{r.prefix}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{r.zone}</div>
                      <div className="text-xs text-slate-500">{r.zoneName}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">
                        {r.primaryHandlerId?.name || 'Unassigned'}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {r.primaryHandlerId?.officerCode} ·{' '}
                        {r.primaryHandlerId?.isAvailable ? 'Available' : 'Unavailable'}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs tabular-nums">
                      {r.primaryHandlerId?.currentWorkload ?? 0} /{' '}
                      {r.primaryHandlerId?.maxCapacity ?? 0}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {r.backupHandlerIds?.map((b) => b.name).join(', ') || 'None'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isAdmin && (
          <form
            onSubmit={handleAddRule}
            className="p-4 bg-slate-50 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
          >
            <div>
              <label htmlFor="newPrefix" className="block text-xs font-medium text-slate-700 mb-1">
                New Prefix (3 letters)
              </label>
              <input
                id="newPrefix"
                type="text"
                maxLength={3}
                required
                value={newPrefix}
                onChange={(e) => setNewPrefix(e.target.value.toUpperCase())}
                placeholder="e.g. MNO"
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="newZone" className="block text-xs font-medium text-slate-700 mb-1">
                Zone
              </label>
              <select
                id="newZone"
                value={newZone}
                onChange={(e) => {
                  const z = e.target.value;
                  setNewZone(z);
                  setNewZoneName(`${z} — Configured Sector`);
                }}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              >
                <option value="Zone 1">Zone 1</option>
                <option value="Zone 2">Zone 2</option>
                <option value="Zone 3">Zone 3</option>
                <option value="Zone 4">Zone 4</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="newPrimary" className="block text-xs font-medium text-slate-700 mb-1">
                Primary Food Safety Officer
              </label>
              <select
                id="newPrimary"
                value={newPrimaryId}
                onChange={(e) => setNewPrimaryId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              >
                {handlers.map((h) => (
                  <option key={h._id} value={h._id}>
                    {h.name} ({h.zone})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Mapping</span>
            </button>
          </form>
        )}
      </section>

      {/* Food Safety Officers Workload & Availability */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">
            Food Safety Officers — Availability & Capacity Matrix
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
              <tr>
                <th className="py-3 px-4 font-semibold">Officer</th>
                <th className="py-3 px-4 font-semibold">Zone</th>
                <th className="py-3 px-4 font-semibold">Role</th>
                <th className="py-3 px-4 font-semibold">Workload / Capacity</th>
                <th className="py-3 px-4 font-semibold">Availability</th>
                {isAdmin && <th className="py-3 px-4 font-semibold text-right">Admin Control</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {handlers.map((h) => (
                <tr key={h._id} className="hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{h.name}</div>
                    <div className="text-xs text-slate-500 font-mono">{h.officerCode}</div>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-700">{h.zone}</td>
                  <td className="py-3 px-4 text-xs text-slate-600">
                    {h.isPrimary ? 'Primary Officer' : `Reserve (${h.backupForZones.join(', ')})`}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs tabular-nums">
                    <span
                      className={
                        h.currentWorkload >= h.maxCapacity ? 'text-red-700 font-semibold' : 'text-slate-900'
                      }
                    >
                      {h.currentWorkload} / {h.maxCapacity}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs font-semibold">
                    <span className={h.isAvailable ? 'text-emerald-700' : 'text-red-700'}>
                      {h.isAvailable ? 'Available' : 'Unavailable'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => toggleHandlerAvailability(h)}
                        className="px-3 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded transition-colors"
                      >
                        {h.isAvailable ? 'Set Unavailable' : 'Set Available'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Deterministic Queue, Escalations, Backup Assignments, Priority Overrides */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Deterministic Waiting Queue ({queue.length})
            </h2>
            <span className="text-xs text-slate-500">Order: Priority DESC, Time ASC, ID ASC</span>
          </div>
          {queue.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">
              Waiting queue is empty. All valid complaints are currently assigned.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {queue.map((qItem, idx) => (
                <div key={qItem._id} className="p-3 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-mono font-semibold text-slate-900">
                      #{idx + 1} · {qItem.reportId}
                    </p>
                    <p className="text-slate-600">
                      {qItem.restaurantName} · {qItem.assignedZone}
                    </p>
                  </div>
                  <PriorityText priority={qItem.priority} override={qItem.priorityOverride} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Escalations & Priority Overrides
          </h2>

          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1.5">
                Escalation Log ({escalations.length})
              </p>
              {escalations.length === 0 ? (
                <p className="text-xs text-slate-500">No escalations recorded.</p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                  {escalations.map((esc) => (
                    <div key={esc._id} className="p-2.5 text-xs space-y-0.5">
                      <div className="flex justify-between font-mono">
                        <span className="font-semibold text-slate-900">{esc.reportId}</span>
                        <span
                          className={
                            esc.status === 'open' ? 'text-red-700 font-semibold' : 'text-emerald-700'
                          }
                        >
                          {esc.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-slate-600">{esc.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500 mb-1.5">
                Backup / Emergency Assignments ({backupAssignments.length}) · Priority Overrides (
                {overrideDecisions.length})
              </p>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                {recentAssignments
                  .filter((a) => a.assignmentType !== 'primary' || a.priorityOverride)
                  .slice(0, 10)
                  .map((a) => (
                    <div key={a._id} className="p-2.5 text-xs flex justify-between gap-2">
                      <div>
                        <span className="font-mono font-semibold text-slate-900">{a.reportId}</span>
                        <span className="text-slate-600 ml-2">
                          {a.assignmentType.toUpperCase()} → {a.handlerName}
                        </span>
                      </div>
                      <PriorityText priority={a.priority} override={a.priorityOverride} />
                    </div>
                  ))}
                {recentAssignments.filter((a) => a.assignmentType !== 'primary' || a.priorityOverride)
                  .length === 0 && (
                  <p className="p-3 text-xs text-slate-500">
                    No backup assignments or priority overrides triggered yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
