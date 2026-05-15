module.exports = {
  name: 'weak-hash',
  severity: 'warning',
  check(content, filename) {
    if (!/\.(js|ts|jsx|tsx|py)$/.test(filename)) return null;
    const inSecurityContext = /\/(auth|password|login|user|account|credential|hash|crypto)/i.test(filename);
    const usesMd5  = /\bmd5\s*\(|\bcreateHash\s*\(\s*['"]md5['"]\)/.test(content);
    const usesSha1 = /\bsha1\s*\(|\bcreateHash\s*\(\s*['"]sha1['"]\)/.test(content);

    if (inSecurityContext && (usesMd5 || usesSha1)) {
      return {
        message:  'Weak hashing algorithm (MD5/SHA1) used in security context',
        fix_hint: 'Use bcrypt, argon2, or at minimum SHA-256 for password hashing',
      };
    }
    return null;
  },
};
