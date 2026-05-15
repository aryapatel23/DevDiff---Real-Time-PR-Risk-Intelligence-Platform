module.exports = {
  name: 'insecure-random',
  severity: 'warning',
  check(content, filename) {
    if (!/\.(js|ts|jsx|tsx)$/.test(filename)) return null;
    const inSecurityContext = /\/(auth|token|session|secret|key|otp|nonce|csrf)/i.test(filename);
    const usesMathRandom    = /Math\.random\s*\(\s*\)/.test(content);

    if (inSecurityContext && usesMathRandom) {
      return {
        message:  'Math.random() used in security context — not cryptographically secure',
        fix_hint: 'Use crypto.randomBytes() or crypto.getRandomValues() for security tokens',
      };
    }
    return null;
  },
};
