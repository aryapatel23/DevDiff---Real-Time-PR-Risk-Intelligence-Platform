module.exports = {
  name: 'sql-injection',
  severity: 'critical',
  check(content, filename) {
    if (!/\.(js|ts|jsx|tsx|py|rb|php)$/.test(filename)) return null;
    const hasSqlKeyword     = /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN|DROP|CREATE)\b/i.test(content);
    const hasTemplateVar    = /`[^`]*\$\{[^}]+\}[^`]*`/.test(content);
    const hasStringConcat   = /["']\s*\+\s*\w+|\w+\s*\+\s*["']/.test(content) && hasSqlKeyword;
    const hasFStringPy      = /f["'][^'"]*\{[^}]+\}[^'"]*["']/.test(content) && hasSqlKeyword;

    if (hasSqlKeyword && (hasTemplateVar || hasStringConcat || hasFStringPy)) {
      return {
        message:  'SQL injection — user input concatenated or interpolated into SQL string',
        fix_hint: 'Use parameterised queries: db.query("SELECT ... WHERE id = ?", [id])',
      };
    }
    return null;
  },
};
