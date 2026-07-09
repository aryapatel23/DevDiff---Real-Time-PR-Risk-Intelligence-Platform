/**
 * auditTrail.js — CascadeFlow audit trail logging
 *
 * Logs every LLM routing decision to PostgreSQL for:
 * - Cost tracking and optimization
 * - Model performance comparison
 * - Debugging and compliance
 *
 * Design: Append-only, idempotent, minimal overhead.
 */

const pool = require('../db/db');

/**
 * Log an LLM routing decision
 */
async function logDecision(data) {
  const sql = `
    INSERT INTO public.audit_trail (
      project_id, pr_id, chunk_filename, chunk_function,
      model_used, model_cost, latency_ms, quality_score,
      escalated, escalation_reason, tokens_used,
      step_number, total_steps
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    RETURNING id, created_at
  `;

  try {
    const result = await pool.query(sql, [
      data.projectId || null,
      data.prId || null,
      data.filename || null,
      data.functionName || null,
      data.modelUsed || 'unknown',
      data.modelCost || 0,
      data.latencyMs || 0,
      data.qualityScore || 0,
      data.escalated || false,
      data.escalationReason || null,
      data.tokensUsed || 0,
      data.stepNumber || 0,
      data.totalSteps || 0,
    ]);

    return {
      id: result.rows[0]?.id,
      createdAt: result.rows[0]?.created_at,
      ...data,
    };
  } catch (err) {
    // Don't crash pipeline for audit logging failures
    console.error('[auditTrail] Failed to log decision:', err.message);
    return { id: null, ...data };
  }
}

/**
 * Get cost summary for a project
 */
async function getCostSummary(projectId) {
  const sql = `
    SELECT
      COUNT(*) as total_calls,
      SUM(CASE WHEN model_cost = 0 THEN 1 ELSE 0 END) as free_calls,
      SUM(CASE WHEN model_cost > 0 THEN 1 ELSE 0 END) as paid_calls,
      SUM(model_cost) as total_cost,
      AVG(latency_ms)::INTEGER as avg_latency_ms,
      AVG(quality_score)::REAL as avg_quality,
      SUM(CASE WHEN escalated THEN 1 ELSE 0 END) as escalation_count
    FROM public.audit_trail
    WHERE project_id = $1
  `;

  try {
    const result = await pool.query(sql, [projectId]);
    const row = result.rows[0];

    const totalCalls = parseInt(row.total_calls) || 0;
    const freeCalls = parseInt(row.free_calls) || 0;
    const paidCalls = parseInt(row.paid_calls) || 0;
    const totalCost = parseFloat(row.total_cost) || 0;
    const escalationCount = parseInt(row.escalation_count) || 0;

    // Estimate cost without cascade (all paid model)
    const estimatedWithoutCascade = totalCalls * 0.00059;
    const savingsPercent = estimatedWithoutCascade > 0
      ? Math.round((1 - totalCost / estimatedWithoutCascade) * 100)
      : 0;

    return {
      totalCalls,
      freeCalls,
      paidCalls,
      totalCost: Math.round(totalCost * 1000000) / 1000000,
      estimatedWithoutCascade: Math.round(estimatedWithoutCascade * 1000000) / 1000000,
      savingsPercent,
      avgLatencyMs: parseInt(row.avg_latency_ms) || 0,
      avgQuality: Math.round((parseFloat(row.avg_quality) || 0) * 100) / 100,
      escalationRate: totalCalls > 0 ? Math.round((escalationCount / totalCalls) * 100) : 0,
    };
  } catch (err) {
    console.error('[auditTrail] Failed to get cost summary:', err.message);
    return {
      totalCalls: 0, freeCalls: 0, paidCalls: 0,
      totalCost: 0, estimatedWithoutCascade: 0, savingsPercent: 0,
      avgLatencyMs: 0, avgQuality: 0, escalationRate: 0,
    };
  }
}

/**
 * Get recent routing decisions
 */
async function getRecentDecisions(projectId, limit = 20) {
  const sql = `
    SELECT id, chunk_filename, chunk_function, model_used, model_cost,
           latency_ms, quality_score, escalated, escalation_reason,
           created_at
    FROM public.audit_trail
    WHERE project_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `;

  try {
    const result = await pool.query(sql, [projectId, limit]);
    return result.rows;
  } catch (err) {
    console.error('[auditTrail] Failed to get recent decisions:', err.message);
    return [];
  }
}

/**
 * Get model distribution for a project
 */
async function getModelDistribution(projectId) {
  const sql = `
    SELECT
      model_used,
      COUNT(*) as count,
      SUM(model_cost) as total_cost,
      AVG(quality_score)::REAL as avg_quality,
      AVG(latency_ms)::INTEGER as avg_latency
    FROM public.audit_trail
    WHERE project_id = $1
    GROUP BY model_used
    ORDER BY count DESC
  `;

  try {
    const result = await pool.query(sql, [projectId]);
    return result.rows;
  } catch (err) {
    console.error('[auditTrail] Failed to get model distribution:', err.message);
    return [];
  }
}

module.exports = {
  logDecision,
  getCostSummary,
  getRecentDecisions,
  getModelDistribution,
};
