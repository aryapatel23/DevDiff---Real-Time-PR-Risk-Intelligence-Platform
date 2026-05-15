module.exports = {
  name: 'path-traversal',
  severity: 'critical',
  check(content, filename) {
    if (!/\.(js|ts|jsx|tsx|py)$/.test(filename)) return null;
    const fsReadWithUserInput = /(?:fs\.|readFile|readFileSync|createReadStream)\s*\([^)]*req\.(params|body|query)/.test(content);
    const traversalLiteral    = /['"`][^'"`]*\.\.\//.test(content) && /req\.(params|body|query)/.test(content);
    const pathJoinWithUser    = /path\.join\s*\([^)]*req\.(params|body|query)/.test(content);

    if (fsReadWithUserInput || traversalLiteral || pathJoinWithUser) {
      return {
        message:  'Path traversal risk — user input used in file path without sanitisation',
        fix_hint: 'Validate and sanitise file paths. Use path.basename() and whitelist allowed dirs.',
      };
    }
    return null;
  },
};
