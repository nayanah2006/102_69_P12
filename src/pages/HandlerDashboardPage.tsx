import { useEffect, useState } from 'react';
import { complaintsApi, handlersApi } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  ConfirmationDialog,
  PriorityText,
  SlaCountdown,
  StatusText,
  ToastBanner,
} from '../components/StatusComponents.tsx';
import type { ComplaintRecord, ComplaintStatus, HandlerProfile } from '../types/index.ts';

export function HandlerDashboardPage() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [handlers, setHandlers] = useState<HandlerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintRecord | null>(null);
  const [nextStatus, setNextStatus] = useState<ComplaintStatus>('In Progress');
  const [remarks, setRemarks] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [capacityInput, setCapacityInput] = useState<number>(5);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cRes, hRes] = await Promise.all([complaintsApi.list(), handlersApi.list()]);
      setComplaints(cRes.complaints);
      setHandlers(hRes.handlers);
      const myProfile = hRes.handlers.find(
        (h) => h._id === user?.handlerProfileId || h.userId === user?.id
      );
      if (myProfile) {
        setCapacityInput(myProfile.maxCapacity);
      }
    } catch (err: unknown) {
      setToast({
        type: 'error',
        message:
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to load handler console.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const myHandlerProfile =
    handlers.find((h) => h._id === user?.handlerProfileId || h.userId === user?.id) || null;

  const handleToggleAvailability = async (handler: HandlerProfile) => {
    try {
      const res = await handlersApi.setAvailability(handler._id, !handler.isAvailable);
      setHandlers((prev) => prev.map((h) => (h._id === handler._id ? res.handler : h)));
      setToast({ type: 'success', message: res.message });
    } catch (err: unknown) {
      setToast({
        type: 'error',
        message:
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to update availability.',
      });
    }
  };

  const handleCapacitySave = async (handler: HandlerProfile) => {
    try {
      const res = await handlersApi.setCapacity(handler._id, Number(capacityInput));
      setHandlers((prev) => prev.map((h) => (h._id === handler._id ? res.handler : h)));
      setToast({ type: 'success', message: res.message });
    } catch (err: unknown) {
      setToast({
        type: 'error',
        message:
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to update capacity.',
      });
    }
  };

  const handleQuickAccept = async (complaint: ComplaintRecord) => {
    try {
      const res = await complaintsApi.updateStatus(complaint._id, {
        newStatus: 'In Progress',
        remarks: 'Accepted by Food Safety Officer; inspection initiated.',
      });
      setComplaints((prev) => prev.map((c) => (c._id === complaint._id ? res.complaint : c)));
      setToast({ type: 'success', message: res.message });
    } catch (err: unknown) {
      setToast({
        type: 'error',
        message:
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to accept complaint.',
      });
    }
  };

  const executeStatusUpdate = async () => {
    if (!selectedComplaint) return;
    setConfirmOpen(false);
    try {
      const res = await complaintsApi.updateStatus(selectedComplaint._id, {
        newStatus: nextStatus,
        remarks: remarks.trim() || `Updated to ${nextStatus}`,
      });
      setComplaints((prev) =>
        prev.map((c) => (c._id === selectedComplaint._id ? res.complaint : c))
      );
      // Reload handler workload counters if resolved
      const hRes = await handlersApi.list();
      setHandlers(hRes.handlers);
      setSelectedComplaint(null);
      setRemarks('');
      setToast({ type: 'success', message: res.message });
    } catch (err: unknown) {
      setToast({
        type: 'error',
        message:
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to update status.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display">
            Food Safety Officer Console
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage assigned complaints, monitor 48-hour critical SLA timers, and control your
            availability and workload capacity.
          </p>
        </div>
      </div>

      {toast && (
        <ToastBanner
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* Officer Profile & Workload Control */}
      {myHandlerProfile && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
              <span>{myHandlerProfile.officerCode}</span>
              <span aria-hidden="true">·</span>
              <span>{myHandlerProfile.zone}</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 font-display">
              {myHandlerProfile.name}
            </h2>
            <p className="text-xs text-slate-600 font-mono tabular-nums">
              Active Workload: <strong>{myHandlerProfile.currentWorkload}</strong> /{' '}
              <strong>{myHandlerProfile.maxCapacity}</strong> cases
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="capacityInput" className="text-xs font-medium text-slate-700">
                Max Capacity:
              </label>
              <input
                id="capacityInput"
                type="number"
                min={1}
                max={100}
                value={capacityInput}
                onChange={(e) => setCapacityInput(Number(e.target.value))}
                className="w-16 px-2.5 py-1.5 text-sm font-mono border border-slate-300 rounded-lg"
              />
              <button
                type="button"
                onClick={() => handleCapacitySave(myHandlerProfile)}
                className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Save Capacity
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleToggleAvailability(myHandlerProfile)}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                myHandlerProfile.isAvailable
                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
            >
              {myHandlerProfile.isAvailable ? 'Status: Available' : 'Status: Unavailable'}
            </button>
          </div>
        </div>
      )}

      {/* Assigned Complaints Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Assigned Inspection Queue ({complaints.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : complaints.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No complaints currently assigned to your queue.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold">Report ID</th>
                  <th className="py-3 px-4 font-semibold">Restaurant & Zone</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold">Priority</th>
                  <th className="py-3 px-4 font-semibold">SLA Remaining</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {complaints.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-xs tabular-nums">
                      <div className="font-semibold text-slate-900">{c.reportId}</div>
                      <div className="text-slate-500">
                        {new Date(c.submissionTimestamp).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{c.restaurantName}</div>
                      <div className="text-xs text-slate-500">
                        {c.assignedZone} · {c.assignedHandlerName}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-800">
                      {c.detectedCategory}
                    </td>
                    <td className="py-3 px-4">
                      <PriorityText priority={c.priority} override={c.priorityOverride} />
                    </td>
                    <td className="py-3 px-4">
                      <SlaCountdown
                        slaDeadline={c.slaDeadline}
                        status={c.currentStatus}
                        resolutionTimestamp={c.resolutionTimestamp}
                      />
                    </td>
                    <td className="py-3 px-4">
                      <StatusText status={c.currentStatus} />
                    </td>
                    <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                      {c.currentStatus === 'Assigned' && (
                        <button
                          type="button"
                          onClick={() => handleQuickAccept(c)}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-md transition-colors"
                        >
                          Accept
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedComplaint(c);
                          setNextStatus(
                            c.currentStatus === 'Assigned'
                              ? 'In Progress'
                              : c.currentStatus === 'In Progress'
                                ? 'Resolved'
                                : c.currentStatus
                          );
                          setRemarks('');
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                      >
                        Update Status
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inline Status Update Drawer/Panel */}
      {selectedComplaint && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 font-display">
                Update Status for {selectedComplaint.reportId}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {selectedComplaint.restaurantName} · Current Status: {selectedComplaint.currentStatus}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedComplaint(null)}
              className="text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              Close
            </button>
          </div>

          <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3">
            {selectedComplaint.description}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="nextStatusSelect" className="block text-xs font-medium text-slate-700 mb-1">
                New Status
              </label>
              <select
                id="nextStatusSelect"
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value as ComplaintStatus)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="Pending">Pending</option>
                <option value="Assigned">Assigned</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="statusRemarks" className="block text-xs font-medium text-slate-700 mb-1">
                Inspection Remarks
              </label>
              <input
                id="statusRemarks"
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter inspection notes or corrective action taken..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setSelectedComplaint(null)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg"
            >
              Commit Status Update
            </button>
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={confirmOpen}
        title="Confirm Status Update"
        message={`Update complaint ${selectedComplaint?.reportId || ''} from '${selectedComplaint?.currentStatus || ''}' to '${nextStatus}'? This action is recorded in the permanent audit trail.`}
        confirmLabel="Confirm Update"
        onConfirm={executeStatusUpdate}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
