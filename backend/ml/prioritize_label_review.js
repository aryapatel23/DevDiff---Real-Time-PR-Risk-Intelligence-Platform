const fs = require('fs');
const path = require('path');

const INPUT_PATH = process.env.LABEL_INPUT_PATH || path.join(__dirname, '..', 'data', 'labeling_bootstrap.csv');
const OUTPUT_PATH = process.env.LABEL_PRIORITY_PATH || path.join(__dirname, '..', 'data', 'labeling_priority_review.csv');
const TOP_N = Math.max(1, Number(process.env.LABEL_REVIEW_TOP_N || 300));

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let i = 0;
  let inQ = false;
  while (i < line.length) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQ = false;
        i += 1;
        continue;
      }
      cur += ch;
      i += 1;
      continue;
    }
    if (ch === ',') {
      out.push(cur);
      cur = '';
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQ = true;
      i += 1;
      continue;
    }
    cur += ch;
    i += 1;
  }
  out.push(cur);
  return out;
}

function toCsvCell(v) {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function readCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const row = {};
    for (let j = 0; j < header.length; j += 1) row[header[j]] = cols[j] ?? '';
    rows.push(row);
  }
  return rows;
}

function writeCsv(filePath, rows) {
  if (!rows.length) {
    fs.writeFileSync(filePath, '', 'utf8');
    return;
  }
  const header = Object.keys(rows[0]);
  const out = [header.map(toCsvCell).join(',')];
  for (const row of rows) {
    out.push(header.map(h => toCsvCell(row[h])).join(','));
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${out.join('\n')}\n`, 'utf8');
}

function isCommentLike(line) {
  const t = String(line || '').trim();
  return /^(\/\/|\/\*|\*|\*\/|"|'|`|<|\[|\{|#)/.test(t);
}

function isCodeLike(line) {
  const t = String(line || '').trim();
  return /(const|let|var|function|=>|\(|\)|\.|=|;|await|return|new\s+)/.test(t);
}

function priorityScore(row) {
  const rule = String(row.rule_name || '').toLowerCase();
  const sev = String(row.severity || '').toLowerCase();
  const label = String(row.label || '').trim();
  const line = String(row.line_content || '');

  let score = 0;
  const reasons = [];

  if (sev === 'critical') {
    score += 20;
    reasons.push('critical severity');
  }

  if (/(sql-injection|xss|secret|path-traversal|prototype|re-dos|weak-hash|insecure-random|eval)/.test(rule)) {
    score += 45;
    reasons.push('high-impact security rule');
  }

  if (rule === 'syntax-error') {
    score += 10;
    reasons.push('syntax rule noisy area');
    if (isCommentLike(line) && label === '1') {
      score += 35;
      reasons.push('likely false positive (comment-like but labeled 1)');
    }
    if (isCodeLike(line) && label === '0') {
      score += 35;
      reasons.push('likely missed true positive (code-like but labeled 0)');
    }
  }

  if (rule === 'console-log' && label === '1') {
    score += 25;
    reasons.push('console-log labeled 1 needs verification');
  }

  if (label !== '0' && label !== '1') {
    score += 30;
    reasons.push('missing/invalid label');
  }

  if (String(row.filename || '').includes('__tests__')) {
    score += 8;
    reasons.push('test file edge case');
  }

  return { score, reason: reasons.join('; ') };
}

function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error(`Input file not found: ${INPUT_PATH}`);
  }

  const rows = readCsv(INPUT_PATH);
  const ranked = rows.map(r => {
    const p = priorityScore(r);
    return {
      ...r,
      review_priority: String(p.score),
      review_reason: p.reason || 'general review',
    };
  });

  ranked.sort((a, b) => Number(b.review_priority) - Number(a.review_priority));

  const top = ranked.slice(0, Math.min(TOP_N, ranked.length));
  writeCsv(OUTPUT_PATH, top);

  const pos = top.filter(r => String(r.label) === '1').length;
  const neg = top.filter(r => String(r.label) === '0').length;

  console.log(`[label-priority] Input: ${INPUT_PATH}`);
  console.log(`[label-priority] Output: ${OUTPUT_PATH}`);
  console.log(`[label-priority] Rows selected: ${top.length}`);
  console.log(`[label-priority] Distribution in review set: pos=${pos} neg=${neg}`);
  console.log('[label-priority] Next: manually correct these top-priority rows, then retrain with LABEL_CSV_PATH pointing to corrected file.');
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`[label-priority] Fatal error: ${err.message}`);
    process.exit(1);
  }
}
