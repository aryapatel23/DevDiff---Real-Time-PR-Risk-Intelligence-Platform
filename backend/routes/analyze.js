const router = require('express').Router();
const { requireAuth } = require('../auth/middleware');
const { v4: uuid } = require('uuid');
const queries = require('../db/queries');
const { analyzePR } = require('../analysis/pipeline');

const jobs = new Map();

router.post('/', requireAuth, async (req, res) => {
  const { prUrl, ticketUrl, projectId } = req.body || {};
  if (!prUrl) return res.status(400).json({ error: 'prUrl is required' });
  if (!projectId) return res.status(400).json({ error: 'projectId is required' });

  const project = await queries.getProjectById(projectId, req.user.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const repoMatch = prUrl.match(/github\.com\/([^/]+\/[^/]+)\/pull\//);
  const projectRepoLooksCanonical = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(project.github_repo || '');
  if (projectRepoLooksCanonical && repoMatch && repoMatch[1] !== project.github_repo) {
    return res.status(400).json({
      error: `PR is from ${repoMatch[1]} but project uses ${project.github_repo}`,
    });
  }

  const jobId = uuid();
  jobs.set(jobId, { status: 'pending', findings: [], clients: new Set() });
  res.json({ jobId, status: 'processing' });

  const githubToken = req.githubToken;
  setImmediate(async () => {
    const job = jobs.get(jobId);
    try {
      const summary = await analyzePR(prUrl, ticketUrl, projectId, githubToken, (event) => {
        job.findings.push(event);
        for (const client of job.clients) {
          if (client.readyState === 1) client.send(JSON.stringify(event));
        }
      });
      job.status = 'complete';
      job.summary = summary;
      for (const client of job.clients) {
        if (client.readyState === 1) client.send(JSON.stringify({ event: 'complete', data: summary }));
      }
    } catch (err) {
      job.status = 'error';
      for (const client of job.clients) {
        if (client.readyState === 1) client.send(JSON.stringify({ event: 'error', data: { message: err.message } }));
      }
    }
  });
});

router.get('/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({ status: job.status, findingsCount: job.findings.length, summary: job.summary });
});

module.exports = { router, jobs };
