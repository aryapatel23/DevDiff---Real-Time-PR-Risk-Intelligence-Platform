module.exports = {
  name: 'console-log',
  severity: 'info',
  check(content, filename) {
    if (/\.(test|spec)\.(js|ts)$|debug|logger|log\.js/.test(filename)) return null;
    if (/\/(node_modules|dist|build)\//.test(filename)) return null;

    const hasConsoleLog = /\bconsole\.(log|debug|info|warn|error)\s*\(/.test(content);
    if (hasConsoleLog) {
      return {
        message:  'console.log() left in production code — may expose sensitive data in logs',
        fix_hint: 'Remove or replace with a structured logger like winston or pino',
      };
    }
    return null;
  },
};
