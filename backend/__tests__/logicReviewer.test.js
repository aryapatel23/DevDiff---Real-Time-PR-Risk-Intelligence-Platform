/**
 * Tests for analysis/logicReviewer.js
 *
 * buildPrompt and reviewChunk are not exported, so they are tested
 * indirectly through reviewAllChunks. We mock axios to control
 * Groq API responses.
 */

const axios = require('axios');

jest.mock('axios');
jest.mock('dotenv', () => ({ config: jest.fn() }));

const { reviewAllChunks } = require('../analysis/logicReviewer');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GROQ_API_KEY = 'gsk_test_key';
  process.env.NODE_ENV = 'test';
});

function makeChunk(overrides = {}) {
  return {
    filename: 'src/app.js',
    functionName: 'process',
    fullCode: 'function process() {\n  const x = 1;\n  return x;\n}',
    changedLines: [{ lineNo: 2, content: '  const x = 1;' }],
    startLine: 1,
    endLine: 4,
    ...overrides,
  };
}

function mockGroqResponse(findings) {
  axios.post.mockResolvedValueOnce({
    data: {
      choices: [
        { message: { content: JSON.stringify(findings) } },
      ],
    },
  });
}

function mockGroqRawResponse(rawText) {
  axios.post.mockResolvedValueOnce({
    data: {
      choices: [
        { message: { content: rawText } },
      ],
    },
  });
}

describe('logicReviewer', () => {
  // ── buildPrompt (verified via API call content) ─────────────────────

  describe('buildPrompt (via reviewAllChunks)', () => {
    test('generates prompt with function code and changed lines', async () => {
      const chunk = makeChunk();
      mockGroqResponse([]);

      await reviewAllChunks([chunk], jest.fn());

      const callBody = axios.post.mock.calls[0][1];
      const userMsg = callBody.messages[1].content;
      expect(userMsg).toContain('File: src/app.js');
      expect(userMsg).toContain('Function: process (lines 1–4)');
      expect(userMsg).toContain('Changed lines: 2');
      expect(userMsg).toContain('function process()');
      expect(userMsg).toContain('Line 2:');
    });
  });

  // ── reviewChunk ─────────────────────────────────────────────────────

  describe('reviewChunk (via reviewAllChunks)', () => {
    test('calls Groq API with correct parameters', async () => {
      const chunk = makeChunk();
      mockGroqResponse([]);

      await reviewAllChunks([chunk], jest.fn());

      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(axios.post).toHaveBeenCalledWith(
        GROQ_URL,
        expect.objectContaining({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 1024,
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user' }),
          ]),
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer gsk_test_key',
            'Content-Type': 'application/json',
          }),
          timeout: 15000,
        })
      );
    });

    test('handles API errors gracefully', async () => {
      const chunk = makeChunk();
      axios.post.mockRejectedValueOnce(new Error('API timeout'));

      const onFinding = jest.fn();
      const results = await reviewAllChunks([chunk], onFinding);

      expect(results).toEqual([]);
      expect(onFinding).not.toHaveBeenCalled();
    });

    test('handles malformed JSON response', async () => {
      const chunk = makeChunk();
      mockGroqRawResponse('This is not valid JSON at all');

      const results = await reviewAllChunks([chunk], jest.fn());
      expect(results).toEqual([]);
    });

    test('handles response wrapped in markdown fences', async () => {
      const chunk = makeChunk();
      const findings = [{ type: 'logic', severity: 'warning', line: 2, message: 'issue', confidence: 80 }];
      mockGroqRawResponse('```json\n' + JSON.stringify(findings) + '\n```');

      const results = await reviewAllChunks([chunk], jest.fn());
      expect(results).toHaveLength(1);
      expect(results[0].message).toBe('issue');
    });

    test('normalizes severity to valid values', async () => {
      const chunk = makeChunk();
      mockGroqResponse([
        { type: 'logic', severity: 'bad_severity', line: 1, message: 'm', confidence: 50 },
      ]);

      const results = await reviewAllChunks([chunk], jest.fn());
      expect(results[0].severity).toBe('warning');
    });

    test('clamps confidence to 0-100 range', async () => {
      const chunk = makeChunk();
      mockGroqResponse([
        { type: 'logic', severity: 'warning', line: 1, message: 'm', confidence: 150 },
      ]);

      const results = await reviewAllChunks([chunk], jest.fn());
      expect(results[0].confidence).toBe(100);
    });

    test('defaults confidence to 70 when missing', async () => {
      const chunk = makeChunk();
      mockGroqResponse([
        { type: 'logic', severity: 'warning', line: 1, message: 'm' },
      ]);

      const results = await reviewAllChunks([chunk], jest.fn());
      expect(results[0].confidence).toBe(70);
    });

    test('truncates message and fix to 300 chars', async () => {
      const chunk = makeChunk();
      const longMsg = 'x'.repeat(400);
      const longFix = 'y'.repeat(400);
      mockGroqResponse([
        { type: 'logic', severity: 'warning', line: 1, message: longMsg, fix: longFix, confidence: 50 },
      ]);

      const results = await reviewAllChunks([chunk], jest.fn());
      expect(results[0].message).toHaveLength(300);
      expect(results[0].fix).toHaveLength(300);
    });

    test('returns empty array when response is not an array', async () => {
      const chunk = makeChunk();
      mockGroqRawResponse('{"not": "an array"}');

      const results = await reviewAllChunks([chunk], jest.fn());
      expect(results).toEqual([]);
    });

    test('skips findings without message or severity', async () => {
      const chunk = makeChunk();
      mockGroqResponse([
        { type: 'logic', severity: 'warning', line: 1 },
        { type: 'logic', message: 'no severity', line: 2 },
        { type: 'logic', severity: 'warning', message: 'valid', line: 3, confidence: 80 },
      ]);

      const results = await reviewAllChunks([chunk], jest.fn());
      expect(results).toHaveLength(1);
      expect(results[0].message).toBe('valid');
    });

    test('adds metadata fields to each finding', async () => {
      const chunk = makeChunk({ filename: 'src/test.js', functionName: 'handler' });
      mockGroqResponse([
        { type: 'logic', severity: 'critical', line: 5, message: 'bug', confidence: 90 },
      ]);

      const results = await reviewAllChunks([chunk], jest.fn());
      expect(results[0]).toMatchObject({
        type: 'logic',
        severity: 'critical',
        line: 5,
        message: 'bug',
        confidence: 90,
        filename: 'src/test.js',
        functionName: 'handler',
        source: 'llm',
      });
    });
  });

  // ── reviewAllChunks ─────────────────────────────────────────────────

  describe('reviewAllChunks', () => {
    test('processes chunks in batches of 3', async () => {
      const chunks = [
        makeChunk({ filename: 'a.js', functionName: 'a' }),
        makeChunk({ filename: 'b.js', functionName: 'b' }),
        makeChunk({ filename: 'c.js', functionName: 'c' }),
        makeChunk({ filename: 'd.js', functionName: 'd' }),
      ];

      chunks.forEach(() => mockGroqResponse([]));

      await reviewAllChunks(chunks, jest.fn());

      expect(axios.post).toHaveBeenCalledTimes(4);
    });

    test('returns findings array', async () => {
      const chunks = [
        makeChunk({ filename: 'a.js' }),
        makeChunk({ filename: 'b.js' }),
      ];

      mockGroqResponse([{ type: 'logic', severity: 'warning', line: 1, message: 'a', confidence: 80 }]);
      mockGroqResponse([{ type: 'logic', severity: 'critical', line: 2, message: 'b', confidence: 90 }]);

      const results = await reviewAllChunks(chunks, jest.fn());
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(2);
      expect(results[0].message).toBe('a');
      expect(results[1].message).toBe('b');
    });

    test('skips test files', async () => {
      const chunks = [
        makeChunk({ filename: 'src/app.test.js' }),
        makeChunk({ filename: 'src/__tests__/helper.spec.js' }),
        makeChunk({ filename: 'src/__tests__/unit.js' }),
      ];

      const onFinding = jest.fn();
      const results = await reviewAllChunks(chunks, onFinding);

      expect(results).toEqual([]);
      expect(axios.post).not.toHaveBeenCalled();
      expect(onFinding).not.toHaveBeenCalled();
    });

    test('skips functions shorter than 4 lines', async () => {
      const chunk = makeChunk({
        fullCode: 'function short() {\n  return 1;\n}',
      });

      const results = await reviewAllChunks([chunk], jest.fn());
      expect(results).toEqual([]);
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('skips when GROQ_API_KEY is not set', async () => {
      delete process.env.GROQ_API_KEY;
      const chunk = makeChunk();

      const results = await reviewAllChunks([chunk], jest.fn());
      expect(results).toEqual([]);
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('calls onFinding callback for each finding', async () => {
      const chunks = [makeChunk()];
      mockGroqResponse([
        { type: 'logic', severity: 'warning', line: 1, message: 'issue1', confidence: 80 },
        { type: 'logic', severity: 'critical', line: 3, message: 'issue2', confidence: 95 },
      ]);

      const onFinding = jest.fn();
      await reviewAllChunks(chunks, onFinding);

      expect(onFinding).toHaveBeenCalledTimes(2);
      expect(onFinding).toHaveBeenCalledWith({
        type: 'logic_finding',
        data: expect.objectContaining({ message: 'issue1' }),
      });
      expect(onFinding).toHaveBeenCalledWith({
        type: 'logic_finding',
        data: expect.objectContaining({ message: 'issue2' }),
      });
    });

    test('collects findings from multiple batches', async () => {
      const chunks = Array.from({ length: 7 }, (_, i) =>
        makeChunk({ filename: `file${i}.js`, functionName: `fn${i}` })
      );

      chunks.forEach((_, i) => {
        mockGroqResponse([{ type: 'logic', severity: 'warning', line: 1, message: `issue${i}`, confidence: 70 + i }]);
      });

      const results = await reviewAllChunks(chunks, jest.fn());
      expect(results).toHaveLength(7);
      expect(axios.post).toHaveBeenCalledTimes(7);
    });

    test('handles empty chunks array', async () => {
      const results = await reviewAllChunks([], jest.fn());
      expect(results).toEqual([]);
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('handles mixed valid and skipped chunks', async () => {
      const chunks = [
        makeChunk({ filename: 'src/__tests__/skip.js' }),
        makeChunk({ filename: 'src/real.js', fullCode: 'function ok() {\n  const x = 1;\n  return x;\n}' }),
      ];

      mockGroqResponse([]);

      const results = await reviewAllChunks(chunks, jest.fn());
      expect(axios.post).toHaveBeenCalledTimes(1);
    });
  });
});
