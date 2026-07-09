jest.mock('express', () => jest.requireActual('express'));
jest.mock('../db/db', () => ({ query: jest.fn() }));
jest.mock('../db/queries', () => ({
  getProjectsByOwner: jest.fn(),
  createProject: jest.fn(),
  getProjectById: jest.fn(),
  deleteProject: jest.fn(),
  getHistory: jest.fn(),
  getScorecard: jest.fn(),
  getHeatmap: jest.fn(),
  getFindingsByPR: jest.fn(),
  getFindingByIdForOwner: jest.fn(),
  incrementFalsePositive: jest.fn(),
  setFalsePositive: jest.fn(),
  recalculatePRRiskScore: jest.fn(),
  recomputeProfileStats: jest.fn(),
  recalculateWeights: jest.fn(),
  getDeveloperProfile: jest.fn(),
  getFeedbackStats: jest.fn(),
}));
jest.mock('../auth/middleware', () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: 'user-1', email: 'test@example.com' };
    req.githubToken = 'gho_test_token';
    next();
  },
}));
jest.mock('../github/repoLister', () => ({ listUserRepos: jest.fn() }));
jest.mock('../github/fetcher', () => ({ fetchPR: jest.fn(), fetchPRFiles: jest.fn() }));
jest.mock('../analysis/pipeline', () => ({ analyzePR: jest.fn() }));
jest.mock('../projects/importer', () => ({ startHistoricalImport: jest.fn() }));
jest.mock('../ml/mlBridge', () => ({ scorePR: jest.fn() }));
jest.mock('uuid', () => ({ v4: jest.fn(() => 'test-uuid-1234') }));

const pool = require('../db/db');
const queries = require('../db/queries');
const { listUserRepos } = require('../github/repoLister');
const { analyzePR } = require('../analysis/pipeline');
const { startHistoricalImport } = require('../projects/importer');

const authRouter = require('../routes/auth');
const projectsRouter = require('../routes/projects');
const { router: analyzeRouter, jobs } = require('../routes/analyze');
const analyticsRouter = require('../routes/analytics');
const developerRouter = require('../routes/developer');

function getHandler(router, path, method) {
  const layer = router.stack.find(
    r => r.route && r.route.path === path && r.route.methods[method]
  );
  if (!layer) throw new Error(`No handler for ${method.toUpperCase()} ${path}`);
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle;
}

function createReq(overrides = {}) {
  return {
    user: { id: 'user-1', email: 'test@example.com' },
    githubToken: 'gho_test_token',
    body: {},
    params: {},
    query: {},
    ...overrides,
  };
}

function createRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

async function callHandler(handler, reqOverrides) {
  const req = createReq(reqOverrides);
  const res = createRes();
  await handler(req, res);
  return { req, res };
}

function flushSetImmediate() {
  return new Promise(resolve => setImmediate(resolve));
}

// ──────────────────────────────────────────────
// AUTH ROUTES
// ──────────────────────────────────────────────
describe('Auth Routes', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('GET /me', () => {
    it('returns user profile', async () => {
      const handler = getHandler(authRouter, '/me', 'get');
      pool.query.mockResolvedValue({ rows: [{ id: 'user-1', name: 'Test User' }] });
      const { res } = await callHandler(handler);

      expect(res.json).toHaveBeenCalledWith({
        user: { id: 'user-1', email: 'test@example.com' },
        profile: { id: 'user-1', name: 'Test User' },
      });
    });

    it('returns null profile when none exists', async () => {
      const handler = getHandler(authRouter, '/me', 'get');
      pool.query.mockResolvedValue({ rows: [] });
      const { res } = await callHandler(handler);

      expect(res.json).toHaveBeenCalledWith({
        user: { id: 'user-1', email: 'test@example.com' },
        profile: null,
      });
    });

    it('returns 500 on database error', async () => {
      const handler = getHandler(authRouter, '/me', 'get');
      pool.query.mockRejectedValue(new Error('DB connection failed'));
      const { res } = await callHandler(handler);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'DB connection failed' });
    });
  });

  describe('GET /repos', () => {
    it('returns user repos', async () => {
      const handler = getHandler(authRouter, '/repos', 'get');
      listUserRepos.mockResolvedValue([{ name: 'repo-1' }, { name: 'repo-2' }]);
      const { res } = await callHandler(handler);

      expect(listUserRepos).toHaveBeenCalledWith('gho_test_token');
      expect(res.json).toHaveBeenCalledWith([{ name: 'repo-1' }, { name: 'repo-2' }]);
    });

    it('returns 500 on fetch error', async () => {
      const handler = getHandler(authRouter, '/repos', 'get');
      listUserRepos.mockRejectedValue(new Error('GitHub API error'));
      const { res } = await callHandler(handler);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'GitHub API error' });
    });
  });
});

// ──────────────────────────────────────────────
// PROJECTS ROUTES
// ──────────────────────────────────────────────
describe('Projects Routes', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('GET /', () => {
    it('returns projects for user', async () => {
      const handler = getHandler(projectsRouter, '/', 'get');
      const mockProjects = [{ id: 'p1', name: 'My Project' }];
      queries.getProjectsByOwner.mockResolvedValue(mockProjects);
      const { res } = await callHandler(handler);

      expect(queries.getProjectsByOwner).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith(mockProjects);
    });

    it('returns 500 on database error', async () => {
      const handler = getHandler(projectsRouter, '/', 'get');
      queries.getProjectsByOwner.mockRejectedValue(new Error('DB error'));
      const { res } = await callHandler(handler);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'DB error' });
    });
  });

  describe('POST /', () => {
    const handler = () => getHandler(projectsRouter, '/', 'post');

    it('creates a project with owner/repo format', async () => {
      const mockProject = { id: 'p1', name: 'Test', github_repo: 'user/repo' };
      queries.createProject.mockResolvedValue(mockProject);
      const { res } = await callHandler(handler(), {
        body: { name: 'Test', github_repo: 'user/repo' },
      });

      expect(queries.createProject).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockProject);
    });

    it('returns 400 when name is missing', async () => {
      const { res } = await callHandler(handler(), {
        body: { github_repo: 'user/repo' },
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'name and github_repo required' });
    });

    it('returns 400 when github_repo is missing', async () => {
      const { res } = await callHandler(handler(), {
        body: { name: 'Test' },
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'name and github_repo required' });
    });

    it('returns 400 when body is empty', async () => {
      const { res } = await callHandler(handler(), { body: {} });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'name and github_repo required' });
    });

    it('returns 400 for invalid repo input', async () => {
      const { res } = await callHandler(handler(), {
        body: { name: 'Test', github_repo: '!!!invalid!!!' },
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Enter owner/repo, GitHub URL, or repository URL' });
    });

    it('normalizes a GitHub URL to owner/repo', async () => {
      queries.createProject.mockResolvedValue({ id: 'p1' });
      await callHandler(handler(), {
        body: { name: 'Test', github_repo: 'https://github.com/octocat/hello-world.git' },
      });

      expect(queries.createProject).toHaveBeenCalledWith(
        expect.objectContaining({ github_repo: 'octocat/hello-world' })
      );
    });

    it('triggers historical import for GitHub repos', async () => {
      queries.createProject.mockResolvedValue({ id: 'p-new' });
      const orig = global.setImmediate;
      global.setImmediate = (cb) => { cb(); return 1; };
      try {
        await callHandler(handler(), {
          body: { name: 'Test', github_repo: 'octocat/hello-world' },
        });
        expect(startHistoricalImport).toHaveBeenCalledWith('p-new', 'octocat/hello-world', 'gho_test_token', 30);
      } finally {
        global.setImmediate = orig;
      }
    });

    it('returns 500 on database error', async () => {
      queries.createProject.mockRejectedValue(new Error('insert failed'));
      const { res } = await callHandler(handler(), {
        body: { name: 'Test', github_repo: 'user/repo' },
      });

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'insert failed' });
    });
  });

  describe('GET /:id', () => {
    it('returns project by id', async () => {
      const handler = getHandler(projectsRouter, '/:id', 'get');
      queries.getProjectById.mockResolvedValue({ id: 'p1', name: 'Test' });
      const { res } = await callHandler(handler, { params: { id: 'p1' } });

      expect(res.json).toHaveBeenCalledWith({ id: 'p1', name: 'Test' });
    });

    it('returns 404 when project not found', async () => {
      const handler = getHandler(projectsRouter, '/:id', 'get');
      queries.getProjectById.mockResolvedValue(null);
      const { res } = await callHandler(handler, { params: { id: 'missing' } });

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Project not found' });
    });

    it('returns 500 on database error', async () => {
      const handler = getHandler(projectsRouter, '/:id', 'get');
      queries.getProjectById.mockRejectedValue(new Error('query failed'));
      const { res } = await callHandler(handler, { params: { id: 'p1' } });

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'query failed' });
    });
  });

  describe('DELETE /:id', () => {
    it('deletes project and returns ok', async () => {
      const handler = getHandler(projectsRouter, '/:id', 'delete');
      queries.deleteProject.mockResolvedValue(true);
      const { res } = await callHandler(handler, { params: { id: 'p1' } });

      expect(queries.deleteProject).toHaveBeenCalledWith('p1', 'user-1');
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    it('returns 404 when project not found', async () => {
      const handler = getHandler(projectsRouter, '/:id', 'delete');
      queries.deleteProject.mockResolvedValue(false);
      const { res } = await callHandler(handler, { params: { id: 'missing' } });

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Project not found' });
    });

    it('returns 500 on database error', async () => {
      const handler = getHandler(projectsRouter, '/:id', 'delete');
      queries.deleteProject.mockRejectedValue(new Error('delete failed'));
      const { res } = await callHandler(handler, { params: { id: 'p1' } });

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'delete failed' });
    });
  });
});

// ──────────────────────────────────────────────
// ANALYZE ROUTES
// ──────────────────────────────────────────────
describe('Analyze Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const [k] of jobs) jobs.delete(k);
  });

  describe('POST /', () => {
    it('creates analysis job and returns 200', async () => {
      const handler = getHandler(analyzeRouter, '/', 'post');
      queries.getProjectById.mockResolvedValue({ id: 'p1', github_repo: 'user/repo' });

      const { res } = await callHandler(handler, {
        body: { prUrl: 'https://github.com/user/repo/pull/42', projectId: 'p1' },
      });
      await flushSetImmediate();

      expect(res.json).toHaveBeenCalledWith({
        jobId: 'test-uuid-1234',
        status: 'processing',
      });
    });

    it('returns 400 when prUrl is missing', async () => {
      const handler = getHandler(analyzeRouter, '/', 'post');
      const { res } = await callHandler(handler, {
        body: { projectId: 'p1' },
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'prUrl is required' });
    });

    it('returns 400 when projectId is missing', async () => {
      const handler = getHandler(analyzeRouter, '/', 'post');
      const { res } = await callHandler(handler, {
        body: { prUrl: 'https://github.com/user/repo/pull/42' },
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'projectId is required' });
    });

    it('returns 400 when body is empty', async () => {
      const handler = getHandler(analyzeRouter, '/', 'post');
      const { res } = await callHandler(handler, { body: {} });

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 404 when project not found', async () => {
      const handler = getHandler(analyzeRouter, '/', 'post');
      queries.getProjectById.mockResolvedValue(null);
      const { res } = await callHandler(handler, {
        body: { prUrl: 'https://github.com/user/repo/pull/42', projectId: 'missing' },
      });

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Project not found' });
    });

    it('returns 400 when PR repo mismatches project repo', async () => {
      const handler = getHandler(analyzeRouter, '/', 'post');
      queries.getProjectById.mockResolvedValue({ id: 'p1', github_repo: 'user/repo' });
      const { res } = await callHandler(handler, {
        body: {
          prUrl: 'https://github.com/other-org/other-repo/pull/10',
          projectId: 'p1',
        },
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'PR is from other-org/other-repo but project uses user/repo',
      });
    });
  });

  describe('GET /:jobId', () => {
    const handler = getHandler(analyzeRouter, '/:jobId', 'get');

    it('returns job status', async () => {
      jobs.set('job-1', { status: 'complete', findings: [{ f: 1 }], summary: { score: 80 } });
      const { res } = await callHandler(handler, { params: { jobId: 'job-1' } });

      expect(res.json).toHaveBeenCalledWith({
        status: 'complete',
        findingsCount: 1,
        summary: { score: 80 },
      });
    });

    it('returns 404 for unknown job', async () => {
      const { res } = await callHandler(handler, { params: { jobId: 'nonexistent' } });

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Job not found' });
    });
  });
});

// ──────────────────────────────────────────────
// ANALYTICS ROUTES
// ──────────────────────────────────────────────
describe('Analytics Routes', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('GET /:projectId/history', () => {
    const handler = getHandler(analyticsRouter, '/:projectId/history', 'get');

    it('returns project history', async () => {
      queries.getProjectById.mockResolvedValue({ id: 'p1' });
      queries.getHistory.mockResolvedValue([{ pr_number: 1 }]);

      const { res } = await callHandler(handler, { params: { projectId: 'p1' } });

      expect(res.json).toHaveBeenCalledWith([{ pr_number: 1 }]);
    });

    it('returns 404 when project not found', async () => {
      queries.getProjectById.mockResolvedValue(null);
      const { res } = await callHandler(handler, { params: { projectId: 'missing' } });

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Project not found' });
    });

    it('returns 500 on database error', async () => {
      queries.getProjectById.mockRejectedValue(new Error('db err'));
      const { res } = await callHandler(handler, { params: { projectId: 'p1' } });

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'db err' });
    });
  });

  describe('GET /:projectId/scorecard', () => {
    const handler = getHandler(analyticsRouter, '/:projectId/scorecard', 'get');

    it('returns scorecard', async () => {
      queries.getProjectById.mockResolvedValue({ id: 'p1' });
      queries.getScorecard.mockResolvedValue([{ author: 'alice', score: 90 }]);

      const { res } = await callHandler(handler, { params: { projectId: 'p1' } });

      expect(res.json).toHaveBeenCalledWith([{ author: 'alice', score: 90 }]);
    });

    it('returns 404 when project not found', async () => {
      queries.getProjectById.mockResolvedValue(null);
      const { res } = await callHandler(handler, { params: { projectId: 'missing' } });

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 500 on database error', async () => {
      queries.getProjectById.mockRejectedValue(new Error('db err'));
      const { res } = await callHandler(handler, { params: { projectId: 'p1' } });

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('GET /:projectId/heatmap', () => {
    const handler = getHandler(analyticsRouter, '/:projectId/heatmap', 'get');

    it('returns heatmap data', async () => {
      queries.getProjectById.mockResolvedValue({ id: 'p1' });
      queries.getHeatmap.mockResolvedValue([{ filename: 'src/app.js', critical: 2 }]);

      const { res } = await callHandler(handler, { params: { projectId: 'p1' } });

      expect(res.json).toHaveBeenCalledWith([{ filename: 'src/app.js', critical: 2 }]);
    });

    it('returns 404 when project not found', async () => {
      queries.getProjectById.mockResolvedValue(null);
      const { res } = await callHandler(handler, { params: { projectId: 'missing' } });

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 500 on database error', async () => {
      queries.getProjectById.mockRejectedValue(new Error('db err'));
      const { res } = await callHandler(handler, { params: { projectId: 'p1' } });

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('GET /:projectId/feedback-stats', () => {
    const handler = getHandler(analyticsRouter, '/:projectId/feedback-stats', 'get');

    it('returns feedback stats', async () => {
      queries.getProjectById.mockResolvedValue({ id: 'p1' });
      queries.getFeedbackStats.mockResolvedValue({ total_findings: 10, false_positive_rate: 0.2 });

      const { res } = await callHandler(handler, { params: { projectId: 'p1' } });

      expect(res.json).toHaveBeenCalledWith({ total_findings: 10, false_positive_rate: 0.2 });
    });

    it('returns 404 when project not found', async () => {
      queries.getProjectById.mockResolvedValue(null);
      const { res } = await callHandler(handler, { params: { projectId: 'missing' } });

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('GET /:projectId/findings/:prId', () => {
    const handler = getHandler(analyticsRouter, '/:projectId/findings/:prId', 'get');

    it('returns findings for a PR', async () => {
      queries.getProjectById.mockResolvedValue({ id: 'p1' });
      queries.getFindingsByPR.mockResolvedValue([{ id: 'f1', severity: 'critical' }]);

      const { res } = await callHandler(handler, {
        params: { projectId: 'p1', prId: 'pr-1' },
      });

      expect(queries.getFindingsByPR).toHaveBeenCalledWith('pr-1');
      expect(res.json).toHaveBeenCalledWith([{ id: 'f1', severity: 'critical' }]);
    });

    it('returns 404 when project not found', async () => {
      queries.getProjectById.mockResolvedValue(null);
      const { res } = await callHandler(handler, {
        params: { projectId: 'missing', prId: 'pr-1' },
      });

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('POST /findings/:id/fp', () => {
    const handler = getHandler(analyticsRouter, '/findings/:id/fp', 'post');

    it('increments false positive and returns low_priority state', async () => {
      queries.getFindingByIdForOwner.mockResolvedValue({
        id: 'f1', project_id: 'p1', pr_id: 'pr-1', author: 'alice',
      });
      queries.incrementFalsePositive.mockResolvedValue({ id: 'f1', false_positive: 1 });
      queries.recalculatePRRiskScore.mockResolvedValue(20);

      const { res } = await callHandler(handler, { params: { id: 'f1' } });

      expect(queries.incrementFalsePositive).toHaveBeenCalledWith('f1');
      expect(queries.recalculatePRRiskScore).toHaveBeenCalledWith('pr-1');
      expect(queries.recomputeProfileStats).toHaveBeenCalledWith('p1', 'alice');
      expect(queries.recalculateWeights).toHaveBeenCalledWith('p1', 'alice');
      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        false_positive: 1,
        state: 'low_priority',
        prRiskScore: 20,
      });
    });

    it('marks as ignored when false_positive >= 2', async () => {
      queries.getFindingByIdForOwner.mockResolvedValue({
        id: 'f1', project_id: 'p1', pr_id: 'pr-1', author: 'alice',
      });
      queries.incrementFalsePositive.mockResolvedValue({ id: 'f1', false_positive: 2 });
      queries.recalculatePRRiskScore.mockResolvedValue(0);

      const { res } = await callHandler(handler, { params: { id: 'f1' } });

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'ignored' })
      );
    });

    it('returns 404 when finding not found', async () => {
      queries.getFindingByIdForOwner.mockResolvedValue(null);
      const { res } = await callHandler(handler, { params: { id: 'missing' } });

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Finding not found' });
    });

    it('returns 500 on database error', async () => {
      queries.getFindingByIdForOwner.mockRejectedValue(new Error('db err'));
      const { res } = await callHandler(handler, { params: { id: 'f1' } });

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'db err' });
    });
  });

  describe('PATCH /findings/:id/fp', () => {
    const handler = getHandler(analyticsRouter, '/findings/:id/fp', 'patch');

    it('sets false positive to true', async () => {
      queries.getFindingByIdForOwner.mockResolvedValue({
        id: 'f1', project_id: 'p1', pr_id: 'pr-1', author: 'alice',
      });
      queries.recalculatePRRiskScore.mockResolvedValue(15);

      const { res } = await callHandler(handler, {
        params: { id: 'f1' },
        body: { falsePositive: true },
      });

      expect(queries.setFalsePositive).toHaveBeenCalledWith('f1', true);
      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        false_positive: 1,
        prRiskScore: 15,
      });
    });

    it('sets false positive to false', async () => {
      queries.getFindingByIdForOwner.mockResolvedValue({
        id: 'f1', project_id: 'p1', pr_id: 'pr-1', author: 'alice',
      });
      queries.recalculatePRRiskScore.mockResolvedValue(30);

      const { res } = await callHandler(handler, {
        params: { id: 'f1' },
        body: { falsePositive: false },
      });

      expect(queries.setFalsePositive).toHaveBeenCalledWith('f1', false);
      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        false_positive: 0,
        prRiskScore: 30,
      });
    });

    it('returns 404 when finding not found', async () => {
      queries.getFindingByIdForOwner.mockResolvedValue(null);
      const { res } = await callHandler(handler, {
        params: { id: 'missing' },
        body: { falsePositive: true },
      });

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Finding not found' });
    });

    it('returns 500 on database error', async () => {
      queries.getFindingByIdForOwner.mockRejectedValue(new Error('db err'));
      const { res } = await callHandler(handler, {
        params: { id: 'f1' },
        body: { falsePositive: true },
      });

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});

// ──────────────────────────────────────────────
// DEVELOPER ROUTES
// ──────────────────────────────────────────────
describe('Developer Routes', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('GET /:projectId/:author', () => {
    const handler = getHandler(developerRouter, '/:projectId/:author', 'get');

    it('returns developer profile', async () => {
      queries.getProjectById.mockResolvedValue({ id: 'p1' });
      queries.getDeveloperProfile.mockResolvedValue({
        profile: { github_login: 'alice' },
        recent_prs: [],
        top_rules: [],
      });

      const { res } = await callHandler(handler, {
        params: { projectId: 'p1', author: 'alice' },
      });

      expect(queries.getDeveloperProfile).toHaveBeenCalledWith('p1', 'alice');
      expect(res.json).toHaveBeenCalledWith({
        profile: { github_login: 'alice' },
        recent_prs: [],
        top_rules: [],
      });
    });

    it('returns 404 when project not found', async () => {
      queries.getProjectById.mockResolvedValue(null);
      const { res } = await callHandler(handler, {
        params: { projectId: 'missing', author: 'alice' },
      });

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Project not found' });
    });

    it('returns 404 when developer not found', async () => {
      queries.getProjectById.mockResolvedValue({ id: 'p1' });
      queries.getDeveloperProfile.mockResolvedValue(null);

      const { res } = await callHandler(handler, {
        params: { projectId: 'p1', author: 'unknown' },
      });

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Developer not found' });
    });

    it('propagates database error (no try/catch in route)', async () => {
      queries.getProjectById.mockRejectedValue(new Error('db err'));
      await expect(
        callHandler(handler, { params: { projectId: 'p1', author: 'alice' } })
      ).rejects.toThrow('db err');
    });
  });
});

// ──────────────────────────────────────────────
// normalizeRepoInput (via POST /projects)
// ──────────────────────────────────────────────
describe('normalizeRepoInput (via POST /projects)', () => {
  beforeEach(() => jest.clearAllMocks());

  const handler = getHandler(projectsRouter, '/', 'post');

  it('accepts owner/repo shorthand', async () => {
    queries.createProject.mockResolvedValue({ id: 'p1' });
    await callHandler(handler, {
      body: { name: 'T', github_repo: 'octocat/repo' },
    });
    expect(queries.createProject).toHaveBeenCalledWith(
      expect.objectContaining({ github_repo: 'octocat/repo', is_private: false })
    );
  });

  it('normalizes GitHub URL with trailing .git', async () => {
    queries.createProject.mockResolvedValue({ id: 'p1' });
    await callHandler(handler, {
      body: { name: 'T', github_repo: 'https://github.com/user/my-repo.git' },
    });
    expect(queries.createProject).toHaveBeenCalledWith(
      expect.objectContaining({ github_repo: 'user/my-repo' })
    );
  });

  it('normalizes www.github.com URL', async () => {
    queries.createProject.mockResolvedValue({ id: 'p1' });
    await callHandler(handler, {
      body: { name: 'T', github_repo: 'https://www.github.com/org/project' },
    });
    expect(queries.createProject).toHaveBeenCalledWith(
      expect.objectContaining({ github_repo: 'org/project' })
    );
  });

  it('sets is_private to true when provided', async () => {
    queries.createProject.mockResolvedValue({ id: 'p1' });
    await callHandler(handler, {
      body: { name: 'T', github_repo: 'user/repo', is_private: true },
    });
    expect(queries.createProject).toHaveBeenCalledWith(
      expect.objectContaining({ is_private: true })
    );
  });

  it('sets import_status to pending for GitHub repos', async () => {
    queries.createProject.mockResolvedValue({ id: 'p1' });
    await callHandler(handler, {
      body: { name: 'T', github_repo: 'user/repo' },
    });
    expect(queries.createProject).toHaveBeenCalledWith(
      expect.objectContaining({ import_status: 'pending' })
    );
  });

  it('sets import_status to done for non-GitHub repos', async () => {
    queries.createProject.mockResolvedValue({ id: 'p1' });
    await callHandler(handler, {
      body: { name: 'T', github_repo: 'https://gitlab.com/user/repo' },
    });
    expect(queries.createProject).toHaveBeenCalledWith(
      expect.objectContaining({ import_status: 'done', is_private: false })
    );
  });
});
