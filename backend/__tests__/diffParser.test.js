/**
 * Tests for parser/diffParser.js
 */

const { parseDiff } = require('../parser/diffParser');

describe('diffParser', () => {
  // ── 1. Parses added lines from unified diff ────────────────────────
  describe('basic added lines', () => {
    test('extracts lines starting with +', () => {
      const patch = [
        '@@ -1,2 +1,4 @@',
        ' context line',
        '+added line one',
        '+added line two',
      ].join('\n');

      const result = parseDiff(patch);
      expect(result).toHaveLength(2);
      // newLineNo starts at 0 (from +1 hunk), first ctx increments to 1,
      // first + increments to 2, second + increments to 3
      expect(result[0]).toEqual({ lineNo: 2, content: 'added line one', isAdded: true });
      expect(result[1]).toEqual({ lineNo: 3, content: 'added line two', isAdded: true });
    });

    test('strips the leading + from content', () => {
      const patch = '@@ -1 +1 @@\n+hello world';
      const result = parseDiff(patch);
      expect(result[0].content).toBe('hello world');
    });
  });

  // ── 2. Handles multi-hunk diffs ─────────────────────────────────────
  describe('multi-hunk diffs', () => {
    test('tracks line numbers across multiple hunks', () => {
      const patch = [
        '@@ -1,3 +1,5 @@',
        ' context',
        '+added in hunk 1',
        ' context',
        '',
        '@@ -10,3 +12,5 @@',
        ' context',
        '+added in hunk 2',
        ' context',
      ].join('\n');

      const result = parseDiff(patch);
      expect(result).toHaveLength(2);
      // First hunk: +1 -> newLineNo=0, ctx->1, +added->2, ctx->3
      expect(result[0]).toEqual({ lineNo: 2, content: 'added in hunk 1', isAdded: true });
      // Second hunk: +12 -> newLineNo=11, ctx->12, +added->13, ctx->14
      expect(result[1]).toEqual({ lineNo: 13, content: 'added in hunk 2', isAdded: true });
    });

    test('resets line counter per hunk header', () => {
      const patch = [
        '@@ -5,3 +5,3 @@',
        '+aaa',
        ' ctx',
        '@@ -20,3 +20,3 @@',
        '+bbb',
      ].join('\n');

      const result = parseDiff(patch);
      // First hunk: +5 -> newLineNo=4, +aaa->5
      expect(result[0].lineNo).toBe(5);
      // Second hunk: +20 -> newLineNo=19, +bbb->20
      expect(result[1].lineNo).toBe(20);
    });
  });

  // ── 3. Returns empty array for empty patch ──────────────────────────
  describe('empty and invalid input', () => {
    test('returns empty array for empty string', () => {
      expect(parseDiff('')).toEqual([]);
    });

    test('returns empty array for whitespace-only string', () => {
      expect(parseDiff('   \n  \n  ')).toEqual([]);
    });
  });

  // ── 4. Returns empty array for null input ───────────────────────────
  describe('null/undefined input', () => {
    test('returns empty array for null', () => {
      expect(parseDiff(null)).toEqual([]);
    });

    test('returns empty array for undefined', () => {
      expect(parseDiff(undefined)).toEqual([]);
    });

    test('returns empty array for non-string input', () => {
      expect(parseDiff(123)).toEqual([]);
      expect(parseDiff({})).toEqual([]);
      expect(parseDiff([])).toEqual([]);
    });
  });

  // ── 5. Correctly tracks new-file line numbers ──────────────────────
  describe('line number tracking', () => {
    test('increments line number for each added line', () => {
      const patch = [
        '@@ -0,0 +1,5 @@',
        '+line a',
        '+line b',
        '+line c',
      ].join('\n');

      const result = parseDiff(patch);
      // +1 -> newLineNo=0, +line a->1, +line b->2, +line c->3
      expect(result[0].lineNo).toBe(1);
      expect(result[1].lineNo).toBe(2);
      expect(result[2].lineNo).toBe(3);
    });

    test('uses hunk header new-start as base', () => {
      const patch = '@@ -0,0 +100,2 @@\n+first\n+second';
      const result = parseDiff(patch);
      // +100 -> newLineNo=99, +first->100, +second->101
      expect(result[0].lineNo).toBe(100);
      expect(result[1].lineNo).toBe(101);
    });

    test('handles hunk header with count format +start,count', () => {
      const patch = '@@ -5,0 +10,1 @@\n+hello';
      const result = parseDiff(patch);
      // +10 -> newLineNo=9, +hello->10
      expect(result[0].lineNo).toBe(10);
    });
  });

  // ── 6. Excludes +++ b/file headers ──────────────────────────────────
  describe('file headers', () => {
    test('skips +++ b/file line', () => {
      const patch = [
        '--- a/file.js',
        '+++ b/file.js',
        '@@ -1 +1 @@',
        '+new line',
      ].join('\n');

      const result = parseDiff(patch);
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('new line');
    });

    test('skips --- a/file line', () => {
      const patch = [
        '--- a/file.js',
        '+++ b/file.js',
        '@@ -1 +1 @@',
        '+stuff',
      ].join('\n');

      const result = parseDiff(patch);
      expect(result).toHaveLength(1);
    });
  });

  // ── 7. Handles context lines (don't increment counter for added) ────
  describe('context lines', () => {
    test('context lines increment the new file line counter', () => {
      const patch = [
        '@@ -1,3 +1,3 @@',
        ' context one',
        '+added',
        ' context two',
      ].join('\n');

      const result = parseDiff(patch);
      // newLineNo=0, ctx one->1, +added->2, ctx two->3
      expect(result[0]).toEqual({ lineNo: 2, content: 'added', isAdded: true });
    });

    test('context lines do not appear in result', () => {
      const patch = [
        '@@ -1,3 +1,3 @@',
        ' ctx',
        '+added',
        ' ctx',
      ].join('\n');

      const result = parseDiff(patch);
      expect(result).toHaveLength(1);
      expect(result.every(l => l.isAdded)).toBe(true);
    });
  });

  // ── 8. Handles deleted lines (don't increment counter) ─────────────
  describe('deleted lines', () => {
    test('deleted lines do not increment new-file line number', () => {
      const patch = [
        '@@ -1,3 +1,2 @@',
        '+after delete',
        '-deleted line',
        '+second after',
      ].join('\n');

      const result = parseDiff(patch);
      // newLineNo=0, +after delete->1, -deleted(skip), +second after->2
      expect(result[0]).toEqual({ lineNo: 1, content: 'after delete', isAdded: true });
      expect(result[1]).toEqual({ lineNo: 2, content: 'second after', isAdded: true });
    });

    test('deleted lines do not appear in result', () => {
      const patch = [
        '@@ -1,3 +1,1 @@',
        '-removed one',
        '-removed two',
        '+only this',
      ].join('\n');

      const result = parseDiff(patch);
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('only this');
    });
  });

  // ── 9. Handles hunk headers (@@ -x,y +a,b @@) ─────────────────────
  describe('hunk headers', () => {
    test('parses standard hunk header format', () => {
      const patch = '@@ -10,5 +20,8 @@ function foo()';
      const result = parseDiff(patch);
      // No added lines, just verifying no crash
      expect(result).toEqual([]);
    });

    test('parses hunk header with only start (no count)', () => {
      const patch = '@@ -10 +20 @@';
      const result = parseDiff(patch);
      expect(result).toEqual([]);
    });

    test('extracts correct new-file start from hunk', () => {
      const patch = [
        '@@ -100,5 +200,3 @@',
        '+aaa',
      ].join('\n');

      const result = parseDiff(patch);
      // +200 -> newLineNo=199, +aaa->200
      expect(result[0].lineNo).toBe(200);
    });

    test('ignores malformed hunk headers', () => {
      const patch = [
        '@@ invalid header @@',
        '+line',
      ].join('\n');

      const result = parseDiff(patch);
      // Malformed header doesn't match regex, newLineNo stays 0
      // +line -> newLineNo=1
      expect(result[0].lineNo).toBe(1);
    });
  });

  // ── Complex / edge cases ────────────────────────────────────────────
  describe('edge cases', () => {
    test('handles a full realistic patch', () => {
      const patch = [
        '--- a/src/auth.js',
        '+++ b/src/auth.js',
        '@@ -1,10 +1,15 @@ import express from "express";',
        ' import express from "express";',
        '+import jwt from "jsonwebtoken";',
        '',
        ' const app = express();',
        '-const PORT = 3000;',
        '+const PORT = process.env.PORT || 3000;',
        '',
        ' app.post("/login", (req, res) => {',
        '+  const { username, password } = req.body;',
        '+  const token = jwt.sign({ username }, process.env.SECRET);',
        '+  res.json({ token });',
        ' });',
      ].join('\n');

      const result = parseDiff(patch);
      expect(result).toHaveLength(5);
      // newLineNo=0, ctx->1, +jwt->2, ctx->3, ctx->4,
      // -PORT(skip), +PORT->5, ctx->6, ctx->7,
      // +req.body->8, +token->9, +res.json->10, ctx->11
      expect(result.map(r => r.content)).toEqual([
        'import jwt from "jsonwebtoken";',
        'const PORT = process.env.PORT || 3000;',
        '  const { username, password } = req.body;',
        '  const token = jwt.sign({ username }, process.env.SECRET);',
        '  res.json({ token });',
      ]);
      expect(result.map(r => r.lineNo)).toEqual([2, 5, 8, 9, 10]);
    });

    test('handles patch with only deletions', () => {
      const patch = [
        '@@ -1,3 +1 @@',
        '-line one',
        '-line two',
        '-line three',
      ].join('\n');

      const result = parseDiff(patch);
      expect(result).toEqual([]);
    });

    test('handles patch with no hunk headers', () => {
      const patch = '+just an added line';
      const result = parseDiff(patch);
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('just an added line');
    });
  });
});
