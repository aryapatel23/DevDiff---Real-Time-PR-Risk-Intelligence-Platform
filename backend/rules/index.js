const nullDeref = require('./nullDeref');
const sqlInjection = require('./sqlInjection');
const unhandledProm = require('./unhandledPromise');
const secretLeak = require('./secretLeak');
const xss = require('./xssInnerHTML');
const evalUsage = require('./evalUsage');
const pathTraversal = require('./pathTraversal');
const weakHash = require('./weakHash');
const insecureRandom = require('./insecureRandom');
const hardcodedIp = require('./hardcodedIp');
const missingValid = require('./missingValidation');
const protoPollu = require('./prototypePollu');
const reDoS = require('./reDoS');
const consoleLog = require('./consoleLog');
const memoryLeak = require('./memoryLeak');
const asyncAwaitLeak = require('./asyncAwaitLeak');
const sensitiveDataLog = require('./sensitiveDataLog');
const missingRateLimit = require('./missingRateLimit');
const corsWildcard = require('./corsWildcard');
const jwtNoExpiry = require('./jwtNoExpiry');

const ALL_RULES = [
  nullDeref, sqlInjection, unhandledProm, secretLeak,
  xss, evalUsage, pathTraversal, weakHash, insecureRandom,
  hardcodedIp, missingValid, protoPollu, reDoS, consoleLog, memoryLeak,
  asyncAwaitLeak, sensitiveDataLog, missingRateLimit, corsWildcard, jwtNoExpiry,
];

const DETERMINISTIC_RULES = new Set([
  'secret-leak', 'eval-usage', 'sql-injection', 'prototype-pollution',
  'jwt-no-expiry', 'sensitive-data-log',
]);

const CRITICAL_FILE_RE = /\b(auth|login|password|payment|billing|token|secret|session|admin|db|database)\b/i;
const TEST_FILE_RE = /\.(test|spec)\.|__tests__|\/test\/|\/spec\//i;
const USER_INPUT_RE = /\breq\.(body|params|query|headers)\b|\brequest\.(body|params|query)\b/;
const NULL_GUARD_RE = /\b(if\s*\(|&&|\?\?|typeof\s+\w+\s*!==?\s*['"]undefined|!==\s*null|===\s*null|try\s*\{|\.hasOwnProperty)\b/;
const ASYNC_RE = /\b(async|await|Promise|\.then\(|\.catch\()\b/;
const CONDITIONAL_RE = /^\s*(if|else|switch|case|\?)/;
const EVAL_RE = /\b(eval\(|new Function\(|execSync\()\b/;
const WEAK_CRYPTO_RE = /\b(md5\(|sha1\(|Math\.random\(\))\b/;
const CONCAT_RE = /["'][^"']*["'\s]*\+|\+\s*["']/;

for (const rule of ALL_RULES) {
  if (!rule.name || !rule.severity || typeof rule.check !== 'function') {
    console.error('[DevDiff] Invalid rule:', rule);
    process.exit(1);
  }
}

function buildFeatureVector(line, filename, ruleWeight, authorPatternCount, surroundingLines) {
  const ctx = surroundingLines.join(' ');
  const c = line.content;

  const isCriticalFile = CRITICAL_FILE_RE.test(filename) ? 1 : 0;
  const isTestFile = TEST_FILE_RE.test(filename) ? 1 : 0;
  const hasUserInput = USER_INPUT_RE.test(c) ? 1 : 0;
  const hasTemplateLit = c.includes('${') ? 1 : 0;
  const hasNullGuard = NULL_GUARD_RE.test(ctx) ? 1 : 0;

  const len = c.trim().length;
  const lineLenBucket = len < 40 ? 0 : len < 100 ? 1 : 2;

  return [
    isCriticalFile,
    isTestFile,
    hasUserInput,
    hasTemplateLit,
    hasNullGuard,
    lineLenBucket,
    Math.min((c.match(/\./g) || []).length, 10),
    Math.min((c.match(/\(/g) || []).length, 8),
    ASYNC_RE.test(c) ? 1 : 0,
    CONDITIONAL_RE.test(c) ? 1 : 0,
    CONCAT_RE.test(c) ? 1 : 0,
    parseFloat(ruleWeight),
    Math.min(authorPatternCount || 0, 20),
    EVAL_RE.test(c) ? 1 : 0,
    (WEAK_CRYPTO_RE.test(c) && isCriticalFile) ? 1 : 0,
  ];
}

function runRules(line, filename, patterns = [], surroundingLines = []) {
  const patternMap = {};
  for (const p of patterns) patternMap[p.rule_name] = p.count;

  const isCriticalFile = CRITICAL_FILE_RE.test(filename);
  const isTestFile = TEST_FILE_RE.test(filename);
  const hasNullGuard = NULL_GUARD_RE.test(surroundingLines.join(' '));
  const hasUserInput = USER_INPUT_RE.test(line.content);

  const findings = [];
  for (const rule of ALL_RULES) {
    let result = null;
    try {
      result = rule.check(line.content, filename);
    } catch {
      continue;
    }
    if (!result) continue;

    const historicalCount = patternMap[rule.name] || 0;
    let severity = rule.severity;

    if (severity === 'warning' && isCriticalFile && hasUserInput) severity = 'critical';
    if (severity === 'critical' && hasNullGuard && !hasUserInput) severity = 'warning';
    if (isTestFile) severity = 'info';

    const baseWeight = rule.severity === 'critical' ? 1.2 : rule.severity === 'warning' ? 0.8 : 0.3;
    const repeatMod = historicalCount >= 3 ? 1.5 : 1.0;
    const userInputMod = hasUserInput ? 1.3 : 1.0;
    const nullGuardMod = hasNullGuard ? 0.6 : 1.0;
    const critFileMod = isCriticalFile ? 1.2 : 1.0;
    const weight = Math.min(baseWeight * repeatMod * userInputMod * nullGuardMod * critFileMod, 1.5);

    const features = buildFeatureVector(line, filename, weight, historicalCount, surroundingLines);

    const contextSignals = [];
    if (hasUserInput) contextSignals.push('user-input-present');
    if (hasNullGuard) contextSignals.push('null-guard-nearby');
    if (isCriticalFile) contextSignals.push('critical-file');
    if (isTestFile) contextSignals.push('test-file');
    if (historicalCount >= 3) contextSignals.push(`repeat-offender(${historicalCount}x)`);

    findings.push({
      rule_name: rule.name,
      severity,
      message: result.message,
      fix_hint: result.fix_hint,
      weight,
      features,
      contextSignals,
      isDeterministic: DETERMINISTIC_RULES.has(rule.name),
    });
  }

  return findings;
}

module.exports = { runRules, ALL_RULES, DETERMINISTIC_RULES };
