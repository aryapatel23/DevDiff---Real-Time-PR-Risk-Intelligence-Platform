const { parseDiff } = require('../backend/parser/diffParser');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log('  PASS:', msg); passed++; }
  else       { console.error('  FAIL:', msg); failed++; }
}

console.log('\n── Diff Parser Tests ──');

// T1: Basic added line
const r1 = parseDiff('@@ -1,2 +1,3 @@\n context\n+added line\n-removed');
assert(r1.length === 1,            'T1a: finds 1 added line');
assert(r1[0].lineNo  === 2,        'T1b: correct line number');
assert(r1[0].content === 'added line', 'T1c: correct content');
assert(r1[0].isAdded === true,     'T1d: isAdded is true');

// T2: Multi-hunk
const r2 = parseDiff('@@ -10,2 +10,3 @@\n ctx\n+line A\n@@ -20,1 +21,2 @@\n ctx2\n+line B');
assert(r2.length === 2,   'T2a: finds 2 lines across hunks');
assert(r2[0].lineNo === 11, 'T2b: first hunk line number correct');
assert(r2[1].lineNo === 22, 'T2c: second hunk line number correct');

// T3: Empty patch
assert(parseDiff('').length === 0,   'T3: empty patch returns []');
assert(parseDiff(null).length === 0, 'T4: null returns []');

// T5: +++ header not included
const r5 = parseDiff('+++ b/file.js\n@@ -1,1 +1,2 @@\n+real line');
assert(r5.length === 1 && r5[0].content === 'real line', 'T5: +++ header excluded');

console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
