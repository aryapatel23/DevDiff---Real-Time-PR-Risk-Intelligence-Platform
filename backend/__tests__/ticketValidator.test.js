/**
 * Tests for intent/ticketValidator.js
 */

const { detectDomain, validateIntent } = require('../intent/ticketValidator');

describe('ticketValidator', () => {
  // ── detectDomain ───────────────────────────────────────────────────
  describe('detectDomain', () => {
    // ── 1. Auth domain ───────────────────────────────────────────────
    test('identifies auth domain from keywords', () => {
      expect(detectDomain('Fix the login page redirect')).toBe('auth');
      expect(detectDomain('Session token expires too early')).toBe('auth');
      expect(detectDomain('JWT validation is broken')).toBe('auth');
      expect(detectDomain('Add OAuth2 provider')).toBe('auth');
    });

    // ── 2. Payment domain ────────────────────────────────────────────
    test('identifies payment domain', () => {
      expect(detectDomain('Stripe checkout integration')).toBe('payment');
      expect(detectDomain('Invoice PDF generation')).toBe('payment');
      expect(detectDomain('Billing cycle calculation')).toBe('payment');
      expect(detectDomain('Refund processing fails')).toBe('payment');
    });

    // ── 3. Database domain ───────────────────────────────────────────
    test('identifies database domain', () => {
      expect(detectDomain('Add index on users table')).toBe('database');
      expect(detectDomain('Schema migration for orders')).toBe('database');
      expect(detectDomain('ORM query optimization')).toBe('database');
      expect(detectDomain('SQL injection prevention')).toBe('database');
    });

    // ── 4. User domain ───────────────────────────────────────────────
    test('identifies user domain', () => {
      expect(detectDomain('User profile page update')).toBe('user');
      expect(detectDomain('Admin role permissions')).toBe('user');
      expect(detectDomain('Account settings preferences')).toBe('user');
      expect(detectDomain('Avatar upload feature')).toBe('user');
    });

    // ── 5. UI domain ─────────────────────────────────────────────────
    test('identifies ui domain', () => {
      expect(detectDomain('Button component styling')).toBe('ui');
      expect(detectDomain('Modal form layout')).toBe('ui');
      expect(detectDomain('CSS responsive design')).toBe('ui');
      expect(detectDomain('Page navigation component')).toBe('ui');
    });

    // ── 6. Returns null for unknown content ───────────────────────────
    test('returns null for unknown content', () => {
      expect(detectDomain('')).toBe(null);
      expect(detectDomain('Hello world')).toBe(null);
      expect(detectDomain('12345')).toBe(null);
      expect(detectDomain('---')).toBe(null);
    });

    test('returns the highest-scoring domain when multiple match', () => {
      // "login" is auth, "user" is user — auth should win with more keywords
      const result = detectDomain('login authentication password token session');
      expect(result).toBe('auth');
    });

    test('is case-insensitive', () => {
      expect(detectDomain('LOGIN PAGE')).toBe('auth');
      expect(detectDomain('Payment Gateway')).toBe('payment');
      expect(detectDomain('DATABASE MIGRATION')).toBe('database');
    });
  });

  // ── validateIntent ─────────────────────────────────────────────────
  describe('validateIntent', () => {
    // ── 8. Passes on aligned domains ─────────────────────────────────
    test('passes when ticket and files are in the same domain', async () => {
      const fetcher = jest.fn().mockResolvedValue('Fix login redirect after logout');
      const files = ['src/auth/login.js', 'src/auth/session.js'];

      const result = await validateIntent('https://github.com/org/repo/issues/42', files, fetcher);
      expect(result.hasWarning).toBe(false);
      expect(result.message).toBeNull();
    });

    // ── 7. Warns on domain mismatch ──────────────────────────────────
    test('warns when ticket and files are in different domains', async () => {
      const fetcher = jest.fn().mockResolvedValue('Fix login redirect and password reset flow');
      const files = ['src/billing/payment.js', 'src/billing/invoice.js'];

      const result = await validateIntent('https://github.com/org/repo/issues/42', files, fetcher);
      expect(result.hasWarning).toBe(true);
      expect(result.message).toContain('auth');
      expect(result.message).toContain('payment');
      expect(result.message).toContain('scope drift');
    });

    // ── 9. Passes when no ticket URL ─────────────────────────────────
    test('passes when ticket URL is null', async () => {
      const fetcher = jest.fn();
      const result = await validateIntent(null, ['src/app.js'], fetcher);
      expect(result.hasWarning).toBe(false);
      expect(result.message).toBeNull();
      expect(fetcher).not.toHaveBeenCalled();
    });

    test('passes when ticket URL is empty string', async () => {
      const fetcher = jest.fn();
      const result = await validateIntent('', ['src/app.js'], fetcher);
      expect(result.hasWarning).toBe(false);
      expect(fetcher).not.toHaveBeenCalled();
    });

    test('passes when changedFiles is null', async () => {
      const fetcher = jest.fn();
      const result = await validateIntent('https://example.com/issue/1', null, fetcher);
      expect(result.hasWarning).toBe(false);
      expect(fetcher).not.toHaveBeenCalled();
    });

    test('passes when changedFiles is empty', async () => {
      const fetcher = jest.fn();
      const result = await validateIntent('https://example.com/issue/1', [], fetcher);
      expect(result.hasWarning).toBe(false);
      expect(fetcher).not.toHaveBeenCalled();
    });

    test('passes when fetched ticket text is too short', async () => {
      const fetcher = jest.fn().mockResolvedValue('hi');
      const result = await validateIntent('https://example.com/issue/1', ['src/app.js'], fetcher);
      expect(result.hasWarning).toBe(false);
    });

    test('passes when ticket domain is null (no keywords match)', async () => {
      const fetcher = jest.fn().mockResolvedValue('Fix the broken thing that does stuff');
      const result = await validateIntent('https://example.com/issue/1', ['src/app.js'], fetcher);
      expect(result.hasWarning).toBe(false);
    });

    test('warns with top 3 files in message', async () => {
      const fetcher = jest.fn().mockResolvedValue('Fix the payment checkout billing stripe');
      const files = ['src/ui/button.js', 'src/ui/modal.js', 'src/ui/form.js', 'src/ui/style.css'];

      const result = await validateIntent('https://example.com/issue/1', files, fetcher);
      expect(result.hasWarning).toBe(true);
      expect(result.message).toContain('src/ui/button.js');
      expect(result.message).toContain('src/ui/modal.js');
      expect(result.message).toContain('src/ui/form.js');
    });

    test('passes when file domain matches ticket domain', async () => {
      const fetcher = jest.fn().mockResolvedValue('Add database migration for new schema');
      const files = ['db/migrations/001.sql', 'db/schema.js'];

      const result = await validateIntent('https://example.com/issue/1', files, fetcher);
      expect(result.hasWarning).toBe(false);
    });
  });
});
