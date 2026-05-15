module.exports = {
  name: 'hardcoded-ip',
  severity: 'warning',
  check(content, filename) {
    if (/\.(test|spec)\.(js|ts)$|example|template|fixture/.test(filename)) return null;
    const ipPattern = /\b(\d{1,3}\.){3}\d{1,3}\b/;
    const isLocalhost = /\b(127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.)\b/;

    if (ipPattern.test(content) && !isLocalhost.test(content)) {
      return {
        message:  'Hardcoded IP address in source code — use environment variable instead',
        fix_hint: 'Replace with process.env.SERVICE_HOST or a configuration file',
      };
    }
    return null;
  },
};
