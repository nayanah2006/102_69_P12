import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Play } from 'lucide-react';
import { complaintsApi, validationApi } from '../services/api.ts';
import { DFAVisualizer } from '../components/DFAVisualizer.tsx';
import { PriorityText, SlaCountdown, StatusText } from '../components/StatusComponents.tsx';
import type { ComplaintRecord } from '../types/index.ts';
import type { IdentifierValidationResult } from '../../shared/dfaValidator.ts';
import { getLocalTodayDateString } from '../../shared/dateValidator.ts';

export function TrackComplaintPage() {
  const [searchParams] = useSearchParams();
  const initialId = searchParams.get('id') || 'CMP-2026-1001';

  const [queryId, setQueryId] = useState(initialId);
  const [complaint, setComplaint] = useState<ComplaintRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Interactive DFA + Regex Validator Sandbox
  const todayLocal = getLocalTodayDateString();
  const [testIdentifier, setTestIdentifier] = useState(`COMP-${todayLocal}-ABC1234`);
  const [testDate, setTestDate] = useState(todayLocal);
  const [sandboxResult, setSandboxResult] = useState<IdentifierValidationResult | null>(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);

  const performTrack = async (idToFetch: string) => {
    if (!idToFetch.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await complaintsApi.track(idToFetch.trim());
      setComplaint(res.complaint);
    } catch (err: unknown) {
      setComplaint(null);
      setErrorMsg(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'No complaint found with that ID.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialId) {
      performTrack(initialId);
    }
  }, [initialId]);

  const handleTrackSubmit = (e: FormEvent) => {
    e.preventDefault();
    performTrack(queryId);
  };

  const runServerValidation = async (identifier: string, dateVal: string) => {
    setSandboxLoading(true);
    try {
      const res = await validationApi.validate({
        identifier,
        complaintDate: dateVal || undefined,
      });
      setSandboxResult(res.validation);
    } finally {
      setSandboxLoading(false);
    }
  };

  useEffect(() => {
    runServerValidation(testIdentifier, testDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const SAMPLE_TEST_CASES = [
    { label: 'Valid Today', id: `COMP-${todayLocal}-ABC1234`, date: todayLocal },
    { label: 'Valid Leap Year (2024-02-29)', id: 'COMP-2024-02-29-DEF2048', date: '2024-02-29' },
    { label: 'Invalid Leap Year (2025-02-29)', id: 'COMP-2025-02-29-ABC1234', date: '2025-02-29' },
    { label: 'Impossible Date (2026-02-30)', id: 'COMP-2026-02-30-ABC1234', date: '2026-02-30' },
    { label: 'Invalid Month (2026-13-10)', id: 'COMP-2026-13-10-ABC1234', date: '2026-13-10' },
    { label: 'Invalid Resto Code (ab12)', id: `COMP-${todayLocal}-ab12`, date: todayLocal },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Section 1: Track Complaint */}
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display">
            Track Complaint Status
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Look up any complaint using its unique Report ID (e.g., CMP-2026-1001) or Restaurant
            Identifier.
          </p>
        </div>

        <form onSubmit={handleTrackSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={queryId}
              onChange={(e) => setQueryId(e.target.value)}
              placeholder="Enter Complaint ID (e.g., CMP-2026-1001) or COMP-..."
              className="w-full pl-9 pr-3 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {loading ? 'Searching...' : 'Track Complaint'}
          </button>
        </form>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
            {errorMsg}
          </div>
        )}

        {complaint && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                  <span>{complaint.reportId}</span>
                  <span aria-hidden="true">·</span>
                  <span>{complaint.originalIdentifier}</span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 font-display mt-1">
                  {complaint.restaurantName}
                </h2>
                <p className="text-xs text-slate-600">{complaint.restaurantDistrict}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusText status={complaint.currentStatus} />
                <SlaCountdown
                  slaDeadline={complaint.slaDeadline}
                  status={complaint.currentStatus}
                  resolutionTimestamp={complaint.resolutionTimestamp}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-500">Category</p>
                <p className="font-semibold text-slate-900">{complaint.detectedCategory}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Priority</p>
                <div className="mt-0.5">
                  <PriorityText
                    priority={complaint.priority}
                    override={complaint.priorityOverride}
                  />
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500">Assigned Zone</p>
                <p className="font-medium text-slate-900">{complaint.assignedZone}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Assigned Officer</p>
                <p className="font-medium text-slate-900">{complaint.assignedHandlerName}</p>
              </div>
            </div>

            <div className="space-y-1 text-sm">
              <p className="text-xs font-semibold text-slate-700">Complaint Description</p>
              <p className="text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3">
                {complaint.description}
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-700">Status History Audit Trail</p>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {complaint.statusHistory.map((item) => (
                  <div key={item._id} className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-slate-900">
                        {item.previousStatus} → {item.newStatus}
                      </p>
                      <p className="text-slate-600">{item.remarks}</p>
                    </div>
                    <div className="text-right text-slate-500 font-mono tabular-nums">
                      <p>{item.updatedByName}</p>
                      <p>{new Date(item.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Section 2: Interactive DFA & Regex Validator Sandbox */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-display">
            DFA & Regular Expression Validation Inspector
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Verify any complaint identifier against the server-side Deterministic Finite Automaton
            (q0–q22, q_accept, q_reject), regular expression, and semantic calendar-date validator.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {SAMPLE_TEST_CASES.map((tc) => (
            <button
              key={tc.label}
              type="button"
              onClick={() => {
                setTestIdentifier(tc.id);
                setTestDate(tc.date);
                runServerValidation(tc.id, tc.date);
              }}
              className="px-2.5 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md transition-colors"
            >
              {tc.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="sm:col-span-2">
            <label htmlFor="sandboxIdentifier" className="block text-xs font-medium text-slate-700 mb-1">
              Test Identifier String
            </label>
            <input
              id="sandboxIdentifier"
              type="text"
              value={testIdentifier}
              onChange={(e) => setTestIdentifier(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label htmlFor="sandboxDate" className="block text-xs font-medium text-slate-700 mb-1">
                Expected Date
              </label>
              <input
                id="sandboxDate"
                type="text"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>
            <button
              type="button"
              disabled={sandboxLoading}
              onClick={() => runServerValidation(testIdentifier, testDate)}
              className="self-end inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Run</span>
            </button>
          </div>
        </div>

        <DFAVisualizer result={sandboxResult} defaultExpanded />
      </section>
    </div>
  );
}
