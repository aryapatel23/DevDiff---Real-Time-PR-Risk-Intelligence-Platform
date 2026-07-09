const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

let supabase = null;

function getSupabaseAdmin() {
  if (supabase) return supabase;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return supabase;
}

function isNetworkTimeout(err) {
  return err?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT'
    || err?.code === 'UND_ERR_CONNECT_TIMEOUT'
    || String(err?.message || '').toLowerCase().includes('connect timeout');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getUserWithRetry(admin, token) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 500;
  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await admin.auth.getUser(token);
    } catch (err) {
      lastErr = err;
      if (!isNetworkTimeout(err)) throw err;
      if (attempt < MAX_RETRIES - 1) await sleep(RETRY_DELAY * (attempt + 1));
    }
  }
  throw lastErr;
}

async function requireAuth(req, res, next) {
  try {
    const admin = getSupabaseAdmin();

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.slice(7);
    let userResponse;
    try {
      userResponse = await getUserWithRetry(admin, token);
    } catch (err) {
      if (isNetworkTimeout(err)) {
        return res.status(503).json({
          error: 'Auth service temporarily unreachable. Please retry in a few seconds.',
          code: 'AUTH_SERVICE_TIMEOUT',
        });
      }
      throw err;
    }

    const { data: { user }, error } = userResponse;

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = { id: user.id, email: user.email };

    const githubToken = req.headers['x-github-token'];
    if (!githubToken || typeof githubToken !== 'string') {
      return res.status(401).json({ error: 'Missing GitHub token. Please re-login.' });
    }

    req.githubToken = githubToken;
    next();
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Authentication error' });
  }
}

module.exports = { requireAuth, getSupabaseAdmin };
