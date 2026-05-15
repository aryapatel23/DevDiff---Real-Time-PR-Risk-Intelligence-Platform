module.exports = {
  name: 'syntax-error',
  severity: 'critical',
  bypass_ml: true,
  check(content, filename) {
    if (!/\.(js|ts|jsx|tsx|mjs|cjs)$/.test(filename)) return null;

    const line = (content || '').trim();
    if (!line) return null;

    const brokenDeclaration = /^(const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*;?$/.test(line);
    if (brokenDeclaration) {
      return {
        message: 'Syntax issue — variable declaration has assignment operator but no value',
        fix_hint: 'Provide a value after = (e.g., const id = 1) or remove the assignment operator',
      };
    }

    const danglingPropertyAccess = /\.[\s;]*$/.test(line);
    if (danglingPropertyAccess) {
      return {
        message: 'Syntax issue — dangling property access at end of line',
        fix_hint: 'Complete the expression after the dot (e.g., obj.value)',
      };
    }

    const trailingOperator = /(\+|\-|\*|\/|%|&&|\|\||==|===|!=|!==|\?|:)\s*$/.test(line)
      && !/^[{}()[\],;]+$/.test(line);
    if (trailingOperator) {
      return {
        message: 'Syntax issue — expression ends with an operator',
        fix_hint: 'Complete the expression or remove the trailing operator',
      };
    }

    return null;
  },
};
