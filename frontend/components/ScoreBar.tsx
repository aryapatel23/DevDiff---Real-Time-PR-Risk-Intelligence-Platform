export default function ScoreBar({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const color =
    clamped >= 80 ? 'bg-safe' :
    clamped >= 50 ? 'bg-high' : 'bg-critical';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-surface-3 rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-sm font-mono text-text-normal w-8 text-right">{clamped}</span>
    </div>
  );
}
