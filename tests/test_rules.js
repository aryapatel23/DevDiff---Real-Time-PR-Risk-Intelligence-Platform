const { runRules } = require('../backend/rules/index');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log('  PASS:', msg); passed++; }
  else       { console.error('  FAIL:', msg); failed++; }
}

function line(content) { return { lineNo: 1, content, isAdded: true }; }

console.log('\n── Rule Engine Tests ──');

// SQL injection
const sq = runRules(line('const q = `SELECT * FROM users WHERE id=${userId}`'), 'api/user.js', []);
assert(sq.some(h => h.rule_name === 'sql-injection'),  'SQL injection detected');
assert(sq.find(h=>h.rule_name==='sql-injection')?.severity === 'critical', 'SQL injection is critical');

// Secret leak
const sl = runRules(line("const api_key = 'sk-prod-abc123xyz456'"), 'config/keys.js', []);
assert(sl.some(h => h.rule_name === 'secret-leak'), 'Secret leak detected');

// Eval usage
const ev = runRules(line('eval(userInput)'), 'scripts/run.js', []);
assert(ev.some(h => h.rule_name === 'eval-usage'), 'Eval usage detected');

// XSS
const xs = runRules(line('div.innerHTML = userData'), 'components/Render.js', []);
assert(xs.some(h => h.rule_name === 'xss-innerhtml'), 'XSS innerHTML detected');

// Safe line — zero findings
const sf = runRules(line('const x = getUserName()'), 'utils/helpers.js', []);
assert(sf.length === 0, 'Safe line produces zero findings');

// Unhandled promise
const up = runRules(line('fetchData().then(d => save(d))'), 'api/sync.js', []);
assert(up.some(h => h.rule_name === 'unhandled-promise'), 'Unhandled promise detected');

// Behavioral escalation — weight 1.5 for known pattern (3+ count)
const patterns = [{ rule_name: 'sql-injection', count: 5 }];
const esc = runRules(line('const q = `SELECT * WHERE id=${id}`'), 'api/q.js', patterns);
const hit = esc.find(h => h.rule_name === 'sql-injection');
assert(hit?.weight === 1.5, 'Behavioral escalation weight = 1.5');

// All rule files have required interface
const { ALL_RULES } = require('../backend/rules/index');
assert(ALL_RULES.length === 20, '20 rule files loaded');
assert(ALL_RULES.every(r => r.name && r.severity && typeof r.check === 'function'), 'All rules have correct interface');

console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
