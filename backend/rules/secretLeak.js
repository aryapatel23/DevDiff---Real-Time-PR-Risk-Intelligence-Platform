module.exports = {
  name: 'secret-leak',
  severity: 'critical',
  check(content, filename) {
    if (/\.(test|spec)\.(js|ts)$|example|\.env\.example/.test(filename)) return null;

    const secretPattern = /(password|passwd|secret|api_key|apikey|access_token|auth_token|private_key|client_secret)\s*[:=]\s*['"`][^'"`\s]{6,}['"`]/i;
    const awsKeyPattern = /AKIA[0-9A-Z]{16}/;
    const genericToken  = /(token|key)\s*=\s*['"`][A-Za-z0-9+/=_-]{20,}['"`]/i;

    if (secretPattern.test(content) || awsKeyPattern.test(content) || genericToken.test(content)) {
      return {
        message:  'Hardcoded secret or credential detected in source code',
        fix_hint: 'Move secrets to environment variables and use process.env.SECRET_NAME',
      };
    }
    return null;
  },
};
