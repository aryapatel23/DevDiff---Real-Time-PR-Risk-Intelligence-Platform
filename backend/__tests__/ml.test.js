/**
 * Tests for ml/mlBridge.js
 *
 * The ML bridge spawns a Python process and communicates via JSON lines on
 * stdin/stdout. We mock child_process.spawn so the tests never touch the
 * real filesystem or Python.
 */

describe('mlBridge', () => {
  let spawnMock;

  beforeEach(() => {
    jest.resetModules();
    spawnMock = jest.fn();
    jest.doMock('child_process', () => ({ spawn: spawnMock }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Helper – builds a fake ChildProcess-like object with a capturable data handler */
  function fakeProc() {
    let dataHandler = null;
    return {
      stdin: { write: jest.fn() },
      stdout: {
        on: jest.fn((event, cb) => {
          if (event === 'data') dataHandler = cb;
        }),
      },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      once: jest.fn(),
      killed: false,
      /** Fire the captured stdout data callback with a buffer */
      _emitData(buf) {
        if (dataHandler) dataHandler(buf);
      },
    };
  }

  // ── 1. Spawns Python process correctly ──────────────────────────────
  describe('process spawning', () => {
    test('spawns a Python process and returns parsed result', async () => {
      const proc = fakeProc();
      spawnMock.mockReturnValue(proc);

      const { scoreFeatures } = require('../ml/mlBridge');
      const promise = scoreFeatures([1, 0, 1, 0, 0, 1, 3, 2, 0, 0, 0, 1.0, 5, 0, 0]);

      // Now emit the response (pending entry is already registered)
      proc._emitData(Buffer.from(JSON.stringify({ score: 85.2, severity: 'warning', _id: 1 }) + '\n'));

      const score = await promise;
      expect(score.score).toBe(85.2);
      expect(spawnMock).toHaveBeenCalledTimes(1);
    });
  });

  // ── 2. Sends features and receives score ────────────────────────────
  describe('score exchange', () => {
    test('sends JSON with features and _id, receives parsed result', async () => {
      const proc = fakeProc();
      spawnMock.mockReturnValue(proc);

      const { scoreFeatures } = require('../ml/mlBridge');
      const features = [1, 0, 0, 0, 1, 2, 5, 3, 1, 0, 0, 2.0, 10, 0, 0];
      const promise = scoreFeatures(features);

      proc._emitData(Buffer.from(JSON.stringify({ score: 92.0, severity: 'critical', _id: 1 }) + '\n'));
      const result = await promise;

      expect(proc.stdin.write).toHaveBeenCalledTimes(1);
      const sent = JSON.parse(proc.stdin.write.mock.calls[0][0]);
      expect(sent.features).toEqual(features);
      expect(sent._id).toBe(1);
      expect(result.score).toBe(92.0);
      expect(result.severity).toBe('critical');
    });

    test('returns default score 50 when result is missing score field', async () => {
      const proc = fakeProc();
      spawnMock.mockReturnValue(proc);

      const { scoreFeatures } = require('../ml/mlBridge');
      const promise = scoreFeatures([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

      proc._emitData(Buffer.from(JSON.stringify({ _id: 1 }) + '\n'));
      const result = await promise;

      expect(result.score).toBe(50.0);
      expect(result.severity).toBe('warning');
    });
  });

  // ── 3. Handles timeout (returns score 50 after 8s) ──────────────────
  describe('timeout handling', () => {
    test('returns score 50 when Python does not respond in time', async () => {
      jest.useFakeTimers();

      const proc = fakeProc();
      spawnMock.mockReturnValue(proc);

      const { scoreFeatures } = require('../ml/mlBridge');
      const promise = scoreFeatures([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]);

      jest.advanceTimersByTime(8001);

      const result = await promise;
      expect(result.score).toBe(50.0);
      expect(result.severity).toBe('warning');

      jest.useRealTimers();
    });
  });

  // ── 4. Handles Python crash (returns score 50) ─────────────────────
  describe('Python crash handling', () => {
    test('returns score 50 when process exits before responding', async () => {
      const proc = fakeProc();
      spawnMock.mockReturnValue(proc);

      let closeHandler;
      proc.on.mockImplementation((event, cb) => {
        if (event === 'close') closeHandler = cb;
      });

      const { scoreFeatures } = require('../ml/mlBridge');
      const promise = scoreFeatures([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]);

      // Simulate process close before any response
      if (closeHandler) closeHandler();

      const result = await promise;
      expect(result.score).toBe(50.0);
    });

    test('returns default score after process close (scorer unavailable)', async () => {
      const proc = fakeProc();
      spawnMock.mockReturnValue(proc);

      let closeHandler;
      proc.on.mockImplementation((event, cb) => {
        if (event === 'close') closeHandler = cb;
      });

      const { scoreFeatures } = require('../ml/mlBridge');
      const p1 = scoreFeatures([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

      // Emit data to resolve first call, then close
      proc._emitData(Buffer.from(JSON.stringify({ score: 60, severity: 'warning', _id: 1 }) + '\n'));
      await p1;

      if (closeHandler) closeHandler();

      const result = await scoreFeatures([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      expect(result.score).toBe(50.0);
    });
  });

  // ── 5. Circuit breaker activates after 3 timeouts ──────────────────
  describe('circuit breaker', () => {
    test('marks scorer unavailable after 3 consecutive timeouts', async () => {
      jest.useFakeTimers();

      const proc = fakeProc();
      spawnMock.mockReturnValue(proc);

      const { scoreFeatures } = require('../ml/mlBridge');

      for (let i = 0; i < 3; i++) {
        const p = scoreFeatures([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        jest.advanceTimersByTime(8001);
        await p;
      }

      // After 3 timeouts, no new spawn should happen
      const spawnCountAfterCircuit = spawnMock.mock.calls.length;
      const result = await scoreFeatures([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      expect(result.score).toBe(50.0);
      expect(spawnMock.mock.calls.length).toBe(spawnCountAfterCircuit);

      jest.useRealTimers();
    });
  });

  // ── 6. Auto-detects Python executable ───────────────────────────────
  describe('Python detection', () => {
    test('spawns with python3 on non-Windows platforms', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

      jest.resetModules();
      const sp = jest.fn();
      jest.doMock('child_process', () => ({ spawn: sp }));
      const proc = fakeProc();
      sp.mockReturnValue(proc);

      const { scoreFeatures } = require('../ml/mlBridge');
      const promise = scoreFeatures([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

      // Emit data so the promise resolves quickly
      proc._emitData(Buffer.from(JSON.stringify({ score: 50, severity: 'info', _id: 1 }) + '\n'));
      await promise;

      expect(sp.mock.calls[0][0]).toBe('python3');

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });

    test('spawns with py on Windows', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

      jest.resetModules();
      const sp = jest.fn();
      jest.doMock('child_process', () => ({ spawn: sp }));
      const proc = fakeProc();
      sp.mockReturnValue(proc);

      const { scoreFeatures } = require('../ml/mlBridge');
      const promise = scoreFeatures([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

      proc._emitData(Buffer.from(JSON.stringify({ score: 50, severity: 'info', _id: 1 }) + '\n'));
      await promise;

      expect(sp.mock.calls[0][0]).toBe('py');
      expect(sp.mock.calls[0][1]).toContain('-3.12');

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });
  });

  // ── 7. Request/response matching via _id counter ───────────────────
  describe('request/response matching', () => {
    test('increments _id for each request', async () => {
      const proc = fakeProc();
      spawnMock.mockReturnValue(proc);

      const { scoreFeatures } = require('../ml/mlBridge');

      // Send first request
      const p1 = scoreFeatures([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]);
      const msg1 = JSON.parse(proc.stdin.write.mock.calls[0][0]);
      expect(msg1._id).toBe(1);

      // Respond
      proc._emitData(Buffer.from(JSON.stringify({ score: 70, severity: 'warning', _id: 1 }) + '\n'));
      await p1;

      // Send second request
      const p2 = scoreFeatures([0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]);
      const msg2 = JSON.parse(proc.stdin.write.mock.calls[1][0]);
      expect(msg2._id).toBe(2);

      proc._emitData(Buffer.from(JSON.stringify({ score: 80, severity: 'critical', _id: 2 }) + '\n'));
      await p2;
    });

    test('matches response to correct pending request', async () => {
      const proc = fakeProc();
      spawnMock.mockReturnValue(proc);

      const { scoreFeatures } = require('../ml/mlBridge');

      // Send two requests
      const p1 = scoreFeatures([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]);
      const p2 = scoreFeatures([0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]);

      // Respond out of order — _id 2 first, then _id 1
      proc._emitData(Buffer.from(JSON.stringify({ score: 80, severity: 'critical', _id: 2 }) + '\n'));
      proc._emitData(Buffer.from(JSON.stringify({ score: 60, severity: 'warning', _id: 1 }) + '\n'));

      const r1 = await p1;
      const r2 = await p2;
      expect(r1.score).toBe(60);
      expect(r2.score).toBe(80);
    });
  });
});
