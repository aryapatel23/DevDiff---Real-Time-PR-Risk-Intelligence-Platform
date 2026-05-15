const fs = require('fs/promises');
const path = require('path');

function loadEnvFromFile(filePath) {
  const fsSync = require('fs');
  if (!fsSync.existsSync(filePath)) return;
  const raw = fsSync.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFromFile(path.join(__dirname, '..', '.env'));

const repo = { owner: 'facebook', repo: 'react' };
const maxPRs = Math.max(1, Math.min(200, Number(process.env.PR_LIMIT || 150)));
const DATA_DIR = path.join(__dirname, '..', 'data');
const LATEST_OUTPUT = path.join(DATA_DIR, 'pr_dataset.json');

function utcStamp() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

function parseRepos() {
  const fromEnv = process.env.GITHUB_REPOS || '';
  if (!fromEnv.trim()) {
    return [{ owner: process.env.GITHUB_OWNER || repo.owner, repo: process.env.GITHUB_REPO || repo.repo }];
  }

  // Supported formats:
  // 1) "facebook/react,nodejs/node,expressjs/express"
  // 2) JSON array: [{"owner":"facebook","repo":"react"}, ...]
  try {
    if (fromEnv.trim().startsWith('[')) {
      const parsed = JSON.parse(fromEnv);
      if (Array.isArray(parsed)) {
        const repos = parsed
          .map(x => ({ owner: String(x?.owner || '').trim(), repo: String(x?.repo || '').trim() }))
          .filter(x => x.owner && x.repo);
        if (repos.length > 0) return repos;
      }
    }
  } catch {
    // Fall through to CSV parser.
  }

  const repos = fromEnv
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
    .map(x => {
      const [owner, repoName] = x.split('/').map(y => (y || '').trim());
      return { owner, repo: repoName };
    })
    .filter(x => x.owner && x.repo);

  if (repos.length === 0) {
    return [{ owner: process.env.GITHUB_OWNER || repo.owner, repo: process.env.GITHUB_REPO || repo.repo }];
  }

  return repos;
}

function dedupeItems(items) {
  const map = new Map();
  for (const item of items) {
    const repoName = item.repo_full_name || `${item.repo_owner}/${item.repo_name}`;
    const key = `${repoName}#${item.pr_number}`;
    map.set(key, item);
  }
  return Array.from(map.values());
}

async function readJsonIfExists(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function githubHeaders() {
  const token = process.env.GITHUB_TOKEN;
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'devdiff-pr-collector',
  };

  if (token && token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  return headers;
}

async function githubRequest(url, params = {}, attempt = 1) {
  const maxAttempts = 5;

  try {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) {
      if (v !== undefined && v !== null) q.set(k, String(v));
    }
    const fullUrl = q.toString() ? `${url}?${q.toString()}` : url;

    const res = await fetch(fullUrl, {
      method: 'GET',
      headers: githubHeaders(),
    });

    if (!res.ok) {
      const text = await res.text();
      const error = new Error(`HTTP ${res.status}`);
      error.response = {
        status: res.status,
        headers: {
          'x-ratelimit-remaining': res.headers.get('x-ratelimit-remaining'),
          'x-ratelimit-reset': res.headers.get('x-ratelimit-reset'),
          'retry-after': res.headers.get('retry-after'),
        },
        data: { message: text },
      };
      throw error;
    }

    const data = await res.json();
    return { data };
  } catch (err) {
    const status = err.response?.status;
    const headers = err.response?.headers || {};

    const rateRemaining = Number(headers['x-ratelimit-remaining'] || '1');
    const rateReset = Number(headers['x-ratelimit-reset'] || '0');
    const retryAfter = Number(headers['retry-after'] || '0');

    const canRetry = attempt < maxAttempts;

    if ((status === 403 && rateRemaining === 0) && canRetry) {
      const waitMs = Math.max((rateReset * 1000) - Date.now(), 1000);
      console.warn(`[collector] Rate limit reached. Waiting ${Math.ceil(waitMs / 1000)}s before retry.`);
      await sleep(waitMs);
      return githubRequest(url, params, attempt + 1);
    }

    if ((status === 429 || status === 502 || status === 503 || status === 504) && canRetry) {
      const waitMs = Math.max(retryAfter * 1000, 2000 * attempt);
      console.warn(`[collector] Transient API error (${status}). Retrying in ${Math.ceil(waitMs / 1000)}s.`);
      await sleep(waitMs);
      return githubRequest(url, params, attempt + 1);
    }

    const message = err.response?.data?.message || err.message;
    throw new Error(`GitHub request failed (${status || 'unknown'}): ${message}`);
  }
}

async function fetchPRs(repoConfig, limit = 150) {
  const all = [];
  let page = 1;

  while (all.length < limit) {
    const perPage = Math.min(100, limit - all.length);
    const url = `https://api.github.com/repos/${repoConfig.owner}/${repoConfig.repo}/pulls`;

    const res = await githubRequest(url, {
      state: 'closed',
      sort: 'updated',
      direction: 'desc',
      per_page: perPage,
      page,
    });

    const prs = Array.isArray(res.data) ? res.data : [];
    if (prs.length === 0) break;

    all.push(...prs);
    page += 1;
  }

  return all.slice(0, limit);
}

async function fetchComments(repoConfig, prNumber) {
  const comments = [];
  let page = 1;

  while (true) {
    const url = `https://api.github.com/repos/${repoConfig.owner}/${repoConfig.repo}/pulls/${prNumber}/comments`;
    const res = await githubRequest(url, { per_page: 100, page });

    const pageItems = Array.isArray(res.data) ? res.data : [];
    if (pageItems.length === 0) break;

    comments.push(...pageItems.map(c => ({
      id: c.id,
      user: c.user?.login || null,
      path: c.path,
      position: c.position,
      line: c.line,
      side: c.side,
      body: c.body || '',
      created_at: c.created_at,
      updated_at: c.updated_at,
      html_url: c.html_url,
    })));

    page += 1;
  }

  return comments;
}

async function fetchPRFiles(repoConfig, prNumber) {
  const files = [];
  let page = 1;

  while (true) {
    const url = `https://api.github.com/repos/${repoConfig.owner}/${repoConfig.repo}/pulls/${prNumber}/files`;
    const res = await githubRequest(url, { per_page: 100, page });

    const pageItems = Array.isArray(res.data) ? res.data : [];
    if (pageItems.length === 0) break;

    files.push(...pageItems.map(f => ({
      filename: f.filename,
      patch: f.patch || null,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      changes: f.changes,
    })));

    page += 1;
  }

  return files;
}

async function fetchPRDetails(repoConfig, pr) {
  const [files, reviewComments] = await Promise.all([
    fetchPRFiles(repoConfig, pr.number),
    fetchComments(repoConfig, pr.number),
  ]);

  const additions = files.reduce((sum, f) => sum + Number(f.additions || 0), 0);
  const deletions = files.reduce((sum, f) => sum + Number(f.deletions || 0), 0);

  return {
    pr_id: pr.id,
    pr_number: pr.number,
    repo_owner: repoConfig.owner,
    repo_name: repoConfig.repo,
    repo_full_name: `${repoConfig.owner}/${repoConfig.repo}`,
    title: pr.title || '',
    body: pr.body || '',
    state: pr.state,
    merged_at: pr.merged_at,
    created_at: pr.created_at,
    updated_at: pr.updated_at,
    html_url: pr.html_url,
    author: pr.user?.login || null,
    labels: Array.isArray(pr.labels) ? pr.labels.map(l => l.name) : [],
    additions,
    deletions,
    files_changed_count: files.length,
    files,
    review_comments: reviewComments,
  };
}

async function ensureOutputDir(filePath) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

async function writeDataset(outputPath, payload) {
  await ensureOutputDir(outputPath);
  await fs.writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf8');
}

async function writeOutputs(dataset) {
  const stamp = utcStamp();
  const timestampedPath = path.join(DATA_DIR, `pr_dataset_${stamp}.json`);

  await writeDataset(timestampedPath, dataset);

  const mergeMode = String(process.env.PR_DATASET_MERGE || 'true').toLowerCase() !== 'false';
  if (!mergeMode) {
    await writeDataset(LATEST_OUTPUT, dataset);
    return { timestampedPath, latestPath: LATEST_OUTPUT, mergedCount: dataset.items.length };
  }

  const prev = await readJsonIfExists(LATEST_OUTPUT);
  const prevItems = Array.isArray(prev?.items) ? prev.items : [];
  const mergedItems = dedupeItems([...prevItems, ...dataset.items]);

  const merged = {
    generated_at: new Date().toISOString(),
    source_repos: dataset.source_repos,
    requested_limit_per_repo: dataset.requested_limit_per_repo,
    merged_from_previous: true,
    previous_count: prevItems.length,
    new_count: dataset.items.length,
    collected_count: mergedItems.length,
    items: mergedItems,
  };

  await writeDataset(LATEST_OUTPUT, merged);
  return { timestampedPath, latestPath: LATEST_OUTPUT, mergedCount: mergedItems.length };
}

async function main() {
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_TOKEN.trim()) {
    throw new Error('Missing GITHUB_TOKEN in environment.');
  }

  const repos = parseRepos();
  const detailed = [];

  for (const repoConfig of repos) {
    console.log(`[collector] Fetching up to ${maxPRs} PRs from ${repoConfig.owner}/${repoConfig.repo}...`);

    const prs = await fetchPRs(repoConfig, maxPRs);
    console.log(`[collector] Found ${prs.length} PRs in ${repoConfig.owner}/${repoConfig.repo}. Fetching details...`);

    for (let i = 0; i < prs.length; i += 1) {
      const pr = prs[i];
      try {
        const data = await fetchPRDetails(repoConfig, pr);
        detailed.push(data);
        console.log(`[collector] ${repoConfig.owner}/${repoConfig.repo} ${i + 1}/${prs.length} PR #${pr.number} collected`);
      } catch (err) {
        console.warn(`[collector] Failed ${repoConfig.owner}/${repoConfig.repo} PR #${pr.number}: ${err.message}`);
      }
    }
  }

  const dataset = {
    generated_at: new Date().toISOString(),
    source_repos: repos,
    requested_limit_per_repo: maxPRs,
    collected_count: detailed.length,
    items: detailed,
  };

  const written = await writeOutputs(dataset);
  console.log(`[collector] Timestamped dataset: ${written.timestampedPath}`);
  console.log(`[collector] Latest merged dataset: ${written.latestPath}`);
  console.log(`[collector] Latest dataset item count: ${written.mergedCount}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error(`[collector] Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  fetchPRs,
  fetchPRDetails,
  fetchComments,
};
