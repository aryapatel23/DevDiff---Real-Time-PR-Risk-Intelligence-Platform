module.exports = {
  name: 'redos',
  severity: 'warning',
  check(content, filename) {
    if (!/\.(js|ts|jsx|tsx)$/.test(filename)) return null;
    const nestedQuant  = /\/[^/]*(\([^)]*[+*]\)[+*]|\[[^\]]*\][+*][+*])[^/]*\//.test(content);
    const regexWithVar = /new\s+RegExp\s*\(\s*(?:req\.|userInput|input|query)/.test(content);

    if (nestedQuant) {
      return {
        message:  'Potentially vulnerable regex — nested quantifiers can cause catastrophic backtracking (ReDoS)',
        fix_hint: 'Refactor regex to avoid nested quantifiers, or use a timeout-safe regex library',
      };
    }
    if (regexWithVar) {
      return {
        message:  'Dynamic RegExp constructed from user input — possible ReDoS or injection',
        fix_hint: 'Sanitise user input before using in RegExp, or use a fixed pattern',
      };
    }
    return null;
  },
};
