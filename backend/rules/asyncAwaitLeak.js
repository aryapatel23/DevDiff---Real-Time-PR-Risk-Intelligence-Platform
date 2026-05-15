module.exports = {
  name: 'async-await-leak',
  severity: 'warning',
  check(content, filename) {
    if (!/\.(js|ts|jsx|tsx)$/.test(filename)) return null;

    const hasAwait = /\bawait\s+\w+/.test(content);
    const hasAsync = /\basync\s+(function|\(|[a-zA-Z])/.test(content);
    const hasTry = /\btry\s*\{/.test(content);
    const hasCatch = /\.catch\s*\(/.test(content);

    if ((hasAwait || hasAsync) && !hasTry && !hasCatch) {
      return {
        message: 'await used without error handling — unhandled promise rejection crashes the process',
        fix_hint: 'Wrap in try/catch or use .catch(). Express apps: use asyncHandler wrapper.',
      };
    }
    return null;
  },
};
