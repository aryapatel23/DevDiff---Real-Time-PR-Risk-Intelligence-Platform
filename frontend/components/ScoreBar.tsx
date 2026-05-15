export default function ScoreBar({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const color =
    clamped >= 80 ? 'bg-green-500' :
    clamped >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-700 rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-sm font-mono text-gray-300 w-8 text-right">{clamped}</span>
    </div>
  );
}
