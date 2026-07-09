/**
 * Tests for reports/exporter.js
 */

const { buildReportSummary, buildEmailSummary, findingsToCsv } = require('../reports/exporter');

describe('exporter', () => {
  // ── findingsToCsv (exercises escapeCsvCell internally) ──────────────

  describe('findingsToCsv', () => {
    test('generates valid CSV with header and data rows', () => {
      const findings = [
        {
          id: 1,
          pr_id: 10,
          filename: 'src/app.js',
          line_number: 42,
          rule_name: 'no-unused-vars',
          severity: 'warning',
          confidence: 85,
          message: 'Unused variable x',
          fix_hint: 'Remove x',
          author: 'dev1',
          created_at: '2025-01-01',
        },
      ];
      const csv = findingsToCsv(findings);
      const lines = csv.trim().split('\n');
      expect(lines[0]).toBe('id,pr_id,filename,line_number,rule_name,severity,confidence,message,fix_hint,author,created_at');
      expect(lines[1]).toContain('1,10,src/app.js,42,no-unused-vars,warning,85,Unused variable x,Remove x,dev1,2025-01-01');
    });

    test('handles empty findings array', () => {
      const csv = findingsToCsv([]);
      const lines = csv.trim().split('\n');
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('id,pr_id');
    });

    test('escapes commas inside cell values', () => {
      const findings = [
        {
          id: 1, pr_id: 1, filename: 'a.js', line_number: 1, rule_name: 'r',
          severity: 'info', confidence: 50, message: 'foo,bar,baz', fix_hint: '',
          author: 'dev', created_at: '',
        },
      ];
      const csv = findingsToCsv(findings);
      expect(csv).toContain('"foo,bar,baz"');
    });

    test('escapes double quotes inside cell values', () => {
      const findings = [
        {
          id: 1, pr_id: 1, filename: 'a.js', line_number: 1, rule_name: 'r',
          severity: 'info', confidence: 50, message: 'say "hello"', fix_hint: '',
          author: 'dev', created_at: '',
        },
      ];
      const csv = findingsToCsv(findings);
      expect(csv).toContain('"say ""hello"""');
    });

    test('escapes newlines inside cell values', () => {
      const findings = [
        {
          id: 1, pr_id: 1, filename: 'a.js', line_number: 1, rule_name: 'r',
          severity: 'info', confidence: 50, message: 'line1\nline2', fix_hint: '',
          author: 'dev', created_at: '',
        },
      ];
      const csv = findingsToCsv(findings);
      expect(csv).toContain('"line1\nline2"');
    });

    test('handles null/undefined cell values as empty strings', () => {
      const findings = [
        {
          id: 1, pr_id: 1, filename: 'a.js', line_number: 1, rule_name: 'r',
          severity: 'info', confidence: 50, message: null, fix_hint: undefined,
          author: 'dev', created_at: '',
        },
      ];
      const csv = findingsToCsv(findings);
      const lines = csv.trim().split('\n');
      expect(lines[1]).toContain(',,');
    });

    test('handles multiple findings with different severities', () => {
      const findings = [
        { id: 1, pr_id: 1, filename: 'a.js', line_number: 1, rule_name: 'r1', severity: 'critical', confidence: 90, message: 'm1', fix_hint: '', author: 'd', created_at: '' },
        { id: 2, pr_id: 1, filename: 'b.js', line_number: 2, rule_name: 'r2', severity: 'warning', confidence: 70, message: 'm2', fix_hint: '', author: 'd', created_at: '' },
        { id: 3, pr_id: 1, filename: 'c.js', line_number: 3, rule_name: 'r3', severity: 'info', confidence: 50, message: 'm3', fix_hint: '', author: 'd', created_at: '' },
      ];
      const csv = findingsToCsv(findings);
      const lines = csv.trim().split('\n');
      expect(lines).toHaveLength(4);
      expect(lines[1]).toContain('critical');
      expect(lines[2]).toContain('warning');
      expect(lines[3]).toContain('info');
    });
  });

  // ── buildReportSummary ──────────────────────────────────────────────

  describe('buildReportSummary', () => {
    const pr = {
      pr_number: 42,
      repo: 'owner/repo',
      risk_score: 'HIGH',
      pr_url: 'https://github.com/owner/repo/pull/42',
      author: 'dev1',
      analyzed_at: '2025-06-01T00:00:00Z',
    };

    test('returns structured summary object', () => {
      const findings = [
        { severity: 'critical', confidence: 90 },
        { severity: 'warning', confidence: 70 },
        { severity: 'info', confidence: 50 },
      ];
      const result = buildReportSummary(pr, findings);
      expect(result).toHaveProperty('pr', pr);
      expect(result).toHaveProperty('totals');
      expect(result.totals).toEqual({
        findings: 3,
        critical: 1,
        warning: 1,
        info: 1,
        avgConfidence: 70,
      });
    });

    test('returns zero counts for empty findings', () => {
      const result = buildReportSummary(pr, []);
      expect(result.totals).toEqual({
        findings: 0,
        critical: 0,
        warning: 0,
        info: 0,
        avgConfidence: 0,
      });
    });

    test('counts severities correctly', () => {
      const findings = [
        { severity: 'critical', confidence: 100 },
        { severity: 'critical', confidence: 95 },
        { severity: 'critical', confidence: 90 },
        { severity: 'warning', confidence: 80 },
        { severity: 'warning', confidence: 75 },
        { severity: 'info', confidence: 60 },
        { severity: 'info', confidence: 55 },
        { severity: 'info', confidence: 50 },
        { severity: 'info', confidence: 45 },
      ];
      const result = buildReportSummary(pr, findings);
      expect(result.totals.critical).toBe(3);
      expect(result.totals.warning).toBe(2);
      expect(result.totals.info).toBe(4);
    });

    test('computes average confidence rounded to one decimal', () => {
      const findings = [
        { severity: 'info', confidence: 80 },
        { severity: 'info', confidence: 90 },
      ];
      const result = buildReportSummary(pr, findings);
      expect(result.totals.avgConfidence).toBe(85);
    });

    test('handles missing severity values gracefully', () => {
      const findings = [
        { severity: 'unknown', confidence: 50 },
        { severity: '', confidence: 60 },
        { severity: null, confidence: 70 },
      ];
      const result = buildReportSummary(pr, findings);
      expect(result.totals.critical).toBe(0);
      expect(result.totals.warning).toBe(0);
      expect(result.totals.info).toBe(0);
      expect(result.totals.findings).toBe(3);
    });

    test('handles missing confidence values', () => {
      const findings = [
        { severity: 'critical' },
        { severity: 'warning', confidence: undefined },
      ];
      const result = buildReportSummary(pr, findings);
      expect(result.totals.avgConfidence).toBe(0);
    });
  });

  // ── buildEmailSummary ───────────────────────────────────────────────

  describe('buildEmailSummary', () => {
    const pr = {
      pr_number: 7,
      repo: 'acme/web',
      risk_score: 'HIGH',
      pr_url: 'https://github.com/acme/web/pull/7',
      author: 'alice',
      analyzed_at: '2025-06-01T12:00:00Z',
    };

    test('generates subject line with PR info', () => {
      const result = buildEmailSummary(pr, []);
      expect(result.subject).toBe('[DevDiff] PR #7 Risk HIGH (acme/web)');
    });

    test('generates body with severity counts', () => {
      const findings = [
        { severity: 'critical', confidence: 90, rule_name: 'r1', filename: 'a.js', line_number: 10 },
        { severity: 'warning', confidence: 70, rule_name: 'r2', filename: 'b.js', line_number: 20 },
        { severity: 'info', confidence: 50, rule_name: 'r3', filename: 'c.js', line_number: 30 },
      ];
      const result = buildEmailSummary(pr, findings);
      expect(result.body).toContain('critical=1');
      expect(result.body).toContain('warning=1');
      expect(result.body).toContain('info=1');
      expect(result.body).toContain('total=3');
    });

    test('includes top 5 findings sorted by confidence', () => {
      const findings = [
        { severity: 'info', confidence: 30, rule_name: 'low', filename: 'a.js', line_number: 1 },
        { severity: 'critical', confidence: 95, rule_name: 'high', filename: 'b.js', line_number: 2 },
        { severity: 'warning', confidence: 80, rule_name: 'med', filename: 'c.js', line_number: 3 },
        { severity: 'critical', confidence: 90, rule_name: 'high2', filename: 'd.js', line_number: 4 },
        { severity: 'info', confidence: 60, rule_name: 'low2', filename: 'e.js', line_number: 5 },
        { severity: 'warning', confidence: 70, rule_name: 'med2', filename: 'f.js', line_number: 6 },
        { severity: 'info', confidence: 40, rule_name: 'low3', filename: 'g.js', line_number: 7 },
      ];
      const result = buildEmailSummary(pr, findings);
      expect(result.body).toContain('[critical] high at b.js:2');
      expect(result.body).toContain('[critical] high2 at d.js:4');
      expect(result.body).toContain('[warning] med at c.js:3');
      expect(result.body).toContain('[warning] med2 at f.js:6');
      expect(result.body).toContain('[info] low2 at e.js:5');
      expect(result.body).not.toContain('low3');
      expect(result.body).not.toContain('[info] low at a.js:1');
    });

    test('shows "- None" when no findings', () => {
      const result = buildEmailSummary(pr, []);
      expect(result.body).toContain('- None');
      expect(result.body).toContain('Top Findings:');
    });

    test('includes PR URL, author, and analyzed_at in body', () => {
      const result = buildEmailSummary(pr, []);
      expect(result.body).toContain(`PR URL: ${pr.pr_url}`);
      expect(result.body).toContain(`Author: ${pr.author}`);
      expect(result.body).toContain(`Analyzed At: ${pr.analyzed_at}`);
      expect(result.body).toContain(`Risk Score: ${pr.risk_score}`);
    });

    test('computes average confidence in body', () => {
      const findings = [
        { severity: 'warning', confidence: 80, rule_name: 'r1', filename: 'a.js', line_number: 1 },
        { severity: 'warning', confidence: 60, rule_name: 'r2', filename: 'b.js', line_number: 2 },
      ];
      const result = buildEmailSummary(pr, findings);
      expect(result.body).toContain('Average Confidence: 70');
    });
  });
});
