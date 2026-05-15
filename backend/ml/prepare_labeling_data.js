const fs = require('fs');
const path = require('path');
const { parseDiff } = require('../parser/diffParser');
const { runRules } = require('../rules');
const { extractFeatures } = require('../ast/treesitter');

const DATASET_PATH = process.env.PR_DATASET_PATH || path.join(__dirname, '..', 'data', 'pr_dataset.json');
const OUTPUT_CSV_PATH = process.env.LABEL_CSV_PATH || path.join(__dirname, '..', 'data', 'labeling_candidates.csv');
const MAX_ROWS = Math.max(1, Number(process.env.LABEL_MAX_ROWS || 3000));

function escapeCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(rows, columns) {
  const header = columns.map(c => escapeCsvCell(c)).join(',');
  const body = rows.map(r => columns.map(c => escapeCsvCell(r[c])).join(',')).join('\n');
  return body ? `${header}\n${body}\n` : `${header}\n`;
}

function loadDataset(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Dataset not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.items)) {
    throw new Error('Invalid dataset format. Expected root.items array.');
  }
  return parsed;
}

function sanitizeLineContent(content) {
  return String(content || '').replace(/\s+/g, ' ').trim().slice(0, 280);
}

function buildRows(datasetItems) {
  const rows = [];
  let rowId = 1;

  for (const pr of datasetItems) {
    const files = Array.isArray(pr.files) ? pr.files : [];

    for (const file of files) {
      if (!file || !file.patch || typeof file.patch !== 'string') continue;

      const lines = parseDiff(file.patch);
      for (const line of lines) {
        if (!line || !line.isAdded) continue;

        const ruleHits = runRules(line, file.filename, []);
        if (!Array.isArray(ruleHits) || ruleHits.length === 0) continue;

        for (const hit of ruleHits) {
          const ast = extractFeatures(line.content, file.filename);
          const featureVec = [
            ast.astDepth,
            ast.isInLoop ? 1 : 0,
            ast.isAsyncContext ? 1 : 0,
            ast.variableFromUser ? 1 : 0,
            ast.hasTemplateVar ? 1 : 0,
            ast.lineComplexity,
            ast.isCriticalFile ? 1 : 0,
            0,
            hit.weight || 1.0,
          ];

          rows.push({
            row_id: rowId,
            pr_id: pr.pr_id,
            pr_number: pr.pr_number,
            pr_title: pr.title || '',
            filename: file.filename,
            line_number: line.lineNo,
            rule_name: hit.rule_name,
            severity: hit.severity,
            message: hit.message,
            fix_hint: hit.fix_hint,
            line_content: sanitizeLineContent(line.content),
            feature_0: featureVec[0],
            feature_1: featureVec[1],
            feature_2: featureVec[2],
            feature_3: featureVec[3],
            feature_4: featureVec[4],
            feature_5: featureVec[5],
            feature_6: featureVec[6],
            feature_7: featureVec[7],
            feature_8: featureVec[8],
            label: '',
            notes: '',
          });

          rowId += 1;
          if (rows.length >= MAX_ROWS) return rows;
        }
      }
    }
  }

  return rows;
}

function ensureOutputDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function main() {
  const dataset = loadDataset(DATASET_PATH);
  const rows = buildRows(dataset.items);

  const columns = [
    'row_id', 'pr_id', 'pr_number', 'pr_title', 'filename', 'line_number',
    'rule_name', 'severity', 'message', 'fix_hint', 'line_content',
    'feature_0', 'feature_1', 'feature_2', 'feature_3', 'feature_4',
    'feature_5', 'feature_6', 'feature_7', 'feature_8',
    'label', 'notes'
  ];

  const csv = toCsv(rows, columns);
  ensureOutputDir(OUTPUT_CSV_PATH);
  fs.writeFileSync(OUTPUT_CSV_PATH, csv, 'utf8');

  console.log(`[label-prep] Dataset source: ${DATASET_PATH}`);
  console.log(`[label-prep] Candidate rows written: ${rows.length}`);
  console.log(`[label-prep] Output CSV: ${OUTPUT_CSV_PATH}`);
  console.log('[label-prep] Next: fill label column with 1 (real risk) or 0 (false positive).');
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`[label-prep] Fatal error: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { buildRows };
