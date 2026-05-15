module.exports = {
  name: 'eval-usage',
  severity: 'critical',
  check(content, filename) {
    if (!/\.(js|ts|jsx|tsx)$/.test(filename)) return null;
    const evalPattern = /(?<![a-zA-Z])eval\s*\(/.test(content);
    const funcCtor    = /new\s+Function\s*\(/.test(content);
    const setInterval = /setInterval\s*\(\s*['"`]/.test(content);

    if (evalPattern || funcCtor || setInterval) {
      return {
        message:  'eval() or equivalent — executes arbitrary code, enables code injection',
        fix_hint: 'Replace eval() with explicit logic. Use JSON.parse() for JSON. Avoid new Function().',
      };
    }
    return null;
  },
};
