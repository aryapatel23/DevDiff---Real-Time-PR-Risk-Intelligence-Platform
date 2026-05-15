const { detectDomain, validateIntent } = require('../backend/intent/ticketValidator');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log('  PASS:', msg); passed++; }
  else { console.error('  FAIL:', msg); failed++; }
}

console.log('\n── Ticket Intent Tests ──');

assert(detectDomain('Implement oauth login and jwt token refresh') === 'auth', 'detects auth domain');
assert(detectDomain('Build checkout invoice and refund flow') === 'payment', 'detects payment domain');
assert(detectDomain('Random unrelated sentence') === null, 'returns null for unknown domain');

(async () => {
  const noTicket = await validateIntent('', ['src/auth/login.ts']);
  assert(noTicket.hasWarning === false, 'no ticket URL yields no warning');

  const mismatch = await validateIntent(
    'https://github.com/acme/repo/issues/1',
    ['src/payments/checkout.ts', 'src/payments/refund.ts'],
    async () => 'Fix login authentication and session timeout bug'
  );
  assert(mismatch.hasWarning === true, 'domain mismatch raises warning');
  assert(/mismatch/i.test(mismatch.message || ''), 'mismatch warning contains message');

  const aligned = await validateIntent(
    'https://github.com/acme/repo/issues/2',
    ['src/user/account/profile.ts'],
    async () => 'Update user profile and account settings'
  );
  assert(aligned.hasWarning === false, 'aligned ticket/file domains do not warn');

  console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
