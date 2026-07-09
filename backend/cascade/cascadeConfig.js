/**
 * cascadeConfig.js — Model cascade configuration
 *
 * Defines the model tiers, quality gates, and budget constraints
 * for the CascadeFlow LLM routing system.
 *
 * Design principle: Free model handles 60-70% of chunks.
 * Only complex logic bugs escalate to paid model.
 */

require('dotenv').config();

const MODELS = {
  // Tier 1: Free / cheap model (handles simple reviews)
  drafter: {
    name: 'qwen/qwen3-32b',
    provider: 'groq',
    costPer1kTokens: 0.0,
    maxTokens: 1024,
    temperature: 0.2,
    timeout: 12000,
    description: 'Free tier — handles straightforward code reviews',
  },
  // Tier 2: Paid model (complex logic only)
  verifier: {
    name: 'llama-3.3-70b-versatile',
    provider: 'groq',
    costPer1kTokens: 0.00059,
    maxTokens: 1024,
    temperature: 0.2,
    timeout: 15000,
    description: 'Paid tier — complex logic bug detection',
  },
};

const QUALITY_GATE = {
  threshold: parseFloat(process.env.CASCADEFLOW_QUALITY_THRESHOLD || '0.7'),
  minResponseLength: 10,
  requireJsonArray: true,
};

const BUDGET = {
  maxPerAnalysis: parseFloat(process.env.CASCADEFLOW_BUDGET_PER_ANALYSIS || '0.10'),
  maxPerChunk: parseFloat(process.env.CASCADEFLOW_BUDGET_PER_CHUNK || '0.02'),
  alertThreshold: 0.8,
};

const RETRY = {
  maxRetries: 2,
  backoffMs: 500,
  backoffMultiplier: 2,
};

function getModelConfig(tier) {
  return MODELS[tier] || MODELS.drafter;
}

function shouldEscalate(qualityScore, chunkComplexity) {
  if (qualityScore < QUALITY_GATE.threshold) return true;
  if (chunkComplexity > 0.8 && qualityScore < 0.85) return true;
  return false;
}

function estimateCost(model, tokenCount) {
  return (tokenCount / 1000) * model.costPer1kTokens;
}

module.exports = {
  MODELS,
  QUALITY_GATE,
  BUDGET,
  RETRY,
  getModelConfig,
  shouldEscalate,
  estimateCost,
};
