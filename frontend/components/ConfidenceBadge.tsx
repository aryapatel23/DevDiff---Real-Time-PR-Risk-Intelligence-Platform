export default function ConfidenceBadge({ score }: { score: number }) {
  const rounded = Math.round(score);
  const color =
    rounded >= 80 ? 'bg-green-900 text-green-300' :
    rounded >= 60 ? 'bg-amber-900 text-amber-300' :
                    'bg-gray-800 text-gray-400';
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-mono ${color}`}>
      {rounded}% confidence
    </span>
  );
}
