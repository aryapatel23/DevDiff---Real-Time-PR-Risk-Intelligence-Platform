module.exports = {
  name: 'sensitive-data-log',
  severity: 'critical',
  check(content, filename) {
    if (!/\.(js|ts|jsx|tsx|py)$/.test(filename)) return null;

    const isLog = /\b(console\.(log|error|warn|info)|logger\.(log|error|warn|debug))\b/.test(content);
    const hasSensitive = /\b(password|passwd|token|secret|apiKey|api_key|credit_card|cvv|authorization)\b/i.test(content);

    if (isLog && hasSensitive) {
      return {
        message: 'Sensitive field logged — credentials visible in log output',
        fix_hint: 'Sanitize: log({ ...req.body, password: "[REDACTED]" })',
      };
    }
    return null;
  },
};
