const router = require('express').Router();
const { requireAuth } = require('../auth/middleware');
const { listUserRepos } = require('../github/repoLister');
const pool = require('../db/db');

router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM user_profiles WHERE id=$1', [req.user.id]);
    res.json({ user: req.user, profile: result.rows[0] || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/repos', requireAuth, async (req, res) => {
  try {
    const repos = await listUserRepos(req.githubToken);
    res.json(repos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
