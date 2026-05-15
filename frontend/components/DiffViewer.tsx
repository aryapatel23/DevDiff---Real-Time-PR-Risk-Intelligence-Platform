import React, { useState } from 'react';

interface DiffLine { lineNo: number; content: string; isAdded: boolean; }
interface DiffFile { filename: string; lines: DiffLine[]; patch: string; }
interface Finding {
  filename: string;
  line_number: number;
  rule_name: string;
  severity: string;
  confidence: number;
  message: string;
  fix_hint?: string;
  fix?: string;
  source?: string;
  type?: string;
}

const SEV: Record<string, string> = {
  critical: 'border-l-2 border-red-500 bg-red-950/60 text-red-200',
  warning: 'border-l-2 border-yellow-500 bg-yellow-950/60 text-yellow-200',
  suggestion: 'border-l-2 border-blue-500 bg-blue-950/60 text-blue-200',
  info: 'border-l-2 border-gray-500 bg-gray-800 text-gray-300',
};

export function DiffViewer({ files, findings }: { files: DiffFile[]; findings: Finding[] }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const findingMap: Record<string, Record<number, Finding[]>> = {};
  for (const f of findings) {
    const line = f.line_number ?? (f as any).line;
    if (!line) continue;
    if (!findingMap[f.filename]) findingMap[f.filename] = {};
    if (!findingMap[f.filename][line]) findingMap[f.filename][line] = [];
    findingMap[f.filename][line].push(f);
  }

  if (!files.length) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Changed files</p>
      {files.map(file => {
        const fm = findingMap[file.filename] || {};
        const total = Object.values(fm).flat().length;
        const isCollapsed = collapsed.has(file.filename);
        return (
          <div key={file.filename} className="rounded-lg overflow-hidden border border-gray-700">
            <button
              onClick={() => setCollapsed(p => { const n = new Set(p); n.has(file.filename) ? n.delete(file.filename) : n.add(file.filename); return n; })}
              className="w-full flex items-center gap-3 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-left"
            >
              <span className="text-gray-500 text-xs">{isCollapsed ? '▶' : '▼'}</span>
              <span className="text-gray-200 text-xs font-mono flex-1 truncate">{file.filename}</span>
              {total > 0 && <span className="text-xs px-2 py-0.5 rounded bg-red-900 text-red-300">{total} {total === 1 ? 'finding' : 'findings'}</span>}
              <span className="text-gray-600 text-xs">{file.lines.length} lines</span>
            </button>
            {!isCollapsed && (
              <div className="divide-y divide-gray-800">
                {file.lines.map(line => {
                  const lf = fm[line.lineNo] || [];
                  return (
                    <React.Fragment key={line.lineNo}>
                      <div className={`flex items-start font-mono text-xs ${lf.length ? 'bg-yellow-950/20' : ''}`}>
                        <span className="select-none text-gray-600 px-2 py-1.5 border-r border-gray-700 min-w-[2.5rem] text-right">{line.lineNo}</span>
                        <span className="select-none text-green-500 px-2 py-1.5 border-r border-gray-700">+</span>
                        <span className="text-green-300 px-3 py-1.5 whitespace-pre flex-1 min-w-0 overflow-x-auto">{line.content}</span>
                        {lf.length > 0 && <span className="self-center mr-2 text-red-400 text-xs">● {lf.length}</span>}
                      </div>
                      {lf.map((f, i) => (
                        <div key={i} className={`mx-3 my-1 px-3 py-2 rounded text-xs ${SEV[f.severity] || SEV.info}`}>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`px-1.5 py-0.5 rounded font-medium text-xs ${f.source === 'llm' ? 'bg-purple-800 text-purple-200' : 'bg-orange-800 text-orange-200'}`}>
                              {f.source === 'llm' ? 'logic' : 'syntax'}
                            </span>
                            <span className="font-medium capitalize">{f.severity}</span>
                            <span className="text-gray-400 truncate">{f.rule_name}</span>
                            <span className="ml-auto text-gray-400">{Math.round(f.confidence)}%</span>
                          </div>
                          <p className="mb-1">{f.message}</p>
                          {(f.fix_hint || f.fix) && <p className="text-gray-400 italic">Fix: {f.fix_hint || f.fix}</p>}
                        </div>
                      ))}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
