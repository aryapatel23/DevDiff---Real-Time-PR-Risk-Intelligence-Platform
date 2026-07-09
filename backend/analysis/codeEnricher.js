const axios = require('axios');
require('dotenv').config();

function findFunctionBoundary(sourceLines, targetLineNo) {
  let startLine = Math.max(0, targetLineNo - 1);

  for (let i = targetLineNo - 1; i >= 0; i--) {
    const line = sourceLines[i];
    if (/\b(function\s+\w+|async\s+function\s+\w+|class\s+\w+)/.test(line)
      || /\b(const|let|var)\s+\w+\s*=\s*(async\s+)?(\(.*?\)\s*=>|function)/.test(line)
      || /^\s*\w+\s*\(.*\)\s*\{/.test(line)) {
      startLine = i;
      break;
    }
    if (i < targetLineNo - 30 && line.trim() === '') {
      startLine = i + 1;
      break;
    }
  }

  let depth = 0;
  let endLine = startLine;
  for (let i = startLine; i < Math.min(startLine + 80, sourceLines.length); i++) {
    depth += (sourceLines[i].match(/\{/g) || []).length;
    depth -= (sourceLines[i].match(/\}/g) || []).length;
    endLine = i;
    if (depth <= 0 && i > startLine + 2) break;
  }

  return { startLine, endLine };
}

function extractFunctionName(line = '') {
  const m = line.match(/function\s+(\w+)/)
    || line.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\(|function)/)
    || line.match(/(?:const|let|var)\s+(\w+)\s*=/)
    || line.match(/async\s+(\w+)\s*\(/)
    || line.match(/(\w+)\s*\(.*\)\s*\{/);
  return m ? m[1] : 'anonymous';
}

async function fetchFileSource(owner, repo, filePath, ref, githubToken) {
  try {
    const safePath = filePath.split('/').map(seg => encodeURIComponent(seg)).join('/');
    const res = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/${safePath}?ref=${encodeURIComponent(ref || '')}`,
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
        timeout: 10000,
      }
    );
    return Buffer.from(res.data.content, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

async function enrichWithFunctionContext(prMeta, diffFiles, githubToken) {
  const chunks = [];
  const { owner, repo, head } = prMeta;

  for (const file of diffFiles) {
    if (!/\.(js|ts|jsx|tsx)$/.test(file.filename)) continue;
    if (!file.lines || file.lines.length === 0) continue;

    const source = await fetchFileSource(owner, repo, file.filename, head, githubToken);
    if (!source) continue;

    const sourceLines = source.split('\n');
    const seen = new Set();

    for (const line of file.lines) {
      const { startLine, endLine } = findFunctionBoundary(sourceLines, line.lineNo);
      const key = `${file.filename}:${startLine}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const changedInFn = file.lines
        .filter(l => l.lineNo >= startLine + 1 && l.lineNo <= endLine + 1)
        .map(l => ({ lineNo: l.lineNo, content: l.content }));
      if (changedInFn.length === 0) continue;

      chunks.push({
        filename: file.filename,
        functionName: extractFunctionName(sourceLines[startLine]),
        fullCode: sourceLines.slice(startLine, endLine + 1).join('\n'),
        changedLines: changedInFn,
        startLine: startLine + 1,
        endLine: endLine + 1,
      });
    }
  }

  return chunks;
}

module.exports = { enrichWithFunctionContext };
