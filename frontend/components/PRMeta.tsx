type PRMetaType = {
  title: string;
  author: string;
  repo: string;
  prNumber: number;
  prUrl: string;
  files: Array<{ filename: string; additions: number; deletions: number; status: string }>;
};

export default function PRMeta({ meta }: { meta: PRMetaType }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
      <div className="flex items-center gap-3 mb-2">
        <img src={`https://github.com/${meta.author}.png?size=36`} alt={meta.author} className="w-9 h-9 rounded-full" />
        <div>
          <div className="text-sm font-semibold text-white">{meta.title}</div>
          <a href={meta.prUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline">
            {meta.repo}#{meta.prNumber} · @{meta.author}
          </a>
        </div>
      </div>
      <div className="text-xs text-gray-400">{meta.files.length} files changed</div>
    </div>
  );
}
