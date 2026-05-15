const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log('  PASS:', msg); passed++; }
  else { console.error('  FAIL:', msg); failed++; }
}

function run(command, args, cwd) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function runCli(cwd, ...args) {
  const cliPath = path.join(__dirname, '../cli/bin/devdiff.js');
  return run('node', [cliPath, ...args], cwd);
}

console.log('\n── CLI Tests ──');

const tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'devdiff-cli-test-'));
run('git', ['init'], tempRepo);

const vulnerableFile = path.join(tempRepo, 'api.js');
fs.writeFileSync(vulnerableFile, 'const userId = req.query.id;\nconst q = `SELECT * FROM users WHERE id=${userId}`;\n');
run('git', ['add', 'api.js'], tempRepo);

const criticalRun = runCli(tempRepo, 'check', '--json');
let findings = [];
try { findings = JSON.parse((criticalRun.stdout || '[]').trim() || '[]'); }
catch { findings = []; }

assert(criticalRun.status === 1, 'critical findings block with exit code 1');
assert(Array.isArray(findings) && findings.some(f => f.ruleName === 'sql-injection'), 'sql-injection is detected in staged changes');

run('git', ['reset'], tempRepo);
const cleanRun = runCli(tempRepo, 'check', '--json');
const cleanOut = (cleanRun.stdout || '').trim();
assert(cleanRun.status === 0, 'clean staged diff exits with code 0');
assert(cleanOut === '[]', 'clean staged diff emits empty JSON array');

const helpRun = runCli(tempRepo, 'help');
assert(helpRun.status === 0, 'help command exits with code 0');
assert(/Usage:/i.test(helpRun.stdout || ''), 'help command prints usage');

const unknownRun = runCli(tempRepo, 'unknown-command');
assert(unknownRun.status === 1, 'unknown command exits with code 1');
assert(/Unknown command/i.test(unknownRun.stderr || ''), 'unknown command prints clear error');

console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
