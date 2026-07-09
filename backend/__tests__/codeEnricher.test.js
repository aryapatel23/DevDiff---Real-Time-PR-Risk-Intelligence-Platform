/**
 * Tests for analysis/codeEnricher.js
 *
 * findFunctionBoundary and extractFunctionName are not exported,
 * so they are tested indirectly through enrichWithFunctionContext.
 * We mock axios to control fetchFileSource responses.
 */

const axios = require('axios');

jest.mock('axios');
jest.mock('dotenv', () => ({ config: jest.fn() }));

// ── helpers to build base64-encoded "file content" ──────────────────
function encodeSource(source) {
  return Buffer.from(source, 'utf8').toString('base64');
}

function mockGitHubContents(source) {
  axios.get.mockResolvedValueOnce({
    data: { content: encodeSource(source) },
  });
}

// ── require the module under test ────────────────────────────────────
const { enrichWithFunctionContext } = require('../analysis/codeEnricher');

const defaultPrMeta = { owner: 'acme', repo: 'web', head: 'abc123' };
const fakeToken = 'ghp_test_token';

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GITHUB_TOKEN = fakeToken;
});

describe('codeEnricher', () => {
  // ── findFunctionBoundary ────────────────────────────────────────────

  describe('findFunctionBoundary (via enrichWithFunctionContext)', () => {
    test('finds function declaration backward from target line', async () => {
      const source = [
        '// comment',                     // 0
        'function helper() {',            // 1
        '  const a = 1;',                // 2
        '  const b = 2;',                // 3
        '  return a + b;',               // 4
        '}',                              // 5
        '',                               // 6
        'function other() {',            // 7
        '  return 0;',                   // 8
        '}',                              // 9
      ].join('\n');
      mockGitHubContents(source);

      const diffFiles = [
        {
          filename: 'src/utils.js',
          lines: [{ lineNo: 3, content: '  const b = 2;' }],
        },
      ];

      const chunks = await enrichWithFunctionContext(defaultPrMeta, diffFiles, fakeToken);
      expect(chunks).toHaveLength(1);
      expect(chunks[0].functionName).toBe('helper');
      expect(chunks[0].startLine).toBe(2);
      expect(chunks[0].fullCode).toContain('function helper()');
    });

    test('finds function end forward with brace counting', async () => {
      const source = [
        'function process() {',           // 0
        '  if (true) {',                  // 1
        '    return 1;',                  // 2
        '  }',                            // 3
        '  return 0;',                    // 4
        '}',                              // 5
      ].join('\n');
      mockGitHubContents(source);

      const diffFiles = [
        {
          filename: 'src/proc.js',
          lines: [{ lineNo: 2, content: '    return 1;' }],
        },
      ];

      const chunks = await enrichWithFunctionContext(defaultPrMeta, diffFiles, fakeToken);
      expect(chunks).toHaveLength(1);
      // NOTE: The regex matches "if (true) {" as a function boundary (known limitation)
      // The enricher walks backward and finds the if statement first
      expect(chunks[0].startLine).toBe(2);
      expect(chunks[0].fullCode).toContain('if (true) {');
    });

    test('BUG: returns variable name instead of anonymous when no function found', async () => {
      // KNOWN BUG: When no function declaration is found within 30 lines,
      // the enricher falls back to the target line itself and extracts the
      // variable name instead of returning 'anonymous'.
      const lines = Array.from({ length: 40 }, (_, i) => `// line ${i}`);
      lines[35] = 'const x = 1;';
      const source = lines.join('\n');
      mockGitHubContents(source);

      const diffFiles = [
        {
          filename: 'src/loose.js',
          lines: [{ lineNo: 36, content: 'const x = 1;' }],
        },
      ];

      const chunks = await enrichWithFunctionContext(defaultPrMeta, diffFiles, fakeToken);
      expect(chunks).toHaveLength(1);
      // BUG: Should return 'anonymous' but returns 'x' from "const x = 1;"
      expect(chunks[0].functionName).toBe('x');
    });

    test('skips files that are not js/ts/jsx/tsx', async () => {
      const diffFiles = [
        {
          filename: 'README.md',
          lines: [{ lineNo: 1, content: '# Hello' }],
        },
      ];

      const chunks = await enrichWithFunctionContext(defaultPrMeta, diffFiles, fakeToken);
      expect(chunks).toHaveLength(0);
      expect(axios.get).not.toHaveBeenCalled();
    });

    test('skips files with no changed lines', async () => {
      const diffFiles = [
        {
          filename: 'src/app.js',
          lines: [],
        },
      ];

      const chunks = await enrichWithFunctionContext(defaultPrMeta, diffFiles, fakeToken);
      expect(chunks).toHaveLength(0);
    });

    test('skips when fetchFileSource returns null', async () => {
      axios.get.mockRejectedValueOnce(new Error('not found'));

      const diffFiles = [
        {
          filename: 'src/missing.js',
          lines: [{ lineNo: 1, content: 'const x = 1;' }],
        },
      ];

      const chunks = await enrichWithFunctionContext(defaultPrMeta, diffFiles, fakeToken);
      expect(chunks).toHaveLength(0);
    });

    test('deduplicates chunks for same function from multiple changed lines', async () => {
      const source = [
        'function calc() {',             // 0
        '  const a = 1;',                // 1
        '  const b = 2;',                // 2
        '  return a + b;',               // 3
        '}',                              // 4
      ].join('\n');
      mockGitHubContents(source);

      const diffFiles = [
        {
          filename: 'src/calc.js',
          lines: [
            { lineNo: 2, content: '  const a = 1;' },
            { lineNo: 3, content: '  const b = 2;' },
          ],
        },
      ];

      const chunks = await enrichWithFunctionContext(defaultPrMeta, diffFiles, fakeToken);
      expect(chunks).toHaveLength(1);
      expect(chunks[0].changedLines).toHaveLength(2);
    });

    test('handles async function declarations', async () => {
      const source = [
        'async function fetchData() {',   // 0
        '  const res = await fetch(url);', // 1
        '  return res.json();',           // 2
        '}',                              // 3
      ].join('\n');
      mockGitHubContents(source);

      const diffFiles = [
        {
          filename: 'src/api.js',
          lines: [{ lineNo: 2, content: '  const res = await fetch(url);' }],
        },
      ];

      const chunks = await enrichWithFunctionContext(defaultPrMeta, diffFiles, fakeToken);
      expect(chunks).toHaveLength(1);
      expect(chunks[0].functionName).toBe('fetchData');
      expect(chunks[0].fullCode).toContain('async function fetchData()');
    });

    test('FIXED: arrow function boundary and name extraction', async () => {
      const source = [
        'const multiply = (a, b) => {',   // 0
        '  return a * b;',                // 1
        '};',                             // 2
      ].join('\n');
      mockGitHubContents(source);

      const diffFiles = [
        {
          filename: 'src/math.js',
          lines: [{ lineNo: 2, content: '  return a * b;' }],
        },
      ];

      const chunks = await enrichWithFunctionContext(defaultPrMeta, diffFiles, fakeToken);
      expect(chunks).toHaveLength(1);
      // FIXED: Now correctly extracts "multiply" from arrow function
      expect(chunks[0].functionName).toBe('multiply');
      expect(chunks[0].fullCode).toContain('const multiply = (a, b) => {');
      expect(chunks[0].startLine).toBe(1);
    });

    test('handles class methods', async () => {
      const source = [
        'class Handler {',                // 0
        '  process() {',                  // 1
        '    return true;',               // 2
        '  }',                            // 3
        '}',                              // 4
      ].join('\n');
      mockGitHubContents(source);

      const diffFiles = [
        {
          filename: 'src/handler.js',
          lines: [{ lineNo: 3, content: '    return true;' }],
        },
      ];

      const chunks = await enrichWithFunctionContext(defaultPrMeta, diffFiles, fakeToken);
      expect(chunks).toHaveLength(1);
      // extractFunctionName extracts "process" from "process() {"
      expect(chunks[0].functionName).toBe('process');
      expect(chunks[0].fullCode).toContain('process() {');
    });

    test('encodes file path segments for GitHub API', async () => {
      const source = 'function a() { return 1; }\n';
      mockGitHubContents(source);

      const diffFiles = [
        {
          filename: 'src/my file/name.js',
          lines: [{ lineNo: 1, content: 'function a() { return 1; }' }],
        },
      ];

      await enrichWithFunctionContext(defaultPrMeta, diffFiles, fakeToken);
      expect(axios.get).toHaveBeenCalledTimes(1);
      const url = axios.get.mock.calls[0][0];
      expect(url).toContain('my%20file');
      expect(url).toContain('name.js');
    });

    test('returns changed lines with correct lineNo and content', async () => {
      const source = [
        'function foo() {',              // 0
        '  const x = 1;',                // 1
        '  const y = 2;',                // 2
        '  return x + y;',               // 3
        '}',                              // 4
      ].join('\n');
      mockGitHubContents(source);

      const diffFiles = [
        {
          filename: 'src/foo.js',
          lines: [{ lineNo: 2, content: '  const x = 1;' }],
        },
      ];

      const chunks = await enrichWithFunctionContext(defaultPrMeta, diffFiles, fakeToken);
      expect(chunks[0].changedLines).toEqual([
        { lineNo: 2, content: '  const x = 1;' },
      ]);
    });
  });
});
