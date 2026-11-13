import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  XCircle,
} from 'lucide-react';
import type { ComplaintStatus } from '../types/index.ts';
import type { PriorityLevel } from '../../shared/classificationEngine.ts';

export function StatusText({ status }: { status: ComplaintStatus }) {
  const styles: Record<ComplaintStatus, { color: string; Icon: typeof Clock }> = {
    Pending: { color: 'text-amber-700', Icon: Clock },
    Assigned: { color: 'text-sky-700', Icon: Info },
    'In Progress': { color: 'text-indigo-700', Icon: AlertTriangle },
    Resolved: { color: 'text-emerald-700', Icon: CheckCircle2 },
  };
  const { color, Icon } = styles[status] || styles.Pending;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${color} whitespace-nowrap`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{status}</span>
    </span>
  );
}

export function PriorityText({
  priority,
  override = false,
}: {
  priority: PriorityLevel;
  override?: boolean;
}) {
  const color =
    priority === 'CRITICAL'
      ? 'text-red-700'
      : priority === 'HIGH'
        ? 'text-amber-700'
        : 'text-slate-700';

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${color} whitespace-nowrap`}>
      {priority === 'CRITICAL' && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
      <span>{priority}</span>
      {override && <span className="text-slate-500 font-normal">(Override)</span>}
    </span>
  );
}

export function SlaCountdown({
  slaDeadline,
  status,
  resolutionTimestamp,
}: {
  slaDeadline: string;
  status: ComplaintStatus;
  resolutionTimestamp?: string | null;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (status === 'Resolved') return;
    const timer = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [status]);

  const deadlineMs = new Date(slaDeadline).getTime();

  if (status === 'Resolved') {
    const resolvedMs = resolutionTimestamp ? new Date(resolutionTimestamp).getTime() : deadlineMs;
    const met = resolvedMs <= deadlineMs;
    return (
      <span className={`text-xs font-mono tabular-nums font-medium ${met ? 'text-emerald-700' : 'text-red-700'}`}>
        {met ? 'Met SLA' : 'Breached SLA'}
      </span>
    );
  }

  const diffMs = deadlineMs - nowMs;
  if (diffMs <= 0) {
    const overdueHrs = Math.abs(Math.floor(diffMs / 3600000));
    return (
      <span className="text-xs font-mono tabular-nums font-semibold text-red-700">
        Overdue by {overdueHrs}h
      </span>
    );
  }

  const hours = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  const color = hours < 12 ? 'text-amber-700 font-semibold' : 'text-slate-700';

  return (
    <span className={`text-xs font-mono tabular-nums ${color}`}>
      {hours}h {String(mins).padStart(2, '0')}m left
    </span>
  );
}

export function ToastBanner({
  type,
  message,
  onClose,
}: {
  type: 'success' | 'error';
  message: string;
  onClose: () => void;
}) {
  return (
    <div
      role="status"
      className={`flex items-center justify-between gap-4 px-4 py-3 rounded-lg border text-sm ${
        type === 'success'
          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
          : 'bg-red-50 border-red-200 text-red-900'
      }`}
    >
      <div className="flex items-center gap-2">
        {type === 'success' ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
        ) : (
          <XCircle className="w-4 h-4 text-red-700 shrink-0" />
        )}
        <span>{message}</span>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="text-xs font-medium underline underline-offset-2 shrink-0"
      >
        Dismiss
      </button>
    </div>
  );
}

export function ConfirmationDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
        <h3 className="text-base font-semibold text-slate-900 font-display">{title}</h3>
        <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
