const axios = require('axios');

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
  };
}

function parsePRUrl(prUrl) {
  const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) throw new Error(`Invalid GitHub PR URL: ${prUrl}`);
  return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) };
}

async function fetchPRMeta(owner, repo, number, githubToken) {
  const res = await axios.get(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`,
    { headers: githubHeaders(githubToken), timeout: 15000 }
  );
  return {
    author: res.data.user.login,
    title: res.data.title,
    body: res.data.body || '',
    head: res.data.head?.sha || '',
  };
}

async function fetchPRFiles(owner, repo, number, githubToken) {
  const res = await axios.get(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${number}/files`,
    { headers: githubHeaders(githubToken), timeout: 20000 }
  );

  return res.data
    .filter(f => f.patch)
    .map(f => ({
      filename: f.filename,
      patch: f.patch,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
    }));
}

async function fetchIssueText(issueUrl, githubToken) {
  if (!issueUrl) return null;
  const match = issueUrl.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
  if (!match) return null;

  const [, owner, repo, number] = match;
  const res = await axios.get(
    `https://api.github.com/repos/${owner}/${repo}/issues/${number}`,
    { headers: githubHeaders(githubToken), timeout: 15000 }
  );

  return `${res.data.title}\n${res.data.body || ''}`;
}

async function fetchMergedPRs(owner, repo, limit, githubToken) {
  const res = await axios.get(
    `https://api.github.com/repos/${owner}/${repo}/pulls`,
    {
      headers: githubHeaders(githubToken),
      params: { state: 'closed', per_page: limit, sort: 'updated', direction: 'desc' },
      timeout: 20000,
    }
  );
  return res.data.filter(pr => pr.merged_at);
}

module.exports = { parsePRUrl, fetchPRMeta, fetchPRFiles, fetchIssueText, fetchMergedPRs };
