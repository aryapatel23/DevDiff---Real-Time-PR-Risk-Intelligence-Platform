function escapeCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(rows, columns) {
  const header = columns.map(c => escapeCsvCell(c.header)).join(',');
  const body = rows
    .map(row => columns.map(c => escapeCsvCell(row[c.key])).join(','))
    .join('\n');
  return body ? `${header}\n${body}\n` : `${header}\n`;
}

function countBySeverity(findings) {
  const counts = { critical: 0, warning: 0, info: 0 };
  for (const f of findings) {
    const sev = String(f.severity || '').toLowerCase();
    if (sev === 'critical' || sev === 'warning' || sev === 'info') counts[sev] += 1;
  }
  return counts;
}

function buildReportSummary(pr, findings) {
  const counts = countBySeverity(findings);
  const avgConfidence = findings.length
    ? Number((findings.reduce((sum, f) => sum + Number(f.confidence || 0), 0) / findings.length).toFixed(1))
    : 0;

  return {
    pr,
    totals: {
      findings: findings.length,
      critical: counts.critical,
      warning: counts.warning,
      info: counts.info,
      avgConfidence,
    },
  };
}

function buildEmailSummary(pr, findings) {
  const summary = buildReportSummary(pr, findings);
  const { totals } = summary;
  const subject = `[DevDiff] PR #${pr.pr_number} Risk ${pr.risk_score} (${pr.repo})`;

  const topFindings = findings
    .slice()
    .sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0))
    .slice(0, 5)
    .map(f => `- [${f.severity}] ${f.rule_name} at ${f.filename}:${f.line_number} (conf ${f.confidence})`)
    .join('\n');

  const body = [
    `PR URL: ${pr.pr_url}`,
    `Author: ${pr.author}`,
    `Analyzed At: ${pr.analyzed_at}`,
    `Risk Score: ${pr.risk_score}`,
    ``,
    `Totals: critical=${totals.critical}, warning=${totals.warning}, info=${totals.info}, total=${totals.findings}`,
    `Average Confidence: ${totals.avgConfidence}`,
    ``,
    `Top Findings:`,
    topFindings || '- None',
  ].join('\n');

  return { subject, body };
}

function findingsToCsv(findings) {
  const columns = [
    { key: 'id', header: 'id' },
    { key: 'pr_id', header: 'pr_id' },
    { key: 'filename', header: 'filename' },
    { key: 'line_number', header: 'line_number' },
    { key: 'rule_name', header: 'rule_name' },
    { key: 'severity', header: 'severity' },
    { key: 'confidence', header: 'confidence' },
    { key: 'message', header: 'message' },
    { key: 'fix_hint', header: 'fix_hint' },
    { key: 'author', header: 'author' },
    { key: 'created_at', header: 'created_at' },
  ];
  return toCsv(findings, columns);
}

module.exports = {
  buildReportSummary,
  buildEmailSummary,
  findingsToCsv,
};
