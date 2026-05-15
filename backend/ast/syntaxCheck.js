const axios = require('axios');
const parser = require('@babel/parser');

const JS_TS_EXT = /\.(js|jsx|mjs|cjs|ts|tsx)$/i;

function parserPluginsForFile(filename) {
  const lower = (filename || '').toLowerCase();
  const basePlugins = [
    'classProperties',
    'classPrivateProperties',
    'classPrivateMethods',
    'optionalChaining',
    'nullishCoalescingOperator',
    'dynamicImport',
    'objectRestSpread',
    'topLevelAwait',
  ];

  if (lower.endsWith('.ts')) return [...basePlugins, 'typescript'];
  if (lower.endsWith('.tsx')) return [...basePlugins, 'typescript', 'jsx'];
  if (lower.endsWith('.jsx')) return [...basePlugins, 'jsx'];
  return basePlugins;
}

async function fetchRawFile(rawUrl, headers) {
  if (!rawUrl) return null;
  try {
    const res = await axios.get(rawUrl, { headers, timeout: 10000 });
    return typeof res.data === 'string' ? res.data : null;
  } catch {
    return null;
  }
}

function parseForSyntax(source, filename) {
  if (!source || !JS_TS_EXT.test(filename || '')) return null;

  try {
    parser.parse(source, {
      sourceType: 'unambiguous',
      allowReturnOutsideFunction: true,
      errorRecovery: false,
      plugins: parserPluginsForFile(filename),
    });
    return null;
  } catch (err) {
    const line = Number(err.loc?.line || 1);
    const column = Number(err.loc?.column || 0) + 1;
    const short = (err.message || 'Syntax error').split('(')[0].trim();
    return {
      line,
      column,
      message: `${short} at ${filename}:${line}:${column}`,
      fix_hint: 'Fix the syntax in this changed file and re-run analysis',
    };
  }
}

async function checkChangedFileSyntax(file, headers) {
  if (!file || !JS_TS_EXT.test(file.filename || '')) return null;
  const source = await fetchRawFile(file.raw_url, headers);
  if (!source) return null;
  return parseForSyntax(source, file.filename);
}

module.exports = { checkChangedFileSyntax, parseForSyntaxForTest: parseForSyntax };
