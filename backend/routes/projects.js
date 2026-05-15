const router = require('express').Router();
const { requireAuth } = require('../auth/middleware');
const queries = require('../db/queries');
const { startHistoricalImport } = require('../projects/importer');

function normalizeRepoInput(input) {
  const value = String(input || '').trim();
  if (!value) return null;

  if (/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(value)) {
    return { githubRepo: value, isGithub: true };
  }

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (host === 'github.com' || host === 'www.github.com') {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return { githubRepo: `${parts[0]}/${parts[1].replace(/\.git$/, '')}`, isGithub: true };
      }
    }
    return { githubRepo: value, isGithub: false };
  } catch {
    return null;
  }
}

router.get('/', requireAuth, async (req, res) => {
  try {
    res.json(await queries.getProjectsByOwner(req.user.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { name, github_repo, description, is_private } = req.body || {};
  if (!name || !github_repo) return res.status(400).json({ error: 'name and github_repo required' });

  const normalized = normalizeRepoInput(github_repo);
  if (!normalized) return res.status(400).json({ error: 'Enter owner/repo, GitHub URL, or repository URL' });

  try {
    const project = await queries.createProject({
      owner_id: req.user.id,
      name,
      github_repo: normalized.githubRepo,
      description,
      is_private: Boolean(is_private),
      import_status: normalized.isGithub ? 'pending' : 'done',
      import_count: 0,
    });

    if (normalized.isGithub) {
      const githubToken = req.githubToken;
      setImmediate(() => startHistoricalImport(project.id, normalized.githubRepo, githubToken, 30));
    }

    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const project = await queries.getProjectById(req.params.id, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const deleted = await queries.deleteProject(req.params.id, req.user.id);
    if (!deleted) return res.status(404).json({ error: 'Project not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
