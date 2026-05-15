#!/usr/bin/env node
'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../../backend/.env') });

const { execSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

// Always import from backend — never duplicate logic
const BACKEND = path.join(__dirname, '../../backend');
const { parseDiff } = require(path.join(BACKEND, 'parser/diffParser'));
const { runRules }  = require(path.join(BACKEND, 'rules/index'));

const args    = process.argv.slice(2);
const command = args[0] || 'check';
const jsonOut = args.includes('--json');
const includeTests = args.includes('--include-tests');
const includeSeed  = args.includes('--include-seed');

function usage() {
  console.log([
    'DevDiff CLI',
    '',
    'Usage:',
    '  devdiff init',
    '  devdiff check [--json]',
    '  devdiff check [--json] [--include-tests] [--include-seed]',
    '  devdiff help',
  ].join('\n'));
}

if (command === 'help' || command === '-h' || command === '--help') {
  usage();
  process.exit(0);
}

// ─── INIT ────────────────────────────────────────────────────────────
if (command === 'init') {
  const gitDir  = findGitDir(process.cwd());
  if (!gitDir) {
    console.error('[DevDiff] Not inside a git repository.');
    process.exit(1);
  }
  const hookPath    = path.join(gitDir, 'hooks', 'pre-commit');
  const markerStart = '# >>> devdiff pre-commit >>>';
  const markerEnd   = '# <<< devdiff pre-commit <<<';
  const snippet     = `${markerStart}\ndevdiff check\n${markerEnd}\n`;

  fs.mkdirSync(path.dirname(hookPath), { recursive: true });

  let existing = '';
  if (fs.existsSync(hookPath)) {
    existing = fs.readFileSync(hookPath, 'utf8');
  }

  if (existing.includes(markerStart) || existing.includes('devdiff check')) {
    console.log(`[DevDiff] Pre-commit hook already contains DevDiff at ${hookPath}`);
    process.exit(0);
  }

  let hookContent = existing;
  if (!hookContent.trim()) {
    hookContent = '#!/bin/sh\n';
  } else if (!hookContent.startsWith('#!')) {
    hookContent = `#!/bin/sh\n${hookContent}`;
  }

  if (!hookContent.endsWith('\n')) hookContent += '\n';
  hookContent += snippet;

  fs.writeFileSync(hookPath, hookContent, { mode: 0o755 });
  console.log(`[DevDiff] Pre-commit hook configured at ${hookPath}`);
  process.exit(0);
}

// ─── CHECK ───────────────────────────────────────────────────────────
if (command === 'check') {
  let diff = '';
  try {
    diff = execSync('git diff --cached', { encoding: 'utf8' });
  } catch {
    console.error('[DevDiff] Failed to read git diff. Are you in a git repo?');
    process.exit(1);
  }

  if (!diff.trim()) {
    if (!jsonOut) console.log('[DevDiff] No staged changes to scan.');
    else console.log('[]');
    process.exit(0);
  }

  // Split raw diff into per-file blocks
  const blocks     = diff.split(/^diff --git /m).filter(Boolean);
  const allFindings = [];

  for (const block of blocks) {
    const fnMatch = block.match(/a\/(.+?) b\//);
    if (!fnMatch) continue;
    const filename = fnMatch[1];
    if (!shouldScanFile(filename, { includeTests, includeSeed })) continue;

    const patchStart = block.indexOf('@@');
    if (patchStart === -1) continue;

    const lines = parseDiff(block.slice(patchStart));
    for (const line of lines) {
      const hits = runRules(line, filename, []);
      for (const hit of hits) {
        allFindings.push({
          filename,
          lineNo:   line.lineNo,
          ruleName: hit.rule_name,
          severity: hit.severity,
          message:  hit.message,
          fixHint:  hit.fix_hint || '',
        });
      }
    }
  }

  if (jsonOut) {
    console.log(JSON.stringify(allFindings, null, 2));
    process.exit(allFindings.some(f => f.severity === 'critical') ? 1 : 0);
  }

  if (!allFindings.length) {
    console.log('\n  [DevDiff] All clear — no issues found in staged changes.\n');
    process.exit(0);
  }

  console.log('\n  DevDiff pre-commit guard\n  ' + '─'.repeat(50));
  for (const f of allFindings) {
    const label = f.severity === 'critical' ? '[CRITICAL]' :
                  f.severity === 'warning'  ? '[WARN]    ' : '[INFO]    ';
    console.log(`\n  ${label}  ${f.filename}:${f.lineNo}`);
    console.log(`             ${f.message}`);
    if (f.fixHint) console.log(`             Fix: ${f.fixHint}`);
  }

  const critCount = allFindings.filter(f => f.severity === 'critical').length;
  const warnCount = allFindings.filter(f => f.severity === 'warning').length;
  console.log('\n  ' + '─'.repeat(50));

  if (critCount > 0) {
    console.log(`\n  ${critCount} critical bug(s) found. Commit BLOCKED.\n`);
    console.log(`  Fix the issues above, then commit again.`);
    console.log(`  Override (not recommended): git commit --no-verify\n`);
    process.exit(1);
  } else {
    console.log(`\n  ${warnCount} warning(s). Review recommended. Commit allowed.\n`);
    process.exit(0);
  }
}

function findGitDir(dir) {
  const candidate = path.join(dir, '.git');
  if (fs.existsSync(candidate)) return candidate;
  const parent = path.dirname(dir);
  if (parent === dir) return null;
  return findGitDir(parent);
}

function shouldScanFile(filename, opts) {
  const normalized = String(filename || '').replace(/\\/g, '/').toLowerCase();

  if (/(^|\/)node_modules\//.test(normalized)) return false;
  if (/(^|\/)(dist|build|coverage|\.next)\//.test(normalized)) return false;

  if (!opts.includeSeed && /(^|\/)backend\/db\/seed\.js$/.test(normalized)) return false;

  if (!opts.includeTests) {
    if (/(^|\/)tests\//.test(normalized)) return false;
    if (/(^|\/)__tests__\//.test(normalized)) return false;
    if (/\.(test|spec)\.(js|ts|jsx|tsx|py)$/.test(normalized)) return false;
  }

  return true;
}

console.error(`[DevDiff] Unknown command: ${command}`);
usage();
process.exit(1);
