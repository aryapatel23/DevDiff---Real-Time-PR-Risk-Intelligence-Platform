/**
 * logicReviewer.js — CascadeFlow version
 *
 * Routes LLM code review through CascadeFlow model cascade:
 * 1. Try free model first (qwen3-32b)
 * 2. Quality gate: if score < 0.7, escalate to paid model (llama-70b)
 * 3. Log every decision for audit trail
 *
 * Finds: assignment in conditional, off-by-one, wrong return,
 *        dead code, missing edge case, race conditions.
 * Does NOT find: SQL injection, XSS, eval, secrets — rule engine handles those.
 */

const { routeReview } = require('../cascade/llmRouter');
require('dotenv').config();

const SYSTEM = `You are a senior engineer doing a focused code review.
Find LOGIC BUGS and CODE QUALITY ISSUES only.
Do NOT report: SQL injection, XSS, eval(), secrets, CORS — another tool handles those.
Do NOT report style or naming issues.
Respond ONLY with a valid JSON array. No prose. No markdown fences.

Format:
[{"type":"logic","severity":"critical"|"warning"|"suggestion","line":<int>,"message":"<one sentence>","fix":"<one sentence>","confidence":<0-100>}]

Return [] if no issues.`;

function buildPrompt(chunk) {
  return `File: ${chunk.filename}
Function: ${chunk.functionName} (lines ${chunk.startLine}–${chunk.endLine})
Changed lines: ${chunk.changedLines.map(l => l.lineNo).join(', ')}

Full function:
\`\`\`javascript
${chunk.fullCode}
\`\`\`

Changed lines:
${chunk.changedLines.map(l => `  Line ${l.lineNo}: ${l.content.trim()}`).join('\n')}

JSON only.`;
}

async function reviewChunk(chunk, metadata = {}) {
  if (chunk.fullCode.split('\n').length < 4) return { findings: [], audit: null };
  if (/\.(test|spec)\.|__tests__/.test(chunk.filename)) return { findings: [], audit: null };
  if (!process.env.GROQ_API_KEY) return { findings: [], audit: null };

  try {
    const prompt = buildPrompt(chunk);
    const result = await routeReview(prompt, SYSTEM, {
      filename: chunk.filename,
      functionName: chunk.functionName,
      projectId: metadata.projectId,
      prId: metadata.prId,
      stepNumber: metadata.stepNumber || 0,
      totalSteps: metadata.totalSteps || 0,
      complexity: metadata.complexity || 0.5,
    });

    let findings = [];
    try {
      const text = result.content.trim();
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      if (Array.isArray(parsed)) {
        findings = parsed;
      }
    } catch { /* invalid JSON — return empty */ }

    const validated = findings
      .filter(f => f && f.message && f.severity)
      .map(f => ({
        type:         'logic',
        severity:     ['critical','warning','suggestion'].includes(f.severity) ? f.severity : 'warning',
        line:         typeof f.line === 'number' ? f.line : chunk.startLine,
        message:      String(f.message).slice(0, 300),
        fix:          String(f.fix || '').slice(0, 300),
        confidence:   Math.min(100, Math.max(0, Number(f.confidence) || 70)),
        filename:     chunk.filename,
        functionName: chunk.functionName,
        source:       'llm',
        modelUsed:    result.audit?.modelUsed || 'unknown',
        modelCost:    result.audit?.modelCost || 0,
      }));

    return { findings: validated, audit: result.audit };

  } catch (err) {
    if (process.env.NODE_ENV !== 'production')
      console.error(`[logicReviewer] ${chunk.filename}:${chunk.startLine}`, err.message);
    return { findings: [], audit: null, error: err.message };
  }
}

async function reviewAllChunks(chunks, onFinding, metadata = {}) {
  const all = [];
  const totalSteps = chunks.length;

  for (let i = 0; i < chunks.length; i += 3) {
    const batch = chunks.slice(i, i + 3);
    const results = await Promise.all(
      batch.map((chunk, idx) =>
        reviewChunk(chunk, {
          ...metadata,
          stepNumber: i + idx + 1,
          totalSteps,
        })
      )
    );

    for (const { findings, audit } of results) {
      for (const f of findings) {
        all.push(f);
        onFinding({ type: 'logic_finding', data: f });
      }
      if (audit) {
        onFinding({ type: 'cascade_decision', data: audit });
      }
    }
  }
  return all;
}

module.exports = { reviewAllChunks };
