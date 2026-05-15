module.exports = {
  name: 'jwt-no-expiry',
  severity: 'critical',
  check(content, filename) {
    if (!/\.(js|ts)$/.test(filename)) return null;

    const hasSign = /\bjwt\.sign\s*\(/.test(content);
    const hasExpiry = /\bexpiresIn\b/.test(content);

    if (hasSign && !hasExpiry) {
      return {
        message: 'JWT signed without expiresIn — token never expires, permanent access if leaked',
        fix_hint: 'Add: jwt.sign(payload, secret, { expiresIn: "24h" })',
      };
    }
    return null;
  },
};
