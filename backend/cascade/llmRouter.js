/**
 * llmRouter.js — CascadeFlow LLM routing
 *
 * Routes LLM code review calls through a model cascade:
 * 1. Try free model first (qwen3-32b)
 * 2. Check response quality
 * 3. If quality low, escalate to paid model (llama-70b)
 * 4. Log all decisions for audit trail
 *
 * Design: Resilient, cost-aware, auditable.
 */

const axios = require('axios');
const { MODELS, QUALITY_GATE, BUDGET, RETRY, getModelConfig, shouldEscalate, estimateCost } = require('./cascadeConfig');
const auditTrail = require('./auditTrail');

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Calculate quality score of an LLM response
 * based on structure, length, and content relevance.
 */
function calculateQuality(responseText, expectedFormat) {
  if (!responseText || typeof responseText !== 'string') return 0;

  const trimmed = responseText.trim();

  // Check if response is a valid JSON array (expected format)
  if (expectedFormat === 'json-array') {
    try {
      const cleaned = trimmed.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) return 0.3;

      // Quality based on array structure
      let score = 0.5;
      if (parsed.length > 0) score += 0.2;
      if (parsed.every(f => f.message && f.severity)) score += 0.2;
      if (parsed.every(f => typeof f.line === 'number')) score += 0.1;
      return Math.min(1.0, score);
    } catch {
      return 0.1;
    }
  }

  // Default quality check
  if (trimmed.length < QUALITY_GATE.minResponseLength) return 0.2;
  return 0.7;
}

/**
 * Call Groq API with retry logic
 */
async function callGroq(model, messages, options = {}) {
  const timeout = options.timeout || model.timeout;
  let lastError;

  for (let attempt = 0; attempt <= RETRY.maxRetries; attempt++) {
    try {
      const startTime = Date.now();
      const res = await axios.post(
        GROQ_API,
        {
          model: model.name,
          max_tokens: model.maxTokens,
          temperature: model.temperature,
          messages,
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout,
        }
      );

      const latencyMs = Date.now() - startTime;
      const content = res.data.choices?.[0]?.message?.content || '';
      const usage = res.data.usage || {};
      const totalTokens = (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);

      return {
        content,
        latencyMs,
        totalTokens,
        model: model.name,
      };
    } catch (err) {
      lastError = err;
      if (attempt < RETRY.maxRetries) {
        const delay = RETRY.backoffMs * Math.pow(RETRY.backoffMultiplier, attempt);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Route an LLM review call through the cascade.
 *
 * @param {string} prompt - The code review prompt
 * @param {string} systemPrompt - System instructions
 * @param {object} metadata - Context: filename, function, projectId, etc.
 * @returns {{ findings: Array, audit: object }}
 */
async function routeReview(prompt, systemPrompt, metadata = {}) {
  const startTime = Date.now();
  const audit = {
    filename: metadata.filename || 'unknown',
    functionName: metadata.functionName || 'unknown',
    projectId: metadata.projectId,
    prId: metadata.prId,
    stepNumber: metadata.stepNumber || 0,
    totalSteps: metadata.totalSteps || 0,
  };

  // Step 1: Try free model (drafter)
  const drafter = getModelConfig('drafter');
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ];

  try {
    const drafterResult = await callGroq(drafter, messages);
    const quality = calculateQuality(drafterResult.content, 'json-array');

    // Check quality gate
    if (!shouldEscalate(quality, metadata.complexity || 0.5)) {
      // Quality is good enough — use drafter result
      const cost = estimateCost(drafter, drafterResult.totalTokens);

      const auditEntry = await auditTrail.logDecision({
        ...audit,
        modelUsed: drafter.name,
        modelCost: cost,
        latencyMs: drafterResult.latencyMs,
        qualityScore: quality,
        escalated: false,
        escalationReason: null,
        tokensUsed: drafterResult.totalTokens,
      });

      return {
        content: drafterResult.content,
        audit: auditEntry,
      };
    }

    // Quality too low — escalate to verifier
    const verifier = getModelConfig('verifier');
    const verifierResult = await callGroq(verifier, messages);
    const verifierQuality = calculateQuality(verifierResult.content, 'json-array');
    const cost = estimateCost(verifier, verifierResult.totalTokens);

    const auditEntry = await auditTrail.logDecision({
      ...audit,
      modelUsed: verifier.name,
      modelCost: cost,
      latencyMs: drafterResult.latencyMs + verifierResult.latencyMs,
      qualityScore: verifierQuality,
      escalated: true,
      escalationReason: `Drafter quality ${quality.toFixed(2)} < ${QUALITY_GATE.threshold}`,
      tokensUsed: drafterResult.totalTokens + verifierResult.totalTokens,
    });

    return {
      content: verifierResult.content,
      audit: auditEntry,
    };

  } catch (err) {
    // Both models failed — log and return empty
    const auditEntry = await auditTrail.logDecision({
      ...audit,
      modelUsed: 'none',
      modelCost: 0,
      latencyMs: Date.now() - startTime,
      qualityScore: 0,
      escalated: false,
      escalationReason: `Error: ${err.message}`,
      tokensUsed: 0,
    });

    return {
      content: '[]',
      audit: auditEntry,
      error: err.message,
    };
  }
}

module.exports = { routeReview, calculateQuality, callGroq };
