module.exports = {
  name: 'missing-rate-limit',
  severity: 'warning',
  check(content, filename) {
    if (!/\.(js|ts)$/.test(filename)) return null;

    const isAuthRoute = /router\.(post|get|put)\s*\(\s*['"`](\/?(login|register|auth|signin|signup|forgot-password|reset-password))/.test(content);
    const hasLimit = /\b(rateLimit|rateLimiter|limiter|throttle|slowDown)\b/.test(content);

    if (isAuthRoute && !hasLimit) {
      return {
        message: 'Auth endpoint has no rate limiting — brute-force attack possible',
        fix_hint: 'Add express-rate-limit: app.use("/login", rateLimit({ windowMs: 900000, max: 10 }))',
      };
    }
    return null;
  },
};
