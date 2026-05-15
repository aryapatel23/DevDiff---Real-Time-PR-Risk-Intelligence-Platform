/**
 * Parse a unified diff patch string into structured line objects.
 *
 * Only returns ADDED lines (lines starting with '+', not '+++').
 * Correctly tracks line numbers across multiple @@ hunks.
 *
 * @param {string} patch - raw unified diff patch from GitHub API
 * @returns {Array<{lineNo: number, content: string, isAdded: boolean}>}
 */
function parseDiff(patch) {
  if (!patch || typeof patch !== 'string' || !patch.trim()) return [];

  const lines  = patch.split('\n');
  const result = [];
  let newLineNo = 0;

  for (const line of lines) {
    // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) newLineNo = parseInt(match[1]) - 1;
      continue;
    }

    // Skip file headers
    if (line.startsWith('+++') || line.startsWith('---')) continue;

    if (line.startsWith('+')) {
      newLineNo++;
      result.push({
        lineNo:  newLineNo,
        content: line.slice(1),   // remove leading '+'
        isAdded: true
      });
    } else if (line.startsWith('-')) {
      // Deleted lines do not increment new file line number
      continue;
    } else {
      // Context line
      newLineNo++;
    }
  }

  return result;
}

module.exports = { parseDiff };
