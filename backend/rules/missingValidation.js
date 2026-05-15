module.exports = {
  name: 'missing-validation',
  severity: 'warning',
  check(content, filename) {
    if (!/\.(js|ts|jsx|tsx)$/.test(filename)) return null;
    const directBodyAccess = /req\.body\.\w+/.test(content);
    const hasValidation    = /typeof\s+|hasOwnProperty|\.trim\s*\(\)|\.length\b|joi\.|yup\.|zod\.|validator\.|isNaN\(|parseInt\(|parseFloat\(/.test(content);

    if (directBodyAccess && !hasValidation) {
      return {
        message:  'Direct req.body field access without validation — type or existence not checked',
        fix_hint: 'Validate inputs with joi, zod, or at minimum check typeof before use',
      };
    }
    return null;
  },
};
