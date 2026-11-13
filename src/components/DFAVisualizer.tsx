import { useState } from 'react';
import { CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { IdentifierValidationResult } from '../../shared/dfaValidator.ts';

export function DFAVisualizer({
  result,
  defaultExpanded = false,
}: {
  result: IdentifierValidationResult | null;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!result) return null;

  return (
    <div className="border border-slate-200 rounded-lg bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {result.isValid ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span
            className={`text-sm font-medium ${
              result.isValid ? 'text-emerald-800' : 'text-red-800'
            }`}
          >
            {result.message}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-900 whitespace-nowrap shrink-0"
        >
          <span>{expanded ? 'Hide DFA & Regex Trace' : 'Inspect DFA & Regex Trace'}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Concise unboxed metadata comparison */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 font-mono tabular-nums">
        <span>
          DFA: <strong className={result.dfaAccepted ? 'text-emerald-700' : 'text-red-700'}>
            {result.dfaAccepted ? 'ACCEPT' : 'REJECT'} ({result.finalDfaState})
          </strong>
        </span>
        <span aria-hidden="true">·</span>
        <span>
          Regex: <strong className={result.regexAccepted ? 'text-emerald-700' : 'text-red-700'}>
            {result.regexAccepted ? 'MATCH' : 'NO MATCH'}
          </strong>
        </span>
        <span aria-hidden="true">·</span>
        <span>
          Equivalence: <strong className="text-slate-900">{result.methodsMatch ? 'IDENTICAL' : 'DIVERGENT'}</strong>
        </span>
        {result.extracted && (
          <>
            <span aria-hidden="true">·</span>
            <span>
              Date: <strong className="text-slate-900">{result.extracted.dateStr}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Routing Prefix: <strong className="text-slate-900">{result.extracted.restoPrefix}</strong>
            </span>
          </>
        )}
      </div>

      {expanded && (
        <div className="pt-3 border-t border-slate-200 space-y-3">
          <div className="text-xs text-slate-600 space-y-1">
            <p>
              <span className="font-semibold text-slate-800">Regex Pattern:</span>{' '}
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">
                ^COMP-([0-9]{'{4}'})-([0-9]{'{2}'})-([0-9]{'{2}'})-([A-Z]{'{3}'}[0-9]{'{4}'})$
              </code>
            </p>
            <p>
              <span className="font-semibold text-slate-800">DFA 5-Tuple:</span>{' '}
              Q = {'{q0..q22, q_accept, q_reject}'}, Start = q0, Accepting F = {'{q_accept}'}, Trap = q_reject
            </p>
          </div>

          {result.dfaTrace.length > 0 && (
            <div className="overflow-x-auto border border-slate-200 rounded-md">
              <table className="w-full text-left text-xs font-mono tabular-nums">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2 px-3 font-semibold">Step</th>
                    <th className="py-2 px-3 font-semibold">Input</th>
                    <th className="py-2 px-3 font-semibold">From</th>
                    <th className="py-2 px-3 font-semibold">To</th>
                    <th className="py-2 px-3 font-semibold font-sans">Transition Rule</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.dfaTrace.map((step) => (
                    <tr
                      key={step.step}
                      className={step.acceptedStep ? 'bg-white' : 'bg-red-50 text-red-800'}
                    >
                      <td className="py-1.5 px-3">{step.step}</td>
                      <td className="py-1.5 px-3 font-bold">'{step.char}'</td>
                      <td className="py-1.5 px-3">{step.fromState}</td>
                      <td className="py-1.5 px-3 font-semibold">{step.toState}</td>
                      <td className="py-1.5 px-3 font-sans">{step.expectation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
