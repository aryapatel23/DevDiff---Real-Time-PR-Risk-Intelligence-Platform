jest.mock('../db/db', () => {
  const mockQuery = jest.fn();
  return {
    __esModule: true,
    default: { query: mockQuery },
    query: mockQuery,
  };
});

// After jest.mock, require the pool (which is the mock)
const pool = require('../db/db');
const queries = require('../db/queries');

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── createProject ──────────────────────────────────────────────────────────

describe('createProject', () => {
  it('should insert a project and return the row', async () => {
    const mockRow = { id: 1, owner_id: 'u1', name: 'test-project' };
    pool.query.mockResolvedValueOnce({ rows: [mockRow] });

    const result = await queries.createProject({
      owner_id: 'u1',
      name: 'test-project',
      github_repo: 'https://github.com/u1/test',
      description: 'A test project',
      is_private: true,
    });

    expect(result).toEqual(mockRow);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO public.projects');
    expect(params).toEqual([
      'u1',
      'test-project',
      'https://github.com/u1/test',
      'A test project',
      true,
      null,
      null,
    ]);
  });

  it('should use COALESCE defaults for import_status and import_count', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 2 }] });

    await queries.createProject({
      owner_id: 'u1',
      name: 'proj',
      github_repo: 'repo',
    });

    const [, params] = pool.query.mock.calls[0];
    // import_status defaults to 'pending' via COALESCE, import_count defaults to 0
    expect(params[5]).toBeNull();
    expect(params[6]).toBeNull();
  });

  it('should pass explicit import_status and import_count when provided', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 3 }] });

    await queries.createProject({
      owner_id: 'u1',
      name: 'proj',
      github_repo: 'repo',
      import_status: 'done',
      import_count: 42,
    });

    const [, params] = pool.query.mock.calls[0];
    expect(params[5]).toBe('done');
    expect(params[6]).toBe(42);
  });

  it('should default is_private to false when not provided', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 4 }] });

    await queries.createProject({
      owner_id: 'u1',
      name: 'proj',
      github_repo: 'repo',
    });

    const [, params] = pool.query.mock.calls[0];
    expect(params[4]).toBe(false);
  });
});

// ─── getProjectsByOwner ─────────────────────────────────────────────────────

describe('getProjectsByOwner', () => {
  it('should return projects with counts', async () => {
    const mockRows = [
      { id: 1, name: 'p1', pr_count: '5', finding_count: '12' },
      { id: 2, name: 'p2', pr_count: '0', finding_count: '0' },
    ];
    pool.query.mockResolvedValueOnce({ rows: mockRows });

    const result = await queries.getProjectsByOwner('u1');

    expect(result).toEqual(mockRows);
    expect(result).toHaveLength(2);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('SELECT p.*');
    expect(sql).toContain('WHERE p.owner_id=$1');
    expect(params).toEqual(['u1']);
  });

  it('should return empty array when owner has no projects', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await queries.getProjectsByOwner('u999');

    expect(result).toEqual([]);
  });
});

// ─── getProjectById ─────────────────────────────────────────────────────────

describe('getProjectById', () => {
  it('should return a project when found', async () => {
    const mockRow = { id: 1, owner_id: 'u1', name: 'proj' };
    pool.query.mockResolvedValueOnce({ rows: [mockRow] });

    const result = await queries.getProjectById(1, 'u1');

    expect(result).toEqual(mockRow);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('WHERE id=$1 AND owner_id=$2');
    expect(params).toEqual([1, 'u1']);
  });

  it('should return null when project not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await queries.getProjectById(999, 'u1');

    expect(result).toBeNull();
  });

  it('should return null when rows is empty array', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await queries.getProjectById(1, 'wrong-owner');

    expect(result).toBeNull();
  });
});

// ─── deleteProject ──────────────────────────────────────────────────────────

describe('deleteProject', () => {
  it('should return true when project is deleted', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

    const result = await queries.deleteProject(1, 'u1');

    expect(result).toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('DELETE FROM public.projects');
    expect(sql).toContain('RETURNING id');
    expect(params).toEqual([1, 'u1']);
  });

  it('should return false when no project is deleted', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await queries.deleteProject(999, 'u1');

    expect(result).toBe(false);
  });

  it('should return false when owner_id does not match', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await queries.deleteProject(1, 'wrong-owner');

    expect(result).toBe(false);
  });
});

// ─── insertPR ───────────────────────────────────────────────────────────────

describe('insertPR', () => {
  it('should insert a PR and return the id', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 10 }] });

    const result = await queries.insertPR({
      project_id: 1,
      pr_url: 'https://github.com/u1/repo/pull/1',
      repo: 'u1/repo',
      pr_number: 1,
      pr_title: 'Add feature',
      author: 'dev1',
      files_count: 5,
    });

    expect(result).toBe(10);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO public.pull_requests');
    expect(sql).toContain('RETURNING id');
    expect(params).toEqual([
      1,
      'https://github.com/u1/repo/pull/1',
      'u1/repo',
      1,
      'Add feature',
      'dev1',
      null,
      5,
      null,
      false,
    ]);
  });

  it('should default status to "processing" via COALESCE', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 11 }] });

    await queries.insertPR({
      project_id: 1,
      pr_url: 'url',
      repo: 'r',
      pr_number: 2,
      author: 'dev1',
      files_count: 1,
    });

    const [, params] = pool.query.mock.calls[0];
    expect(params[8]).toBeNull(); // status param, COALESCE makes it 'processing'
  });

  it('should update risk_score when provided', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 12 }] });
    pool.query.mockResolvedValueOnce({});

    const result = await queries.insertPR({
      project_id: 1,
      pr_url: 'url',
      repo: 'r',
      pr_number: 3,
      author: 'dev1',
      files_count: 2,
      risk_score: 75,
    });

    expect(result).toBe(12);
    expect(pool.query).toHaveBeenCalledTimes(2);
    const [updateSql, updateParams] = pool.query.mock.calls[1];
    expect(updateSql).toContain('UPDATE public.pull_requests SET risk_score');
    expect(updateParams).toEqual([75, 12]);
  });

  it('should NOT update risk_score when undefined', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 13 }] });

    await queries.insertPR({
      project_id: 1,
      pr_url: 'url',
      repo: 'r',
      pr_number: 4,
      author: 'dev1',
      files_count: 1,
      risk_score: undefined,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('should NOT update risk_score when null', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 14 }] });

    await queries.insertPR({
      project_id: 1,
      pr_url: 'url',
      repo: 'r',
      pr_number: 5,
      author: 'dev1',
      files_count: 1,
      risk_score: null,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('should default is_historical to false', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 15 }] });

    await queries.insertPR({
      project_id: 1,
      pr_url: 'url',
      repo: 'r',
      pr_number: 6,
      author: 'dev1',
      files_count: 1,
    });

    const [, params] = pool.query.mock.calls[0];
    expect(params[9]).toBe(false);
  });

  it('should pass is_historical=true when set', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 16 }] });

    await queries.insertPR({
      project_id: 1,
      pr_url: 'url',
      repo: 'r',
      pr_number: 7,
      author: 'dev1',
      files_count: 1,
      is_historical: true,
    });

    const [, params] = pool.query.mock.calls[0];
    expect(params[9]).toBe(true);
  });
});

// ─── updatePRStatus ─────────────────────────────────────────────────────────

describe('updatePRStatus', () => {
  it('should update status and risk_score', async () => {
    pool.query.mockResolvedValueOnce({});

    await queries.updatePRStatus({ id: 1, status: 'done', risk_score: 50 });

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('UPDATE public.pull_requests SET status=$1, risk_score=$2 WHERE id=$3');
    expect(params).toEqual(['done', 50, 1]);
  });

  it('should allow null risk_score', async () => {
    pool.query.mockResolvedValueOnce({});

    await queries.updatePRStatus({ id: 2, status: 'processing', risk_score: null });

    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['processing', null, 2]);
  });
});

// ─── insertFinding ──────────────────────────────────────────────────────────

describe('insertFinding', () => {
  it('should insert a finding and return its id', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 100 }] });

    const result = await queries.insertFinding({
      project_id: 1,
      pr_id: 10,
      filename: 'src/app.js',
      line_number: 42,
      rule_name: 'no-eval',
      severity: 'critical',
      confidence: 0.9,
      message: 'Do not use eval',
      fix_hint: 'Use Function constructor',
      author: 'dev1',
      false_positive: 0,
    });

    expect(result).toBe(100);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO public.findings');
    expect(sql).toContain('RETURNING id');
    expect(params).toEqual([
      1,
      10,
      'src/app.js',
      42,
      'no-eval',
      'critical',
      0.9,
      'Do not use eval',
      'Use Function constructor',
      'dev1',
      0,
    ]);
  });

  it('should default false_positive to 0 via COALESCE', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 101 }] });

    await queries.insertFinding({
      project_id: 1,
      pr_id: 10,
      filename: 'a.js',
      line_number: 1,
      rule_name: 'r1',
      severity: 'warning',
      confidence: 0.5,
      message: 'msg',
      author: 'dev1',
    });

    const [, params] = pool.query.mock.calls[0];
    expect(params[10]).toBe(0); // false_positive param, undefined ?? 0 yields 0
  });

  it('should pass explicit false_positive value', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 102 }] });

    await queries.insertFinding({
      project_id: 1,
      pr_id: 10,
      filename: 'b.js',
      line_number: 5,
      rule_name: 'r2',
      severity: 'info',
      confidence: 0.3,
      message: 'msg',
      author: 'dev1',
      false_positive: 2,
    });

    const [, params] = pool.query.mock.calls[0];
    expect(params[10]).toBe(2);
  });

  it('should return undefined when no row returned', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await queries.insertFinding({
      project_id: 1,
      pr_id: 10,
      filename: 'c.js',
      line_number: 1,
      rule_name: 'r3',
      severity: 'warning',
      confidence: 0.5,
      message: 'msg',
      author: 'dev1',
    });

    expect(result).toBeUndefined();
  });
});

// ─── getFindingsByPR ────────────────────────────────────────────────────────

describe('getFindingsByPR', () => {
  it('should return findings ordered by false_positive ASC, severity DESC, confidence DESC', async () => {
    const mockRows = [
      { id: 1, false_positive: 0, severity: 'critical', confidence: 0.9 },
      { id: 2, false_positive: 0, severity: 'warning', confidence: 0.7 },
      { id: 3, false_positive: 1, severity: 'critical', confidence: 0.8 },
    ];
    pool.query.mockResolvedValueOnce({ rows: mockRows });

    const result = await queries.getFindingsByPR(10);

    expect(result).toEqual(mockRows);
    expect(result).toHaveLength(3);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('WHERE pr_id=$1');
    expect(sql).toContain('ORDER BY false_positive ASC, severity DESC, confidence DESC');
    expect(params).toEqual([10]);
  });

  it('should return empty array when PR has no findings', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await queries.getFindingsByPR(999);

    expect(result).toEqual([]);
  });
});

// ─── markFalsePositive ──────────────────────────────────────────────────────

describe('markFalsePositive', () => {
  it('should set false_positive=1 for the finding', async () => {
    pool.query.mockResolvedValueOnce({});

    await queries.markFalsePositive(42);

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('UPDATE public.findings SET false_positive=1 WHERE id=$1');
    expect(params).toEqual([42]);
  });
});

// ─── getFindingByIdForOwner ─────────────────────────────────────────────────

describe('getFindingByIdForOwner', () => {
  it('should return finding details when owned by the user', async () => {
    const mockRow = { id: 5, project_id: 1, pr_id: 10, author: 'dev1', false_positive: 0 };
    pool.query.mockResolvedValueOnce({ rows: [mockRow] });

    const result = await queries.getFindingByIdForOwner(5, 'owner1');

    expect(result).toEqual(mockRow);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('JOIN public.projects p ON p.id=f.project_id');
    expect(sql).toContain('WHERE f.id=$1 AND p.owner_id=$2');
    expect(params).toEqual([5, 'owner1']);
  });

  it('should return null when finding not found or not owned', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await queries.getFindingByIdForOwner(5, 'wrong-owner');

    expect(result).toBeNull();
  });
});

// ─── setFalsePositive ───────────────────────────────────────────────────────

describe('setFalsePositive', () => {
  it('should set false_positive to 1 when truthy value given', async () => {
    pool.query.mockResolvedValueOnce({});

    await queries.setFalsePositive(10, true);

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('UPDATE public.findings SET false_positive=$1 WHERE id=$2');
    expect(params).toEqual([1, 10]);
  });

  it('should set false_positive to 1 when truthy non-boolean value given', async () => {
    pool.query.mockResolvedValueOnce({});

    await queries.setFalsePositive(10, 5);

    const [, params] = pool.query.mock.calls[0];
    expect(params[0]).toBe(1);
  });

  it('should set false_positive to 0 when falsy value given', async () => {
    pool.query.mockResolvedValueOnce({});

    await queries.setFalsePositive(10, false);

    const [, params] = pool.query.mock.calls[0];
    expect(params[0]).toBe(0);
  });

  it('should set false_positive to 0 when null given', async () => {
    pool.query.mockResolvedValueOnce({});

    await queries.setFalsePositive(10, null);

    const [, params] = pool.query.mock.calls[0];
    expect(params[0]).toBe(0);
  });

  it('should set false_positive to 0 when 0 given', async () => {
    pool.query.mockResolvedValueOnce({});

    await queries.setFalsePositive(10, 0);

    const [, params] = pool.query.mock.calls[0];
    expect(params[0]).toBe(0);
  });
});

// ─── incrementFalsePositive ─────────────────────────────────────────────────

describe('incrementFalsePositive', () => {
  it('should increment false_positive and return updated finding', async () => {
    const mockRow = { id: 10, project_id: 1, pr_id: 5, author: 'dev1', false_positive: 1 };
    pool.query.mockResolvedValueOnce({ rows: [mockRow] });

    const result = await queries.incrementFalsePositive(10);

    expect(result).toEqual(mockRow);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('LEAST(2, COALESCE(false_positive, 0) + 1)');
    expect(sql).toContain('WHERE id=$1');
    expect(sql).toContain('RETURNING id, project_id, pr_id, author, false_positive');
    expect(params).toEqual([10]);
  });

  it('should cap false_positive at 2', async () => {
    const mockRow = { id: 10, project_id: 1, pr_id: 5, author: 'dev1', false_positive: 2 };
    pool.query.mockResolvedValueOnce({ rows: [mockRow] });

    const result = await queries.incrementFalsePositive(10);

    expect(result.false_positive).toBe(2);
  });

  it('should return null when finding not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await queries.incrementFalsePositive(999);

    expect(result).toBeNull();
  });
});

// ─── getSuppressionMap ──────────────────────────────────────────────────────

describe('getSuppressionMap', () => {
  it('should return a Map of suppressed rules', async () => {
    const mockRows = [
      { filename: 'a.js', rule_name: 'no-eval', suppression_level: '2' },
      { filename: 'b.js', rule_name: 'no-debug', suppression_level: '1' },
    ];
    pool.query.mockResolvedValueOnce({ rows: mockRows });

    const result = await queries.getSuppressionMap(1, 'dev1');

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(2);
    expect(result.get('a.js::no-eval')).toBe(2);
    expect(result.get('b.js::no-debug')).toBe(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('WHERE project_id=$1 AND author=$2 AND false_positive > 0');
    expect(sql).toContain('GROUP BY filename, rule_name');
    expect(params).toEqual([1, 'dev1']);
  });

  it('should return empty Map when no suppressions exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await queries.getSuppressionMap(1, 'dev1');

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it('should handle null suppression_level as 0', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ filename: 'x.js', rule_name: 'r1', suppression_level: null }] });

    const result = await queries.getSuppressionMap(1, 'dev1');

    expect(result.get('x.js::r1')).toBe(0);
  });
});

// ─── recalculatePRRiskScore ─────────────────────────────────────────────────

describe('recalculatePRRiskScore', () => {
  it('should calculate risk score from critical and warning counts', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ critical: '3', warning: '5' }] }) // COUNT query
      .mockResolvedValueOnce({}); // UPDATE query

    const result = await queries.recalculatePRRiskScore(10);

    // 3*6 + 5*2 = 18 + 10 = 28
    expect(result).toBe(28);
    expect(pool.query).toHaveBeenCalledTimes(2);

    const [updateSql, updateParams] = pool.query.mock.calls[1];
    expect(updateSql).toContain('UPDATE public.pull_requests SET risk_score');
    expect(updateParams).toEqual([28, 10]);
  });

  it('should cap risk score at 100', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ critical: '15', warning: '5' }] })
      .mockResolvedValueOnce({});

    const result = await queries.recalculatePRRiskScore(10);

    // 15*6 + 5*2 = 90 + 10 = 100, capped at 100
    expect(result).toBe(100);
  });

  it('should return 0 when no findings', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ critical: '0', warning: '0' }] })
      .mockResolvedValueOnce({});

    const result = await queries.recalculatePRRiskScore(10);

    expect(result).toBe(0);
  });

  it('should handle null counts as 0', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ critical: null, warning: null }] })
      .mockResolvedValueOnce({});

    const result = await queries.recalculatePRRiskScore(10);

    expect(result).toBe(0);
  });
});

// ─── recomputeProfileStats ──────────────────────────────────────────────────

describe('recomputeProfileStats', () => {
  it('should query PR count, findings, and update profile', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ prs: '5' }] })
      .mockResolvedValueOnce({ rows: [{ total: '20', critical: '3', warning: '7' }] })
      .mockResolvedValueOnce({});

    await queries.recomputeProfileStats(1, 'dev1');

    expect(pool.query).toHaveBeenCalledTimes(3);

    const [updateSql, updateParams] = pool.query.mock.calls[2];
    expect(updateSql).toContain('UPDATE public.developer_profiles');
    expect(updateParams).toEqual([1, 'dev1', 5, 20, 3, 7]);
  });

  it('should default to 0 for null counts', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ prs: null }] })
      .mockResolvedValueOnce({ rows: [{ total: null, critical: null, warning: null }] })
      .mockResolvedValueOnce({});

    await queries.recomputeProfileStats(1, 'dev1');

    const [, updateParams] = pool.query.mock.calls[2];
    expect(updateParams).toEqual([1, 'dev1', 0, 0, 0, 0]);
  });
});

// ─── getFeedbackStats ───────────────────────────────────────────────────────

describe('getFeedbackStats', () => {
  it('should aggregate feedback statistics across three queries', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{
          total_findings: '100',
          false_positive_count: '25',
          low_priority_count: '15',
          ignored_count: '10',
          false_positive_rate: '25.00',
        }],
      })
      .mockResolvedValueOnce({
        rows: [
          { rule_name: 'no-eval', total_hits: '50', false_positive_hits: '20' },
          { rule_name: 'no-debug', total_hits: '30', false_positive_hits: '5' },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ last_profile_update: '2025-01-15T10:00:00Z' }],
      });

    const result = await queries.getFeedbackStats(1);

    expect(result).toEqual({
      total_findings: 100,
      false_positive_count: 25,
      low_priority_count: 15,
      ignored_count: 10,
      false_positive_rate: 25,
      last_profile_update: '2025-01-15T10:00:00Z',
      top_feedback_rules: [
        { rule_name: 'no-eval', total_hits: 50, false_positive_hits: 20 },
        { rule_name: 'no-debug', total_hits: 30, false_positive_hits: 5 },
      ],
    });
    expect(pool.query).toHaveBeenCalledTimes(3);
  });

  it('should handle empty results gracefully', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{}] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{}] });

    const result = await queries.getFeedbackStats(1);

    expect(result.total_findings).toBe(0);
    expect(result.false_positive_count).toBe(0);
    expect(result.false_positive_rate).toBe(0);
    expect(result.last_profile_update).toBeNull();
    expect(result.top_feedback_rules).toEqual([]);
  });

  it('should handle null values in row fields', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{
          total_findings: null,
          false_positive_count: null,
          low_priority_count: null,
          ignored_count: null,
          false_positive_rate: null,
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ last_profile_update: null }] });

    const result = await queries.getFeedbackStats(1);

    expect(result.total_findings).toBe(0);
    expect(result.false_positive_count).toBe(0);
    expect(result.last_profile_update).toBeNull();
  });
});

// ─── getScorecard ───────────────────────────────────────────────────────────

describe('getScorecard', () => {
  it('should return scorecard with calculated scores', async () => {
    const mockRows = [
      { author: 'dev1', critical_count: '2', warning_count: '5', score: '74' },
      { author: 'dev2', critical_count: '0', warning_count: '1', score: '98' },
    ];
    pool.query.mockResolvedValueOnce({ rows: mockRows });

    const result = await queries.getScorecard(1);

    expect(result).toEqual(mockRows);
    expect(result).toHaveLength(2);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('SELECT f.author');
    expect(sql).toContain('WHERE f.project_id=$1');
    expect(sql).toContain("INTERVAL '30 days'");
    expect(sql).toContain('pr.is_historical=false');
    expect(sql).toContain('GROUP BY f.author ORDER BY score DESC');
    expect(params).toEqual([1]);
  });

  it('should return empty array when no findings in last 30 days', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await queries.getScorecard(1);

    expect(result).toEqual([]);
  });
});

// ─── getHeatmap ─────────────────────────────────────────────────────────────

describe('getHeatmap', () => {
  it('should return heatmap data grouped by filename', async () => {
    const mockRows = [
      { filename: 'src/app.js', critical: '5', warning: '10', info: '3', total: '18' },
      { filename: 'src/utils.js', critical: '1', warning: '2', info: '0', total: '3' },
    ];
    pool.query.mockResolvedValueOnce({ rows: mockRows });

    const result = await queries.getHeatmap(1);

    expect(result).toEqual(mockRows);
    expect(result).toHaveLength(2);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('SELECT filename');
    expect(sql).toContain('GROUP BY filename ORDER BY total DESC LIMIT 15');
    expect(sql).toContain('pr.is_historical=false');
    expect(params).toEqual([1]);
  });

  it('should return empty array when no findings', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await queries.getHeatmap(1);

    expect(result).toEqual([]);
  });
});

// ─── getHistory ─────────────────────────────────────────────────────────────

describe('getHistory', () => {
  it('should return PR history with source_type and display_score', async () => {
    const mockRows = [
      { id: 1, is_historical: false, risk_score: 42, source_type: 'scanned', display_score: 42 },
      { id: 2, is_historical: true, risk_score: null, source_type: 'imported', display_score: null },
    ];
    pool.query.mockResolvedValueOnce({ rows: mockRows });

    const result = await queries.getHistory(1);

    expect(result).toEqual(mockRows);
    expect(result).toHaveLength(2);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('CASE WHEN is_historical');
    expect(sql).toContain("ELSE 'scanned'");
    expect(sql).toContain("THEN 'imported'");
    expect(sql).toContain('ORDER BY analyzed_at DESC LIMIT 20');
    expect(params).toEqual([1]);
  });

  it('should return empty array when no PRs exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await queries.getHistory(1);

    expect(result).toEqual([]);
  });
});

// ─── getAuthorPatterns ──────────────────────────────────────────────────────

describe('getAuthorPatterns', () => {
  it('should return developer patterns ordered by count DESC', async () => {
    const mockRows = [
      { rule_name: 'no-eval', count: 10 },
      { rule_name: 'no-debug', count: 5 },
    ];
    pool.query.mockResolvedValueOnce({ rows: mockRows });

    const result = await queries.getAuthorPatterns(1, 'dev1');

    expect(result).toEqual(mockRows);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('SELECT rule_name, count FROM public.developer_patterns');
    expect(sql).toContain('WHERE project_id=$1 AND author=$2 ORDER BY count DESC');
    expect(params).toEqual([1, 'dev1']);
  });

  it('should return empty array when no patterns exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await queries.getAuthorPatterns(1, 'dev1');

    expect(result).toEqual([]);
  });
});

// ─── upsertPattern ──────────────────────────────────────────────────────────

describe('upsertPattern', () => {
  it('should insert a pattern with ON CONFLICT upsert', async () => {
    pool.query.mockResolvedValueOnce({});

    await queries.upsertPattern(1, 'dev1', 'no-eval');

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO public.developer_patterns');
    expect(sql).toContain('ON CONFLICT (project_id, author, rule_name)');
    expect(sql).toContain('DO UPDATE SET count = public.developer_patterns.count + 1');
    expect(params).toEqual([1, 'dev1', 'no-eval']);
  });
});

// ─── getOrCreateProfile ─────────────────────────────────────────────────────

describe('getOrCreateProfile', () => {
  it('should return existing profile when found', async () => {
    const mockProfile = { id: 1, project_id: 1, github_login: 'dev1' };
    pool.query.mockResolvedValueOnce({ rows: [mockProfile] });

    const result = await queries.getOrCreateProfile(1, 'dev1');

    expect(result).toEqual({ profile: mockProfile, isNew: false });
    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('SELECT * FROM public.developer_profiles');
    expect(params).toEqual([1, 'dev1']);
  });

  it('should create and return new profile when not found', async () => {
    const mockProfile = { id: 2, project_id: 1, github_login: 'dev1' };
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // SELECT profile
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // SELECT project exists
      .mockResolvedValueOnce({ rows: [mockProfile] }); // INSERT

    const result = await queries.getOrCreateProfile(1, 'dev1');

    expect(result).toEqual({ profile: mockProfile, isNew: true });
    expect(pool.query).toHaveBeenCalledTimes(3);

    const [insertSql, insertParams] = pool.query.mock.calls[2];
    expect(insertSql).toContain('INSERT INTO public.developer_profiles');
    expect(insertSql).toContain('RETURNING *');
    expect(insertParams).toEqual([1, 'dev1']);
  });
});

// ─── updateProfileStats ─────────────────────────────────────────────────────

describe('updateProfileStats', () => {
  it('should increment profile stats by the findings counts', async () => {
    pool.query.mockResolvedValueOnce({});

    await queries.updateProfileStats(1, 'dev1', { critical: 3, warning: 5, info: 2 });

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('UPDATE public.developer_profiles');
    expect(sql).toContain('total_prs_analyzed=total_prs_analyzed+1');
    expect(sql).toContain('total_findings=total_findings+$3');
    expect(sql).toContain('total_critical=total_critical+$4');
    expect(sql).toContain('total_warnings=total_warnings+$5');
    // critical + warning + info = 10, critical = 3, warning = 5
    expect(params).toEqual([1, 'dev1', 10, 3, 5]);
  });

  it('should handle zero findings', async () => {
    pool.query.mockResolvedValueOnce({});

    await queries.updateProfileStats(1, 'dev1', { critical: 0, warning: 0, info: 0 });

    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual([1, 'dev1', 0, 0, 0]);
  });
});

// ─── recalculateWeights ─────────────────────────────────────────────────────

describe('recalculateWeights', () => {
  it('should calculate and update weights and thresholds', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [
          { rule_name: 'no-eval', hit_count: '10', fp_count: '2' },
          { rule_name: 'no-debug', hit_count: '5', fp_count: '0' },
        ],
      })
      .mockResolvedValueOnce({});

    await queries.recalculateWeights(1, 'dev1');

    expect(pool.query).toHaveBeenCalledTimes(2);

    const [updateSql, updateParams] = pool.query.mock.calls[1];
    expect(updateSql).toContain('UPDATE public.developer_profiles');
    expect(updateSql).toContain('SET rule_weights=$1, rule_thresholds=$2, weights_updated_at=NOW()');
    expect(updateParams[2]).toBe(1); // project_id
    expect(updateParams[3]).toBe('dev1'); // github_login

    // Verify JSON payloads are parseable
    const weights = JSON.parse(updateParams[0]);
    const thresholds = JSON.parse(updateParams[1]);
    expect(weights).toHaveProperty('no-eval');
    expect(weights).toHaveProperty('no-debug');
    expect(thresholds).toHaveProperty('no-eval');
    expect(thresholds).toHaveProperty('no-debug');
  });

  it('should return early when no findings exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await queries.recalculateWeights(1, 'dev1');

    expect(pool.query).toHaveBeenCalledTimes(1); // Only the SELECT, no UPDATE
  });

  it('should clamp weight between 0.3 and 2.5', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [
          { rule_name: 'rare-rule', hit_count: '1', fp_count: '0' },
          { rule_name: 'common-rule', hit_count: '100', fp_count: '0' },
        ],
      })
      .mockResolvedValueOnce({});

    await queries.recalculateWeights(1, 'dev1');

    const [, updateParams] = pool.query.mock.calls[1];
    const weights = JSON.parse(updateParams[0]);

    for (const w of Object.values(weights)) {
      expect(w).toBeGreaterThanOrEqual(0.3);
      expect(w).toBeLessThanOrEqual(2.5);
    }
  });

  it('should clamp threshold between 40 and 85', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [
          { rule_name: 'hot-rule', hit_count: '50', fp_count: '0' },
          { rule_name: 'cold-rule', hit_count: '1', fp_count: '1' },
        ],
      })
      .mockResolvedValueOnce({});

    await queries.recalculateWeights(1, 'dev1');

    const [, updateParams] = pool.query.mock.calls[1];
    const thresholds = JSON.parse(updateParams[1]);

    for (const t of Object.values(thresholds)) {
      expect(t).toBeGreaterThanOrEqual(40);
      expect(t).toBeLessThanOrEqual(85);
    }
  });

  it('should increase threshold when fpRate > 0.3', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [
          { rule_name: 'fp-heavy', hit_count: '10', fp_count: '5' }, // 50% FP rate
        ],
      })
      .mockResolvedValueOnce({});

    await queries.recalculateWeights(1, 'dev1');

    const [, updateParams] = pool.query.mock.calls[1];
    const thresholds = JSON.parse(updateParams[1]);
    // Base 65 + 15 (fpRate > 0.3) = 80, hits=10 >= 3 so -10 = 70
    expect(thresholds['fp-heavy']).toBe(70);
  });

  it('should decrease threshold when hits >= 3', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [
          { rule_name: 'frequent', hit_count: '5', fp_count: '0' }, // 0% FP rate
        ],
      })
      .mockResolvedValueOnce({});

    await queries.recalculateWeights(1, 'dev1');

    const [, updateParams] = pool.query.mock.calls[1];
    const thresholds = JSON.parse(updateParams[1]);
    // Base 65, hits=5 >= 3 so -10 = 55, fpRate=0 so no +15
    expect(thresholds['frequent']).toBe(55);
  });
});

// ─── getDangerZoneFiles ─────────────────────────────────────────────────────

describe('getDangerZoneFiles', () => {
  it('should return a Set of filenames with 5+ findings', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        { filename: 'src/app.js' },
        { filename: 'src/utils.js' },
      ],
    });

    const result = await queries.getDangerZoneFiles(1);

    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(2);
    expect(result.has('src/app.js')).toBe(true);
    expect(result.has('src/utils.js')).toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('HAVING COUNT(*)>=5');
    expect(params).toEqual([1]);
  });

  it('should return empty Set when no files have 5+ findings', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await queries.getDangerZoneFiles(1);

    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  it('should return a single-item Set for one danger zone file', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ filename: 'critical.js' }] });

    const result = await queries.getDangerZoneFiles(1);

    expect(result.size).toBe(1);
    expect(result.has('critical.js')).toBe(true);
  });
});

// ─── getDeveloperProfile ────────────────────────────────────────────────────

describe('getDeveloperProfile', () => {
  it('should return profile with recent PRs and top rules', async () => {
    const mockProfile = { id: 1, github_login: 'dev1' };
    const mockPrs = [{ id: 10, pr_url: 'url1', risk_score: 42 }];
    const mockRules = [{ rule_name: 'no-eval', total: '5', critical: '2' }];

    pool.query
      .mockResolvedValueOnce({ rows: [mockProfile] })
      .mockResolvedValueOnce({ rows: mockPrs })
      .mockResolvedValueOnce({ rows: mockRules });

    const result = await queries.getDeveloperProfile(1, 'dev1');

    expect(result).toEqual({
      profile: mockProfile,
      recent_prs: mockPrs,
      top_rules: mockRules,
    });
    expect(pool.query).toHaveBeenCalledTimes(3);
  });

  it('should return null when profile not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await queries.getDeveloperProfile(1, 'nonexistent');

    expect(result).toBeNull();
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});

// ─── updateProjectImportStatus ──────────────────────────────────────────────

describe('updateProjectImportStatus', () => {
  it('should update import status and count', async () => {
    pool.query.mockResolvedValueOnce({});

    await queries.updateProjectImportStatus(1, 'done', 42);

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('UPDATE public.projects SET import_status=$1, import_count=$2 WHERE id=$3');
    expect(params).toEqual(['done', 42, 1]);
  });
});
