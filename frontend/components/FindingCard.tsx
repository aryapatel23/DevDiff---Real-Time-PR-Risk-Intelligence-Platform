import ConfidenceBadge from './ConfidenceBadge';
import { useState } from 'react';

type Finding = {
  filename: string; line_number: number; rule_name: string;
  severity: 'critical' | 'warning' | 'info';
  confidence: number; message: string; fix_hint: string;
  isDangerZone?: boolean;
};

export default function FindingCard({ finding }: { finding: Finding }) {
  const [showFix, setShowFix] = useState(false);

  const borderColor =
    finding.severity === 'critical' ? 'border-l-red-500' :
    finding.severity === 'warning'  ? 'border-l-amber-500' : 'border-l-blue-500';

  const sevColor =
    finding.severity === 'critical' ? 'text-red-400 bg-red-950'  :
    finding.severity === 'warning'  ? 'text-amber-400 bg-amber-950' : 'text-blue-400 bg-blue-950';

  return (
    <div className={`bg-gray-900 border border-gray-800 border-l-4 ${borderColor} rounded-lg p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded uppercase ${sevColor}`}>
              {finding.severity}
            </span>
            <ConfidenceBadge score={finding.confidence} />
            {finding.isDangerZone && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-900 text-red-300 uppercase">
                Danger Zone
              </span>
            )}
          </div>
          <p className="text-gray-200 text-sm mb-1">{finding.message}</p>
          <p className="text-gray-500 text-xs font-mono">
            {finding.filename}:{finding.line_number} — {finding.rule_name}
          </p>
        </div>
      </div>
      {finding.fix_hint && (
        <div className="mt-2">
          <button
            onClick={() => setShowFix(!showFix)}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            {showFix ? 'Hide fix ▲' : 'Show fix hint ▼'}
          </button>
          {showFix && (
            <div className="mt-2 bg-gray-800 rounded px-3 py-2 text-xs text-green-300 font-mono">
              {finding.fix_hint}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
