module.exports = {
  name: 'cors-wildcard',
  severity: 'warning',
  check(content, filename) {
    if (!/\.(js|ts)$/.test(filename)) return null;

    const hasWildcard =
      /cors\s*\(\s*\{\s*origin\s*:\s*['"`]\*['"`]/.test(content) ||
      /['"`]Access-Control-Allow-Origin['"`]\s*[:,]\s*['"`]\*['"`]/.test(content);

    if (hasWildcard) {
      return {
        message: 'CORS wildcard origin (*) allows requests from any domain',
        fix_hint: 'Restrict: cors({ origin: ["https://yourdomain.com"] })',
      };
    }
    return null;
  },
};
