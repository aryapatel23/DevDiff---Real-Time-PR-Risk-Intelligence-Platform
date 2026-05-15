module.exports = {
  name: 'memory-leak',
  severity: 'warning',
  check(content, filename) {
    if (!/\.(js|ts|jsx|tsx)$/.test(filename)) return null;
    const hasAddListener     = /addEventListener\s*\(/.test(content);
    const hasRemoveListener  = /removeEventListener\s*\(/.test(content);
    const hasSetInterval     = /setInterval\s*\(/.test(content);
    const hasClearInterval   = /clearInterval\s*\(/.test(content);
    const inComponentContext = /\/(components|pages|hooks|views)\//i.test(filename);

    if (inComponentContext && hasAddListener && !hasRemoveListener) {
      return {
        message:  'addEventListener without removeEventListener in component — memory leak risk',
        fix_hint: 'Return a cleanup function from useEffect: return () => element.removeEventListener(...)',
      };
    }
    if (inComponentContext && hasSetInterval && !hasClearInterval) {
      return {
        message:  'setInterval without clearInterval in component — memory leak risk',
        fix_hint: 'Return cleanup from useEffect: return () => clearInterval(id)',
      };
    }
    return null;
  },
};
