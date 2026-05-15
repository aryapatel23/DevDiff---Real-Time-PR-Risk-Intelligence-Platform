const router = require('express').Router();
const { requireAuth } = require('../auth/middleware');
const queries = require('../db/queries');

router.get('/:projectId/:author', requireAuth, async (req, res) => {
  const project = await queries.getProjectById(req.params.projectId, req.user.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const data = await queries.getDeveloperProfile(req.params.projectId, req.params.author);
  if (!data) return res.status(404).json({ error: 'Developer not found' });

  res.json(data);
});

module.exports = router;
