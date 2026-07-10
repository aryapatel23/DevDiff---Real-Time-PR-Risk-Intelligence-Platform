const pool = require('./db');

const queries = {
  async createProject({ owner_id, name, github_repo, description, is_private, import_status, import_count }) {
    const res = await pool.query(
      `INSERT INTO public.projects (owner_id, name, github_repo, description, is_private, import_status, import_count)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6,'pending'),COALESCE($7,0)) RETURNING *`,
      [owner_id, name, github_repo, description || null, is_private || false, import_status || null, import_count ?? null]
    );
    return res.rows[0];
  },

  async getProjectsByOwner(owner_id) {
    const res = await pool.query(
      `SELECT p.*,
        (SELECT COUNT(*) FROM public.pull_requests WHERE project_id=p.id) AS pr_count,
        (SELECT COUNT(*) FROM public.pull_requests WHERE project_id=p.id AND is_historical=false) AS scanned_pr_count,
        (SELECT COUNT(*) FROM public.pull_requests WHERE project_id=p.id AND is_historical=true) AS historical_pr_count,
        (SELECT COUNT(*) FROM public.findings f JOIN public.pull_requests pr ON pr.id=f.pr_id WHERE f.project_id=p.id AND pr.is_historical=false) AS finding_count
             FROM public.projects p WHERE p.owner_id=$1 ORDER BY p.created_at DESC`,
      [owner_id]
    );
    return res.rows;
  },

  async getProjectById(id, owner_id) {
    const res = await pool.query(
      `SELECT * FROM public.projects WHERE id=$1 AND owner_id=$2`,
      [id, owner_id]
    );
    return res.rows[0] || null;
  },

  async deleteProject(id, owner_id) {
    const res = await pool.query(
      `DELETE FROM public.projects WHERE id=$1 AND owner_id=$2 RETURNING id`,
      [id, owner_id]
    );
    return Boolean(res.rows[0]);
  },

  async updateProjectImportStatus(project_id, status, count) {
    await pool.query(
      `UPDATE public.projects SET import_status=$1, import_count=$2 WHERE id=$3`,
      [status, count, project_id]
    );
  },

  async updateProjectAnalysisStatus(project_id, status, count, total) {
    await pool.query(
      `UPDATE public.projects SET analysis_status=$1, analysis_count=$2, analysis_total=$3 WHERE id=$4`,
      [status, count, total || 0, project_id]
    );
  },

  async getUnanalyzedHistoricalPRs(project_id, limit) {
    const res = await pool.query(
      `SELECT id, pr_url, pr_number, pr_title, author
       FROM public.pull_requests
       WHERE project_id=$1 AND is_historical=true AND status='imported'
       ORDER BY pr_number DESC
       LIMIT $2`,
      [project_id, limit]
    );
    return res.rows;
  },

  async insertPR({ project_id, pr_url, repo, pr_number, pr_title, author, ticket_url, files_count, is_historical, status, risk_score }) {
    const res = await pool.query(
      `INSERT INTO public.pull_requests
         (project_id, pr_url, repo, pr_number, pr_title, author, ticket_url, files_count, status, is_historical)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,'processing'),$10) RETURNING id`,
      [project_id, pr_url, repo, pr_number, pr_title || null, author, ticket_url || null, files_count, status || null, is_historical || false]
    );
    if (risk_score !== undefined && risk_score !== null) {
      await pool.query('UPDATE public.pull_requests SET risk_score=$1 WHERE id=$2', [risk_score, res.rows[0].id]);
    }
    return res.rows[0].id;
  },

  async updatePRStatus({ id, status, risk_score }) {
    await pool.query(
      `UPDATE public.pull_requests SET status=$1, risk_score=$2 WHERE id=$3`,
      [status, risk_score, id]
    );
  },

  async getHistory(project_id) {
    const res = await pool.query(
      `SELECT *,
         CASE WHEN is_historical AND status='imported' THEN 'imported' ELSE 'scanned' END AS source_type,
         CASE WHEN status='complete' THEN risk_score ELSE NULL END AS display_score
       FROM public.pull_requests WHERE project_id=$1 ORDER BY analyzed_at DESC LIMIT 20`,
      [project_id]
    );
    return res.rows;
  },

  async insertFinding({ project_id, pr_id, filename, line_number, rule_name, severity, confidence, message, fix_hint, author, false_positive }) {
    const res = await pool.query(
      `INSERT INTO public.findings (project_id, pr_id, filename, line_number, rule_name, severity, confidence, message, fix_hint, author, false_positive)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11,0)) RETURNING id`,
      [project_id, pr_id, filename, line_number, rule_name, severity, confidence, message, fix_hint || null, author, false_positive ?? 0]
    );
    return res.rows[0]?.id;
  },

  async getFindingsByPR(pr_id) {
    const res = await pool.query(
      `SELECT * FROM public.findings WHERE pr_id=$1 ORDER BY false_positive ASC, severity DESC, confidence DESC`,
      [pr_id]
    );
    return res.rows;
  },

  async markFalsePositive(id) {
    await pool.query('UPDATE public.findings SET false_positive=1 WHERE id=$1', [id]);
  },

  async getFindingByIdForOwner(id, owner_id) {
    const res = await pool.query(
      `SELECT f.id, f.project_id, f.pr_id, f.author, f.false_positive
       FROM public.findings f
       JOIN public.projects p ON p.id=f.project_id
       WHERE f.id=$1 AND p.owner_id=$2`,
      [id, owner_id]
    );
    return res.rows[0] || null;
  },

  async setFalsePositive(id, falsePositive) {
    const normalized = falsePositive ? 1 : 0;
    await pool.query('UPDATE public.findings SET false_positive=$1 WHERE id=$2', [normalized, id]);
  },

  async incrementFalsePositive(id) {
    const res = await pool.query(
      `UPDATE public.findings
       SET false_positive = LEAST(2, COALESCE(false_positive, 0) + 1)
       WHERE id=$1
       RETURNING id, project_id, pr_id, author, false_positive`,
      [id]
    );
    return res.rows[0] || null;
  },

  async getSuppressionMap(project_id, author) {
    const res = await pool.query(
      `SELECT filename, rule_name, MAX(false_positive) AS suppression_level
       FROM public.findings
       WHERE project_id=$1 AND author=$2 AND false_positive > 0
       GROUP BY filename, rule_name`,
      [project_id, author]
    );

    const map = new Map();
    for (const row of res.rows) {
      map.set(`${row.filename}::${row.rule_name}`, Number(row.suppression_level || 0));
    }
    return map;
  },

  async recalculatePRRiskScore(pr_id) {
    const res = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE severity='critical' AND false_positive=0) AS critical,
         COUNT(*) FILTER (WHERE severity='warning'  AND false_positive=0) AS warning
       FROM public.findings
       WHERE pr_id=$1`,
      [pr_id]
    );

    const critical = Number(res.rows[0]?.critical || 0);
    const warning = Number(res.rows[0]?.warning || 0);
    const riskScore = Math.min(100, critical * 6 + warning * 2);

    await pool.query('UPDATE public.pull_requests SET risk_score=$1 WHERE id=$2', [riskScore, pr_id]);
    return riskScore;
  },

  async recomputeProfileStats(project_id, github_login) {
    const prsRes = await pool.query(
      `SELECT COUNT(*) AS prs
       FROM public.pull_requests
       WHERE project_id=$1 AND author=$2 AND is_historical=false`,
      [project_id, github_login]
    );

    const findingsRes = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE false_positive=0) AS total,
         COUNT(*) FILTER (WHERE severity='critical' AND false_positive=0) AS critical,
         COUNT(*) FILTER (WHERE severity='warning'  AND false_positive=0) AS warning
       FROM public.findings
       WHERE project_id=$1 AND author=$2`,
      [project_id, github_login]
    );

    await pool.query(
      `UPDATE public.developer_profiles
       SET total_prs_analyzed=$3,
           total_findings=$4,
           total_critical=$5,
           total_warnings=$6
       WHERE project_id=$1 AND github_login=$2`,
      [
        project_id,
        github_login,
        Number(prsRes.rows[0]?.prs || 0),
        Number(findingsRes.rows[0]?.total || 0),
        Number(findingsRes.rows[0]?.critical || 0),
        Number(findingsRes.rows[0]?.warning || 0),
      ]
    );
  },

  async getFeedbackStats(project_id) {
    const totalsRes = await pool.query(
      `SELECT
         COUNT(*) AS total_findings,
         COUNT(*) FILTER (WHERE false_positive>0) AS false_positive_count,
        COUNT(*) FILTER (WHERE false_positive=1) AS low_priority_count,
        COUNT(*) FILTER (WHERE false_positive>=2) AS ignored_count,
         ROUND(
           CASE WHEN COUNT(*) = 0 THEN 0
           ELSE (COUNT(*) FILTER (WHERE false_positive>0) * 100.0 / COUNT(*))
           END,
           2
         ) AS false_positive_rate
       FROM public.findings f
       JOIN public.pull_requests pr ON pr.id=f.pr_id
       WHERE f.project_id=$1 AND pr.is_historical=false`,
      [project_id]
    );

    const topRulesRes = await pool.query(
      `SELECT
         rule_name,
         COUNT(*) AS total_hits,
         COUNT(*) FILTER (WHERE false_positive>0) AS false_positive_hits
       FROM public.findings f
       JOIN public.pull_requests pr ON pr.id=f.pr_id
       WHERE f.project_id=$1 AND pr.is_historical=false
       GROUP BY rule_name
       ORDER BY false_positive_hits DESC, total_hits DESC
       LIMIT 5`,
      [project_id]
    );

    const profileRes = await pool.query(
      `SELECT MAX(weights_updated_at) AS last_profile_update
       FROM public.developer_profiles
       WHERE project_id=$1`,
      [project_id]
    );

    return {
      total_findings: Number(totalsRes.rows[0]?.total_findings || 0),
      false_positive_count: Number(totalsRes.rows[0]?.false_positive_count || 0),
      low_priority_count: Number(totalsRes.rows[0]?.low_priority_count || 0),
      ignored_count: Number(totalsRes.rows[0]?.ignored_count || 0),
      false_positive_rate: Number(totalsRes.rows[0]?.false_positive_rate || 0),
      last_profile_update: profileRes.rows[0]?.last_profile_update || null,
      top_feedback_rules: topRulesRes.rows.map((row) => ({
        rule_name: row.rule_name,
        total_hits: Number(row.total_hits || 0),
        false_positive_hits: Number(row.false_positive_hits || 0),
      })),
    };
  },

  async getScorecard(project_id) {
    const res = await pool.query(
      `WITH dev_stats AS (
         SELECT f.author,
           COUNT(DISTINCT pr.id) AS pr_count,
           COUNT(*) FILTER (WHERE f.severity='critical' AND f.false_positive=0) AS critical_count,
           COUNT(*) FILTER (WHERE f.severity='warning'  AND f.false_positive=0) AS warning_count
         FROM public.findings f
         JOIN public.pull_requests pr ON pr.id=f.pr_id
         WHERE f.project_id=$1 AND f.created_at > NOW() - INTERVAL '30 days' AND pr.is_historical=false
         GROUP BY f.author
       )
       SELECT author, pr_count, critical_count, warning_count,
         GREATEST(100
           - ROUND(critical_count * 4.0 / GREATEST(pr_count, 1))
           - ROUND(warning_count * 1.0 / GREATEST(pr_count, 1)), 0) AS score
       FROM dev_stats ORDER BY score DESC`,
      [project_id]
    );
    return res.rows;
  },

  async getHeatmap(project_id) {
    const res = await pool.query(
      `SELECT filename,
         COUNT(*) FILTER (WHERE severity='critical' AND false_positive=0) AS critical,
         COUNT(*) FILTER (WHERE severity='warning'  AND false_positive=0) AS warning,
         COUNT(*) FILTER (WHERE severity='info'     AND false_positive=0) AS info,
         COUNT(*) FILTER (WHERE false_positive=0) AS total
      FROM public.findings f
      JOIN public.pull_requests pr ON pr.id=f.pr_id
      WHERE f.project_id=$1 AND pr.is_historical=false
       GROUP BY filename ORDER BY total DESC LIMIT 15`,
      [project_id]
    );
    return res.rows;
  },

  async getAuthorPatterns(project_id, author) {
    const res = await pool.query(
      `SELECT rule_name, count FROM public.developer_patterns
       WHERE project_id=$1 AND author=$2 ORDER BY count DESC`,
      [project_id, author]
    );
    return res.rows;
  },

  async upsertPattern(project_id, author, rule_name) {
    await pool.query(
      `INSERT INTO public.developer_patterns (project_id, author, rule_name, count, last_seen)
       VALUES ($1,$2,$3,1,NOW())
       ON CONFLICT (project_id, author, rule_name)
      DO UPDATE SET count = public.developer_patterns.count + 1, last_seen = NOW()`,
      [project_id, author, rule_name]
    );
  },

  async getOrCreateProfile(project_id, github_login) {
    let res = await pool.query(
      `SELECT * FROM public.developer_profiles WHERE project_id=$1 AND github_login=$2`,
      [project_id, github_login]
    );
    if (res.rows.length > 0) return { profile: res.rows[0], isNew: false };

    // Check if project exists before inserting (avoids FK violation if project was deleted)
    const projCheck = await pool.query('SELECT id FROM public.projects WHERE id=$1', [project_id]);
    if (projCheck.rows.length === 0) {
      throw new Error(`Project ${project_id} no longer exists`);
    }

    res = await pool.query(
      `INSERT INTO public.developer_profiles (project_id, github_login) VALUES ($1,$2) RETURNING *`,
      [project_id, github_login]
    );
    return { profile: res.rows[0], isNew: true };
  },

  async updateProfileStats(project_id, github_login, { critical, warning, info }) {
    await pool.query(
      `UPDATE public.developer_profiles
       SET total_prs_analyzed=total_prs_analyzed+1,
           total_findings=total_findings+$3,
           total_critical=total_critical+$4,
           total_warnings=total_warnings+$5
       WHERE project_id=$1 AND github_login=$2`,
      [project_id, github_login, critical + warning + info, critical, warning]
    );
  },

  async recalculateWeights(project_id, github_login) {
    const res = await pool.query(
      `SELECT rule_name,
         COUNT(*) AS hit_count,
        COUNT(*) FILTER (WHERE false_positive>0) AS fp_count
      FROM public.findings WHERE project_id=$1 AND author=$2 GROUP BY rule_name`,
      [project_id, github_login]
    );
    if (res.rows.length === 0) return;

    const rows = res.rows;
    const avg = rows.reduce((s, r) => s + parseInt(r.hit_count, 10), 0) / rows.length;
    const weights = {};
    const thresholds = {};

    for (const row of rows) {
      const hits = parseInt(row.hit_count, 10);
      const fps = parseInt(row.fp_count, 10);
      const fpRate = hits > 0 ? fps / hits : 0;
      const weight = Math.max(0.3, Math.min(2.5, (avg > 0 ? hits / avg : 1) * (1 - fpRate * 0.5)));
      weights[row.rule_name] = Math.round(weight * 100) / 100;

      let threshold = 65;
      if (hits >= 3) threshold -= 10;
      if (fpRate > 0.3) threshold += 15;
      thresholds[row.rule_name] = Math.max(40, Math.min(85, threshold));
    }

    await pool.query(
      `UPDATE public.developer_profiles
       SET rule_weights=$1, rule_thresholds=$2, weights_updated_at=NOW()
       WHERE project_id=$3 AND github_login=$4`,
      [JSON.stringify(weights), JSON.stringify(thresholds), project_id, github_login]
    );
  },

  async getDeveloperProfile(project_id, github_login) {
    const profileRes = await pool.query(
      `SELECT * FROM public.developer_profiles WHERE project_id=$1 AND github_login=$2`,
      [project_id, github_login]
    );
    if (!profileRes.rows[0]) return null;

    const prsRes = await pool.query(
      `SELECT id, pr_url, pr_number, pr_title, risk_score, analyzed_at
      FROM public.pull_requests WHERE project_id=$1 AND author=$2 AND is_historical=false
       ORDER BY analyzed_at DESC LIMIT 10`,
      [project_id, github_login]
    );

    const rulesRes = await pool.query(
      `SELECT rule_name, COUNT(*) AS total,
         COUNT(*) FILTER (WHERE severity='critical') AS critical
      FROM public.findings f
      JOIN public.pull_requests pr ON pr.id=f.pr_id
      WHERE f.project_id=$1 AND f.author=$2 AND f.false_positive=0 AND pr.is_historical=false
       GROUP BY rule_name ORDER BY total DESC LIMIT 8`,
      [project_id, github_login]
    );

    return { profile: profileRes.rows[0], recent_prs: prsRes.rows, top_rules: rulesRes.rows };
  },

  async getDangerZoneFiles(project_id) {
    const res = await pool.query(
      `SELECT filename FROM public.findings WHERE project_id=$1 GROUP BY filename HAVING COUNT(*)>=5`,
      [project_id]
    );
    return new Set(res.rows.map(r => r.filename));
  },
};

module.exports = queries;
