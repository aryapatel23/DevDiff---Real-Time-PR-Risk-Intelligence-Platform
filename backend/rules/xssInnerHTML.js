module.exports = {
  name: 'xss-innerhtml',
  severity: 'critical',
  check(content, filename) {
    if (!/\.(js|ts|jsx|tsx|html)$/.test(filename)) return null;
    const innerHTMLPattern    = /\.innerHTML\s*=\s*(?!['"`]<[^>]+>[^<]*<\/[^>]+>['"`])/.test(content);
    const dangerousHTML       = /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:\s*\w+/.test(content);
    const documentWrite       = /document\.write\s*\(/.test(content);

    if (innerHTMLPattern || dangerousHTML || documentWrite) {
      return {
        message:  'Potential XSS — unsanitised value assigned to innerHTML or dangerouslySetInnerHTML',
        fix_hint: 'Use textContent instead of innerHTML, or sanitise with DOMPurify before assignment',
      };
    }
    return null;
  },
};
