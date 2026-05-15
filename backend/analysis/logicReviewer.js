/**
 * logicReviewer.js — Groq version
 *
 * Uses Groq API (llama-3.3-70b-versatile) for logic bug detection.
 * Free tier at console.groq.com — no credit card needed.
 *
 * Finds: assignment in conditional, off-by-one, wrong return,
 *        dead code, missing edge case, race conditions.
 * Does NOT find: SQL injection, XSS, eval, secrets — rule engine handles those.
 */

const axios = require('axios');
require('dotenv').config();

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';

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

async function reviewChunk(chunk) {
  if (chunk.fullCode.split('\n').length < 4) return [];
  if (/\.(test|spec)\.|__tests__/.test(chunk.filename)) return [];
  if (!process.env.GROQ_API_KEY) return [];

  try {
    const res = await axios.post(
      GROQ_API,
      {
        model:      'llama-3.3-70b-versatile',
        max_tokens: 1024,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user',   content: buildPrompt(chunk) }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type':  'application/json'
        },
        timeout: 15000
      }
    );

    let findings = [];
    try {
      const text  = res.data.choices[0].message.content.trim();
      const clean = text.replace(/```json|```/g, '').trim();
      findings = JSON.parse(clean);
      if (!Array.isArray(findings)) findings = [];
    } catch { return []; }

    return findings
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
        source:       'llm'
      }));

  } catch (err) {
    if (process.env.NODE_ENV !== 'production')
      console.error(`[logicReviewer] ${chunk.filename}:${chunk.startLine}`, err.message);
    return [];
  }
}

async function reviewAllChunks(chunks, onFinding) {
  const all = [];
  for (let i = 0; i < chunks.length; i += 3) {
    const results = await Promise.all(chunks.slice(i, i + 3).map(reviewChunk));
    for (const chunkFindings of results) {
      for (const f of chunkFindings) {
        all.push(f);
        onFinding({ type: 'logic_finding', data: f });
      }
    }
  }
  return all;
}

module.exports = { reviewAllChunks };
