const { checkChangedFileSyntax, parseForSyntaxForTest } = require('../backend/ast/syntaxCheck');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log('  PASS:', msg); passed++; }
  else { console.error('  FAIL:', msg); failed++; }
}

console.log('\n── Syntax Check Tests ──');

(async () => {
  const valid = await checkChangedFileSyntax(
    { filename: 'src/app.ts', raw_url: 'http://unused' },
    {},
  );
  assert(valid === null, 'no fetch => no syntax finding (safe fallback)');

  const brokenJs = parseForSyntaxForTest('const total =', 'demo.js');
  assert(!!brokenJs, 'broken JS syntax is detected');

  const brokenTsx = parseForSyntaxForTest('const Comp = () => <div>', 'demo.tsx');
  assert(!!brokenTsx, 'broken TSX syntax is detected');

  const goodTs = parseForSyntaxForTest('const total: number = 1', 'demo.ts');
  assert(goodTs === null, 'valid TS syntax is not flagged');

  console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
