const router = require('express').Router();
const { requireAuth } = require('../auth/middleware');
const queries = require('../db/queries');

async function getProject(req, res) {
  const project = await queries.getProjectById(req.params.projectId, req.user.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }
  return project;
}

router.get('/:projectId/history', requireAuth, async (req, res) => {
  try {
    if (!await getProject(req, res)) return;
    res.json(await queries.getHistory(req.params.projectId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:projectId/scorecard', requireAuth, async (req, res) => {
  try {
    if (!await getProject(req, res)) return;
    res.json(await queries.getScorecard(req.params.projectId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:projectId/heatmap', requireAuth, async (req, res) => {
  try {
    if (!await getProject(req, res)) return;
    res.json(await queries.getHeatmap(req.params.projectId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:projectId/feedback-stats', requireAuth, async (req, res) => {
  try {
    if (!await getProject(req, res)) return;
    res.json(await queries.getFeedbackStats(req.params.projectId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:projectId/findings/:prId', requireAuth, async (req, res) => {
  try {
    if (!await getProject(req, res)) return;
    res.json(await queries.getFindingsByPR(req.params.prId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/findings/:id/fp', requireAuth, async (req, res) => {
  try {
    const finding = await queries.getFindingByIdForOwner(req.params.id, req.user.id);
    if (!finding) return res.status(404).json({ error: 'Finding not found' });

    const updated = await queries.incrementFalsePositive(req.params.id);
    const prRiskScore = await queries.recalculatePRRiskScore(finding.pr_id);
    if (finding.author) {
      await queries.recomputeProfileStats(finding.project_id, finding.author);
      await queries.recalculateWeights(finding.project_id, finding.author);
    }

    const level = Number(updated?.false_positive || 0);
    const state = level >= 2 ? 'ignored' : level === 1 ? 'low_priority' : 'active';
    res.json({ ok: true, false_positive: level, state, prRiskScore });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/findings/:id/fp', requireAuth, async (req, res) => {
  try {
    const desired = Boolean(req.body?.falsePositive);
    const finding = await queries.getFindingByIdForOwner(req.params.id, req.user.id);
    if (!finding) return res.status(404).json({ error: 'Finding not found' });

    await queries.setFalsePositive(req.params.id, desired);
    const prRiskScore = await queries.recalculatePRRiskScore(finding.pr_id);
    if (finding.author) {
      await queries.recomputeProfileStats(finding.project_id, finding.author);
      await queries.recalculateWeights(finding.project_id, finding.author);
    }

    res.json({ ok: true, false_positive: desired ? 1 : 0, prRiskScore });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
