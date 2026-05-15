const { spawn } = require('child_process');
const path = require('path');

let scorerProcess = null;
const pending = new Map();
let counter = 0;
let scorerUnavailable = false;
let timeoutFailures = 0;
const MAX_TIMEOUT_FAILURES = 3;
const REQUEST_TIMEOUT_MS = Number(process.env.ML_BRIDGE_TIMEOUT_MS || 8000);

function getPythonCandidates() {
  if (process.platform === 'win32') {
    return [
      { cmd: 'py', args: ['-3.12'] },
      { cmd: 'py', args: ['-3'] },
      { cmd: 'python', args: [] },
      { cmd: 'python3', args: [] },
    ];
  }
  return [
    { cmd: 'python3', args: [] },
    { cmd: 'python', args: [] },
  ];
}

function getProcess() {
  if (scorerUnavailable) return null;
  if (scorerProcess && !scorerProcess.killed) return scorerProcess;

  const scorerPath = path.join(__dirname, 'scorer.py');
  let spawned = null;
  for (const candidate of getPythonCandidates()) {
    try {
      const proc = spawn(candidate.cmd, [...candidate.args, scorerPath], { stdio: ['pipe', 'pipe', 'pipe'] });
      proc.once('error', () => {});
      spawned = proc;
      break;
    } catch {
      // try next candidate
    }
  }

  if (!spawned) {
    scorerUnavailable = true;
    scorerProcess = null;
    return null;
  }

  scorerProcess = spawned;

  scorerProcess.stdout.on('data', data => {
    for (const line of data.toString().split('\n').filter(Boolean)) {
      try {
        const result = JSON.parse(line);
        timeoutFailures = 0;
        if (pending.has(result._id)) {
          pending.get(result._id)(null, result);
          pending.delete(result._id);
        }
      } catch {
        // ignore parser errors
      }
    }
  });

  scorerProcess.stderr.on('data', d => process.stderr.write(d));
  scorerProcess.on('close', () => {
    scorerProcess = null;
    scorerUnavailable = true;
    for (const [id, done] of pending) {
      done(new Error('scorer-exited'));
      pending.delete(id);
    }
  });

  return scorerProcess;
}

function scoreFeatures(features) {
  return new Promise(resolve => {
    if (scorerUnavailable) {
      return resolve({ score: 50.0, severity: 'warning' });
    }

    const id = ++counter;
    const proc = getProcess();
    if (!proc) {
      return resolve({ score: 50.0, severity: 'warning' });
    }

    pending.set(id, (_err, result) => {
      resolve({ score: result?.score ?? 50.0, severity: result?.severity ?? 'warning' });
    });

    try {
      proc.stdin.write(JSON.stringify({ features, _id: id }) + '\n');
    } catch {
      if (pending.has(id)) pending.delete(id);
      scorerUnavailable = true;
      return resolve({ score: 50.0, severity: 'warning' });
    }

    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        timeoutFailures += 1;
        if (timeoutFailures >= MAX_TIMEOUT_FAILURES) {
          scorerUnavailable = true;
        }
        resolve({ score: 50.0, severity: 'warning' });
      }
    }, REQUEST_TIMEOUT_MS);
  });
}

module.exports = { scoreFeatures };
