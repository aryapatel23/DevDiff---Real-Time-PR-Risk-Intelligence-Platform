module.exports = {
  name: 'null-deref',
  severity: 'critical',
  check(content, filename) {
    if (!/\.(js|ts|jsx|tsx)$/.test(filename)) return null;
    const userSourcePattern = /\b(req\.(params|body|query)|res\.locals|event\.data)\b/;
    const chainedAccess     = /\.([\w]+){2,}|\[['"][^'"]+['"]\]\.[a-zA-Z]/;
    const hasNullGuard      = /\?\.|&&\s*\w+\.|typeof\s+\w+\s*!==?\s*['"]undefined['"]/;

    if (userSourcePattern.test(content) && chainedAccess.test(content) && !hasNullGuard.test(content)) {
      return {
        message:  'Possible null dereference — chained access on user-supplied value without null guard',
        fix_hint: 'Use optional chaining: req.params?.id or add null check before access',
      };
    }
    return null;
  },
};
