/**
 * Lightweight AST feature extractor.
 *
 * Uses regex-based heuristics that approximate what Tree-sitter would
 * provide, ensuring the system works even if native Tree-sitter bindings
 * have version issues at build time.
 *
 * Exported function: extractFeatures(lineContent, filename)
 * Returns an object with boolean/numeric properties used by the ML scorer
 * and rule engine weight system.
 */

const CRITICAL_FILE_PATTERN = /\/(auth|authentication|payment|billing|security|secret|token|password|credential|session|admin|login|register|signup|oauth|jwt|crypto|encrypt|decrypt|database|db|sql|query)/i;

const USER_INPUT_PATTERN = /req\.(body|params|query|headers)\b|\brequest\.(body|params|query)\b|\bparams\[|\bquery\[|\binput\b|\bformData\b/;

const ASYNC_PATTERN = /\basync\b|\bawait\b|\.then\s*\(|new\s+Promise\s*\(/;

const LOOP_PATTERN = /\bfor\s*\(|\bwhile\s*\(|\b\.forEach\b|\b\.map\b|\b\.filter\b|\b\.reduce\b/;

const TEMPLATE_VAR_PATTERN = /`[^`]*\$\{[^}]+\}[^`]*`/;

function extractFeatures(lineContent, filename) {
  const content = lineContent || '';
  const fname   = filename   || '';

  // Count chained method calls as complexity proxy
  const dotCount  = (content.match(/\./g)  || []).length;
  const parenCount = (content.match(/\(/g) || []).length;
  const lineComplexity = Math.min(dotCount + parenCount, 20);

  // Rough AST depth: indentation spaces / 2
  const leadingSpaces = content.length - content.trimStart().length;
  const astDepth = Math.min(Math.floor(leadingSpaces / 2) + 1, 10);

  return {
    astDepth,
    isInLoop:         LOOP_PATTERN.test(content),
    isAsyncContext:   ASYNC_PATTERN.test(content),
    variableFromUser: USER_INPUT_PATTERN.test(content),
    hasTemplateVar:   TEMPLATE_VAR_PATTERN.test(content),
    lineComplexity,
    isCriticalFile:   CRITICAL_FILE_PATTERN.test(fname),
  };
}

module.exports = { extractFeatures };
