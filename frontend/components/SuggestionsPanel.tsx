interface Suggestion {
  filename: string;
  functionName: string;
  line: number;
  message: string;
  fix: string;
}

export function SuggestionsPanel({ suggestions, isLoading }: { suggestions: Suggestion[]; isLoading: boolean }) {
  if (!isLoading && suggestions.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-700 overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-800 border-b border-gray-700 flex items-center gap-2">
        {isLoading && <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse inline-block" />}
        <span className="text-gray-200 text-sm font-medium">
          {isLoading ? 'Running logic review…' : `${suggestions.length} improvement suggestion${suggestions.length !== 1 ? 's' : ''}`}
        </span>
        {!isLoading && <span className="text-gray-500 text-xs ml-1">from logic review</span>}
      </div>
      {suggestions.length > 0 && (
        <div className="divide-y divide-gray-700">
          {suggestions.map((s, i) => (
            <div key={i} className="px-4 py-3">
              <div className="flex items-center gap-2 mb-1.5 text-xs">
                <span className="font-mono text-gray-400 truncate">{s.filename}</span>
                <span className="text-gray-600">·</span>
                <span className="text-purple-400">{s.functionName}()</span>
                <span className="text-gray-600">·</span>
                <span className="text-gray-500">line {s.line}</span>
              </div>
              <p className="text-sm text-gray-200 mb-1">{s.message}</p>
              <p className="text-xs text-blue-300 italic">{s.fix}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
