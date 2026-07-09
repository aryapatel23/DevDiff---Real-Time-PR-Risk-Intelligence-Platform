jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

const { createClient } = require('@supabase/supabase-js');

function makeReq({ authHeader, githubToken, headers } = {}) {
  return {
    headers: {
      ...(authHeader !== undefined && { authorization: authHeader }),
      ...(githubToken !== undefined && { 'x-github-token': githubToken }),
      ...headers,
    },
  };
}

function makeRes() {
  const res = {
    statusCode: null,
    body: null,
    status: jest.fn(function (code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function (data) {
      this.body = data;
      return this;
    }),
  };
  return res;
}

let mockGetUser;

beforeEach(() => {
  jest.clearAllMocks();

  mockGetUser = jest.fn();

  createClient.mockImplementation(() => ({
    auth: { getUser: mockGetUser },
  }));

  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
});

describe('requireAuth', () => {
  function loadAuth() {
    jest.isolateModules(() => {
      const auth = require('../auth/middleware');
      loadAuth.requireAuth = auth.requireAuth;
    });
    return loadAuth.requireAuth;
  }

  test('returns 401 when no Authorization header', async () => {
    const requireAuth = loadAuth();
    const req = makeReq({ headers: {} });
    const res = makeRes();

    await requireAuth(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Missing authorization header',
    });
  });

  test('returns 401 when Authorization header is not "Bearer ..."', async () => {
    const requireAuth = loadAuth();
    const req = makeReq({ authHeader: 'Basic abc123' });
    const res = makeRes();

    await requireAuth(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Missing authorization header',
    });
  });

  test('returns 401 when token is invalid (supabase returns error)', async () => {
    const requireAuth = loadAuth();
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid token' },
    });

    const req = makeReq({
      authHeader: 'Bearer invalid-token',
      githubToken: 'ghp_valid123',
    });
    const res = makeRes();

    await requireAuth(req, res, jest.fn());

    expect(mockGetUser).toHaveBeenCalledWith('invalid-token');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid or expired token',
    });
  });

  test('returns 401 when no user returned (user is null)', async () => {
    const requireAuth = loadAuth();
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const req = makeReq({
      authHeader: 'Bearer some-token',
      githubToken: 'ghp_valid123',
    });
    const res = makeRes();

    await requireAuth(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid or expired token',
    });
  });

  test('returns 401 when no X-GitHub-Token header', async () => {
    const requireAuth = loadAuth();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com' } },
      error: null,
    });

    const req = makeReq({
      authHeader: 'Bearer valid-token',
      headers: {},
    });
    const res = makeRes();

    await requireAuth(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Missing GitHub token. Please re-login.',
    });
  });

  test('returns 200 and attaches user + githubToken when valid', async () => {
    const requireAuth = loadAuth();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com' } },
      error: null,
    });

    const req = makeReq({
      authHeader: 'Bearer valid-token',
      githubToken: 'ghp_abc123',
    });
    const res = makeRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(mockGetUser).toHaveBeenCalledWith('valid-token');
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({ id: 'u1', email: 'a@b.com' });
    expect(req.githubToken).toBe('ghp_abc123');
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  test('retries once on network timeout (250ms delay)', async () => {
    const requireAuth = loadAuth();
    const timeoutError = new Error('connect timeout');
    timeoutError.cause = { code: 'UND_ERR_CONNECT_TIMEOUT' };

    mockGetUser
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce({
        data: { user: { id: 'u2', email: 'retry@test.com' } },
        error: null,
      });

    const req = makeReq({
      authHeader: 'Bearer retry-token',
      githubToken: 'ghp_retry123',
    });
    const res = makeRes();
    const next = jest.fn();
    const start = Date.now();

    await requireAuth(req, res, next);

    const elapsed = Date.now() - start;

    expect(mockGetUser).toHaveBeenCalledTimes(2);
    expect(mockGetUser).toHaveBeenCalledWith('retry-token');
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({ id: 'u2', email: 'retry@test.com' });
    expect(req.githubToken).toBe('ghp_retry123');
    expect(elapsed).toBeGreaterThanOrEqual(200);
  });

  test('returns 503 after retry also times out', async () => {
    const requireAuth = loadAuth();
    const timeoutError = new Error('connect timeout');
    timeoutError.code = 'UND_ERR_CONNECT_TIMEOUT';

    mockGetUser.mockRejectedValue(timeoutError);

    const req = makeReq({
      authHeader: 'Bearer timeout-token',
      githubToken: 'ghp_timeout123',
    });
    const res = makeRes();

    await requireAuth(req, res, jest.fn());

    expect(mockGetUser).toHaveBeenCalledTimes(3);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Auth service temporarily unreachable. Please retry in a few seconds.',
      code: 'AUTH_SERVICE_TIMEOUT',
    });
  });

  test('does not retry on non-network errors', async () => {
    const requireAuth = loadAuth();
    mockGetUser.mockRejectedValue(new Error('some random error'));

    const req = makeReq({
      authHeader: 'Bearer err-token',
      githubToken: 'ghp_err123',
    });
    const res = makeRes();

    await requireAuth(req, res, jest.fn());

    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'some random error',
    });
  });

  test('handles supabase client initialization failure', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const requireAuth = loadAuth();
    const req = makeReq({
      authHeader: 'Bearer any-token',
      githubToken: 'ghp_any123',
    });
    const res = makeRes();

    await requireAuth(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Missing Supabase env vars') }),
    );
  });

  test('detects network timeout via err.code property', async () => {
    const requireAuth = loadAuth();
    const timeoutError = new Error('some message');
    timeoutError.code = 'UND_ERR_CONNECT_TIMEOUT';

    mockGetUser
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce({
        data: { user: { id: 'u3', email: 'code@test.com' } },
        error: null,
      });

    const req = makeReq({
      authHeader: 'Bearer code-token',
      githubToken: 'ghp_code123',
    });
    const res = makeRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(mockGetUser).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({ id: 'u3', email: 'code@test.com' });
  });

  test('detects network timeout via message substring', async () => {
    const requireAuth = loadAuth();
    const timeoutError = new Error('connect timeout after 5s');

    mockGetUser
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce({
        data: { user: { id: 'u4', email: 'msg@test.com' } },
        error: null,
      });

    const req = makeReq({
      authHeader: 'Bearer msg-token',
      githubToken: 'ghp_msg123',
    });
    const res = makeRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(mockGetUser).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({ id: 'u4', email: 'msg@test.com' });
  });

  test('returns 401 when x-github-token is empty string', async () => {
    const requireAuth = loadAuth();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u5', email: 'empty@test.com' } },
      error: null,
    });

    const req = makeReq({
      authHeader: 'Bearer some-token',
      headers: { 'x-github-token': '' },
    });
    const res = makeRes();

    await requireAuth(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Missing GitHub token. Please re-login.',
    });
  });

  test('returns 401 when x-github-token is not a string', async () => {
    const requireAuth = loadAuth();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u6', email: 'num@test.com' } },
      error: null,
    });

    const req = makeReq({
      authHeader: 'Bearer some-token',
      headers: { 'x-github-token': 12345 },
    });
    const res = makeRes();

    await requireAuth(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Missing GitHub token. Please re-login.',
    });
  });

  test('strips "Bearer " prefix to extract token', async () => {
    const requireAuth = loadAuth();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u7', email: 'strip@test.com' } },
      error: null,
    });

    const req = makeReq({
      authHeader: 'Bearer eyJhbGciOiJIUzI1NiJ9.real-token',
      githubToken: 'ghp_strip123',
    });
    const res = makeRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(mockGetUser).toHaveBeenCalledWith('eyJhbGciOiJIUzI1NiJ9.real-token');
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: 'u7', email: 'strip@test.com' });
  });
});
