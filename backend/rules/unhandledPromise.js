module.exports = {
  name: 'unhandled-promise',
  severity: 'warning',
  check(content, filename) {
    if (!/\.(js|ts|jsx|tsx)$/.test(filename)) return null;
    const hasAwait      = /\bawait\b/.test(content);
    const hasTryCatch   = /\btry\b|\bcatch\b/.test(content);
    const hasThenNoCatch = /\.then\s*\([^)]*\)(?!\s*\.catch)/.test(content);

    if (hasThenNoCatch) {
      return {
        message:  'Unhandled promise rejection — .then() without .catch()',
        fix_hint: 'Add .catch(err => ...) or use try/catch with async/await',
      };
    }
    if (hasAwait && !hasTryCatch) {
      const isAssignment = /^\s*(const|let|var)\s+\w+\s*=\s*await/.test(content);
      if (isAssignment) {
        return {
          message:  'Awaited call not wrapped in try/catch — errors will propagate as unhandled rejection',
          fix_hint: 'Wrap in try { const x = await ... } catch(err) { ... }',
        };
      }
    }
    return null;
  },
};
