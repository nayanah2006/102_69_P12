import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Sparkles, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { complaintsApi } from '../services/api.ts';
import { getLocalTodayDateString, validateCalendarDate } from '../../shared/dateValidator.ts';
import { validateComplaintIdentifier } from '../../shared/dfaValidator.ts';
import { COMPLAINT_CATEGORIES, classifyComplaint } from '../../shared/classificationEngine.ts';
import { DFAVisualizer } from '../components/DFAVisualizer.tsx';
import { PriorityText, StatusText, ToastBanner } from '../components/StatusComponents.tsx';
import type { ComplaintRecord } from '../types/index.ts';

const DISTRICTS = [
  'Zone 1 — Central & Downtown District',
  'Zone 2 — East & Tech Park District',
  'Zone 3 — South & Heritage Market District',
  'Zone 4 — West & Transit Hub District',
];

export function SubmitComplaintPage() {
  const { user } = useAuth();
  const todayLocal = useMemo(() => getLocalTodayDateString(), []);

  const [reporterName, setReporterName] = useState(user?.name || '');
  const [reporterEmail, setReporterEmail] = useState(user?.email || '');
  const [reporterMobile, setReporterMobile] = useState(user?.mobile || '');
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantDistrict, setRestaurantDistrict] = useState(DISTRICTS[0]);
  const [complaintDate, setComplaintDate] = useState(todayLocal);
  const [originalIdentifier, setOriginalIdentifier] = useState(`COMP-${todayLocal}-ABC1234`);
  const [complaintCategory, setComplaintCategory] = useState<string>('Hygiene');
  const [urgencyLevel, setUrgencyLevel] = useState<string>('Standard');
  const [description, setDescription] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedComplaint, setSubmittedComplaint] = useState<ComplaintRecord | null>(null);

  useEffect(() => {
    if (user) {
      setReporterName((prev) => prev || user.name);
      setReporterEmail((prev) => prev || user.email);
      setReporterMobile((prev) => prev || user.mobile);
    }
  }, [user]);

  const dateValidation = useMemo(() => validateCalendarDate(complaintDate), [complaintDate]);
  const identifierValidation = useMemo(
    () =>
      validateComplaintIdentifier(originalIdentifier, {
        expectedComplaintDate: dateValidation.isValid ? complaintDate : undefined,
      }),
    [originalIdentifier, complaintDate, dateValidation.isValid]
  );

  const liveClassification = useMemo(() => {
    if (!description.trim()) return null;
    return classifyComplaint(description, {
      userSelectedCategory: complaintCategory,
      userUrgency: urgencyLevel,
    });
  }, [description, complaintCategory, urgencyLevel]);

  const handleGenerateSampleIdentifier = (prefix: string) => {
    const safeDate = dateValidation.isValid ? complaintDate : todayLocal;
    const digits = String(Math.floor(1000 + Math.random() * 9000));
    setOriginalIdentifier(`COMP-${safeDate}-${prefix}${digits}`);
  };

  const handleDateChange = (newDate: string) => {
    setComplaintDate(newDate);
    // Keep suffix if user has standard format, updating embedded date only when requested or valid
    const suffixMatch = /-([A-Z]{3}[0-9]{4})$/.exec(originalIdentifier.trim());
    if (suffixMatch && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(newDate)) {
      setOriginalIdentifier(`COMP-${newDate}-${suffixMatch[1]}`);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!dateValidation.isValid) {
      setErrorMsg(dateValidation.message);
      return;
    }

    if (!identifierValidation.isValid) {
      setErrorMsg(identifierValidation.message);
      return;
    }

    if (!description.trim()) {
      setErrorMsg('Please enter a detailed complaint description.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await complaintsApi.submit({
        reporterName: reporterName.trim(),
        reporterEmail: reporterEmail.trim(),
        reporterMobile: reporterMobile.trim(),
        restaurantName: restaurantName.trim(),
        restaurantDistrict,
        originalIdentifier: originalIdentifier.trim(),
        complaintDate: complaintDate.trim(),
        complaintCategory,
        description: description.trim(),
        urgencyLevel,
      });
      setSubmittedComplaint(res.complaint);
    } catch (err: unknown) {
      const apiMsg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Submission failed. Please verify all fields.';
      setErrorMsg(apiMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedComplaint) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <h1 className="text-xl font-bold text-slate-900 font-display">
                Complaint Registered & Routed
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Your complaint passed DFA and Regex identifier validation, semantic calendar-date
                checks, automated classification, and zone dispatch.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200 text-sm">
            <div>
              <p className="text-xs text-slate-500">Generated Complaint ID</p>
              <p className="font-mono font-semibold text-slate-900 text-base tabular-nums">
                {submittedComplaint.reportId}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Validated Identifier</p>
              <p className="font-mono font-medium text-slate-900 tabular-nums">
                {submittedComplaint.originalIdentifier}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Detected Category</p>
              <p className="font-semibold text-slate-900">{submittedComplaint.detectedCategory}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Priority & SLA</p>
              <div className="flex items-center gap-2 mt-0.5">
                <PriorityText
                  priority={submittedComplaint.priority}
                  override={submittedComplaint.priorityOverride}
                />
                <span className="text-slate-400">·</span>
                <span className="text-xs font-mono text-slate-700 tabular-nums">
                  {submittedComplaint.slaHours}h SLA
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500">Assigned District Zone</p>
              <p className="font-medium text-slate-900">{submittedComplaint.assignedZone}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Assigned Food Safety Officer</p>
              <p className="font-medium text-slate-900">
                {submittedComplaint.assignedHandlerName} ({submittedComplaint.assignmentType})
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Current Status</p>
              <div className="mt-0.5">
                <StatusText status={submittedComplaint.currentStatus} />
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500">SLA Deadline</p>
              <p className="font-mono text-xs text-slate-900 tabular-nums">
                {new Date(submittedComplaint.slaDeadline).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 space-y-2">
            <p className="text-xs font-semibold text-slate-700">Routing Decision Trace</p>
            <ul className="space-y-1 text-xs text-slate-600 font-mono">
              {submittedComplaint.routingDecisionLog.map((line, idx) => (
                <li key={idx}>• {line}</li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              to={`/track?id=${encodeURIComponent(submittedComplaint.reportId)}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors"
            >
              <span>Track Live Progress</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              type="button"
              onClick={() => {
                setSubmittedComplaint(null);
                setDescription('');
                setRestaurantName('');
                handleGenerateSampleIdentifier('ABC');
              }}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Submit Another Complaint
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900 font-display">
          Submit Restaurant Food Safety Complaint
        </h1>
        <p className="text-sm text-slate-600 max-w-2xl">
          Reports are verified using dual DFA and Regex validation, strict calendar-date checks,
          and automatically routed to the district Food Safety Officer.
        </p>
      </div>

      {errorMsg && (
        <ToastBanner type="error" message={errorMsg} onClose={() => setErrorMsg(null)} />
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          {/* Reporter Details */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
              1. Reporter Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="reporterName" className="block text-xs font-medium text-slate-700 mb-1">
                  Reporter Name
                </label>
                <input
                  id="reporterName"
                  type="text"
                  required
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  placeholder="Full name"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>
              <div>
                <label htmlFor="reporterMobile" className="block text-xs font-medium text-slate-700 mb-1">
                  Mobile Number
                </label>
                <input
                  id="reporterMobile"
                  type="tel"
                  required
                  value={reporterMobile}
                  onChange={(e) => setReporterMobile(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="reporterEmail" className="block text-xs font-medium text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  id="reporterEmail"
                  type="email"
                  required
                  value={reporterEmail}
                  onChange={(e) => setReporterEmail(e.target.value)}
                  placeholder="citizen@example.com"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>
            </div>
          </section>

          {/* Restaurant & Identifier Validation */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
              2. Restaurant & Identifier Validation
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="restaurantName" className="block text-xs font-medium text-slate-700 mb-1">
                  Restaurant Name
                </label>
                <input
                  id="restaurantName"
                  type="text"
                  required
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  placeholder="e.g., Spice Garden Bistro"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>
              <div>
                <label htmlFor="restaurantDistrict" className="block text-xs font-medium text-slate-700 mb-1">
                  Restaurant Location / District
                </label>
                <select
                  id="restaurantDistrict"
                  value={restaurantDistrict}
                  onChange={(e) => setRestaurantDistrict(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
                >
                  {DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="complaintDate" className="block text-xs font-medium text-slate-700 mb-1">
                  Complaint Date (Max: {todayLocal})
                </label>
                <input
                  id="complaintDate"
                  type="date"
                  required
                  max={todayLocal}
                  value={complaintDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className={`w-full px-3 py-2 text-sm font-mono border rounded-lg focus:outline-none focus:ring-2 ${
                    dateValidation.isValid
                      ? 'border-slate-300 focus:ring-sky-600'
                      : 'border-red-400 focus:ring-red-500'
                  }`}
                />
                {!dateValidation.isValid && (
                  <p className="text-xs text-red-700 mt-1">{dateValidation.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="originalIdentifier" className="block text-xs font-medium text-slate-700 mb-1">
                  Restaurant Complaint Identifier
                </label>
                <input
                  id="originalIdentifier"
                  type="text"
                  required
                  value={originalIdentifier}
                  onChange={(e) => setOriginalIdentifier(e.target.value)}
                  placeholder={`COMP-${todayLocal}-ABC1234`}
                  className={`w-full px-3 py-2 text-sm font-mono border rounded-lg focus:outline-none focus:ring-2 ${
                    identifierValidation.isValid
                      ? 'border-slate-300 focus:ring-sky-600'
                      : 'border-red-400 focus:ring-red-500'
                  }`}
                />
              </div>
            </div>

            {/* Quick Zone Prefix Sample Helpers */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span>Sample zone prefixes:</span>
              {(['ABC', 'DEF', 'GHI', 'JKL'] as const).map((prefix, idx) => (
                <button
                  key={prefix}
                  type="button"
                  onClick={() => handleGenerateSampleIdentifier(prefix)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-mono transition-colors"
                >
                  {prefix} (Zone {idx + 1})
                </button>
              ))}
            </div>

            <DFAVisualizer result={identifierValidation} />
          </section>

          {/* Classification & Incident Details */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
              3. Incident Description & Classification
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="complaintCategory" className="block text-xs font-medium text-slate-700 mb-1">
                  Reported Category
                </label>
                <select
                  id="complaintCategory"
                  value={complaintCategory}
                  onChange={(e) => setComplaintCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
                >
                  {COMPLAINT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="urgencyLevel" className="block text-xs font-medium text-slate-700 mb-1">
                  Urgency Level
                </label>
                <select
                  id="urgencyLevel"
                  value={urgencyLevel}
                  onChange={(e) => setUrgencyLevel(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
                >
                  <option value="Standard">Standard</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-xs font-medium text-slate-700 mb-1">
                Complaint Description
              </label>
              <textarea
                id="description"
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue clearly (e.g., dirty kitchen with insects, plastic in food, chemical mixing, wrong expiry date, rude staff)..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>
          </section>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="submit"
              disabled={submitting || !dateValidation.isValid || !identifierValidation.isValid}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {submitting ? 'Validating & Dispatching...' : 'Submit Complaint'}
            </button>
          </div>
        </div>

        {/* Live Automated Classification & Routing Preview Sidebar */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Sparkles className="w-4 h-4 text-sky-700" />
              <span>Automated Triage Preview</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Real-time classification, priority override, and SLA evaluation.
            </p>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-100 text-xs">
            <div>
              <span className="text-slate-500 block">Identifier Structure</span>
              <span className="font-mono font-medium text-slate-900">
                {identifierValidation.isValid
                  ? `Valid (${identifierValidation.extracted?.restoPrefix} routing key)`
                  : 'Pending valid COMP-YYYY-MM-DD-AAA0000'}
              </span>
            </div>

            {liveClassification ? (
              <>
                <div>
                  <span className="text-slate-500 block">Detected Category</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {liveClassification.category}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">Matched Keywords</span>
                  <span className="text-slate-800 font-mono">
                    {liveClassification.matchedKeywords.length > 0
                      ? liveClassification.matchedKeywords.join(', ')
                      : 'None matched (flagged for admin review)'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">Assigned Priority & SLA</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <PriorityText
                      priority={liveClassification.priority}
                      override={liveClassification.priorityOverride}
                    />
                    <span className="text-slate-400">·</span>
                    <span className="font-mono text-slate-900">
                      {liveClassification.slaHours} hours
                    </span>
                  </div>
                </div>

                {liveClassification.isHighRisk && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>High-Risk 48-Hour SLA Enforced</span>
                    </div>
                    <p>
                      {liveClassification.category} complaints automatically receive CRITICAL
                      priority and a mandatory 48-hour resolution deadline.
                    </p>
                  </div>
                )}

                <div>
                  <span className="text-slate-500 block">Rule Applied</span>
                  <p className="text-slate-700 leading-relaxed">
                    {liveClassification.deterministicRuleApplied}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-slate-500">
                Start typing a complaint description to preview automated keyword classification and
                SLA assignment.
              </p>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
