# DevDiff v2.0 — Architecture Plan

## Hackathon Upgrade: Memory-Driven PR Intelligence with Hindsight + cascadeflow

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current System Analysis](#2-current-system-analysis)
3. [What Changes](#3-what-changes)
4. [Hindsight Integration Architecture](#4-hindsight-integration-architecture)
5. [cascadeflow Integration Architecture](#5-cascadeflow-integration-architecture)
6. [New Backend Modules](#6-new-backend-modules)
7. [New Frontend Features](#7-new-frontend-features)
8. [Database Schema Changes](#8-database-schema-changes)
9. [API Changes](#9-api-changes)
10. [Data Flow: Before vs After](#10-data-flow-before-vs-after)
11. [Environment Variables](#11-environment-variables)
12. [Dependencies](#12-dependencies)
13. [Deployment](#13-deployment)
14. [Demo Plan](#14-demo-plan)
15. [Implementation Phases](#15-implementation-phases)
16. [Files Modified](#16-files-modified)

---

## 1. Executive Summary

DevDiff v2.0 transforms from a stateless PR scanner into an AI security agent that learns from every review. Two hackathon technologies power this transformation:

- **Hindsight** — Persistent memory that stores findings, learns from false positive corrections, and recalls developer-specific patterns before each analysis. The system remembers *why* something was flagged and *why* it was wrong.

- **cascadeflow** — Runtime intelligence that routes each LLM code review through a cost-optimized model cascade (free model first, paid only when quality requires). Every decision logged with full audit trail.

The result: false positive rates drop from ~40% to ~5% over 20 PRs. LLM costs drop 60-70%. Every routing decision is auditable.

---

## 2. Current System Analysis

### What Exists Today

```
PR URL → Parse → Fetch Files → Enrich Code → Run 20 Rules → ML Score → LLM Review → Store → Stream
```

**Pipeline stages (pipeline.js, 226 lines):**
1. Parse PR URL, fetch metadata + files from GitHub API
2. Enrich code with function context (codeEnricher.js)
3. Insert PR record in PostgreSQL
4. Get/create developer profile
5. Load author patterns, danger zone files, suppression map (all SQL queries)
6. Validate ticket intent (ticketValidator.js)
7. For each file line: run 20 rules, build 15-feature vectors
8. Score via Python ML subprocess (mlBridge.js → scorer.py)
9. Calculate confidence: `min(100, ml_score × rule_weight)`
10. Optional: LLM logic review via Groq (logicReviewer.js)
11. Calculate risk score: `min(100, critical×12 + warning×4)`
12. Recalculate developer weights (queries.js)

**Developer adaptation (queries.js, lines 331-365):**
- `recalculateWeights()` — Pure SQL aggregation: `weight = max(0.3, min(2.5, (hits/avg) × (1 - fpRate × 0.5)))`
- `recalculateThresholds()` — `base 65, -10 if hits>=3, +15 if fpRate>0.3, clamped 40-85`
- No semantic understanding — just numeric counters

**LLM review (logicReviewer.js, 112 lines):**
- Always sends to `llama-3.3-70b-versatile` on Groq
- No model routing, no cost optimization, no audit trail
- Batches 3 chunks in parallel, 15s timeout per request
- Skips files < 4 lines, test/spec files

### Limitations

| Area | Problem | Impact |
|------|---------|--------|
| Memory | Stateless — each analysis starts from zero | 40% false positive rate never decreases |
| Adaptation | SQL counters only — no semantic understanding | Thresholds are math, not intelligence |
| LLM Cost | Same expensive model for every chunk | $0.10-0.50/PR with zero optimization |
| LLM Audit | No visibility into model selection or cost | Teams can't optimize AI spend |
| FP Learning | Counter-based (`false_positive: 0→1→2`) | Doesn't learn *why* something was wrong |
| Patterns | Numeric weights only | Can't understand "Alice uses optional chaining a lot" |

---

## 3. What Changes

### Files Modified (Existing)

| File | Change | Lines Changed |
|------|--------|:-------------:|
| `backend/analysis/pipeline.js` | Add memory recall before rules, retain after analysis | ~40 lines added |
| `backend/analysis/logicReviewer.js` | Route through cascadeflow instead of direct Groq call | ~30 lines rewritten |
| `backend/routes/analytics.js` | Add memory-backed insights, cost analytics endpoints | ~60 lines added |
| `backend/server.js` | Add new route mount, Hindsight client init | ~10 lines added |
| `backend/db/schema.sql` | Add `audit_trail` table, `memory_events` table | ~30 lines added |
| `backend/db/queries.js` | Add audit trail queries, memory event queries | ~50 lines added |
| `backend/package.json` | Add hindsight-client, cascadeflow dependencies | 2 lines |
| `frontend/pages/projects/[id]/index.tsx` | Add learning curve widget, cost per finding | ~80 lines added |
| `frontend/pages/projects/[id]/learning.tsx` | New page: learning curve visualization | ~200 lines (new) |
| `frontend/pages/projects/[id]/costs.tsx` | New page: cost intelligence dashboard | ~250 lines (new) |
| `frontend/pages/projects/[id]/memory.tsx` | New page: memory explorer | ~180 lines (new) |
| `frontend/components/CostBadge.tsx` | New component: cost per finding badge | ~30 lines (new) |
| `frontend/components/LearningCurve.tsx` | New component: FP rate chart over time | ~80 lines (new) |

### New Files Created

| File | Purpose | Est. Lines |
|------|---------|:----------:|
| `backend/memory/hindsightClient.js` | Hindsight client singleton | ~40 |
| `backend/memory/memoryBank.js` | Bank creation, configuration | ~60 |
| `backend/memory/retainMemories.js` | Retain analysis results + FP corrections | ~120 |
| `backend/memory/recallContext.js` | Recall patterns before analysis | ~80 |
| `backend/memory/reflectOnFeedback.js` | Reflect on FP corrections | ~60 |
| `backend/cascade/cascadeConfig.js` | Model definitions, budgets, KPIs | ~50 |
| `backend/cascade/llmRouter.js` | Route LLM calls through cascadeflow | ~80 |
| `backend/cascade/auditTrail.js` | Cost/latency/model decision logging | ~60 |
| `backend/routes/intelligence.js` | Audit trail + cost analytics endpoint | ~80 |

---

## 4. Hindsight Integration Architecture

### 4.1 Memory Bank Design

Each DevDiff project gets a dedicated Hindsight memory bank.

**Bank Naming:** `devdiff-project-{projectId}`

**Bank Configuration:**
```javascript
{
  name: "DevDiff Security Reviewer",
  mission: "I am a PR security reviewer for this codebase. I learn from each review to reduce false positives and improve detection accuracy. I track developer-specific patterns and adapt thresholds based on real corrections, not just counts.",
  directives: [
    "Never suppress critical findings regardless of history",
    "Always cite evidence when adjusting confidence based on recalled patterns",
    "Weight recent corrections more heavily than old ones"
  ],
  disposition: {
    skepticism: 4,    // Cautious — requires strong evidence to suppress findings
    literalism: 3,    // Balanced — interprets patterns contextually
    empathy: 2        // Objective — focuses on code quality, not developer feelings
  }
}
```

### 4.2 What Gets Retained (Store)

**After Each PR Analysis:**
```javascript
// Retain the full analysis result
await client.retain(bankId, `PR #${prNumber} by ${author}: ${criticalCount} critical, ${warningCount} warnings, ${infoCount} info findings across ${filesCount} files. Risk score: ${riskScore}.`, {
  metadata: {
    type: 'analysis_result',
    prNumber,
    author,
    projectId,
    riskScore,
    criticalCount,
    warningCount,
    infoCount,
    filesCount,
    timestamp: new Date().toISOString()
  }
});

// Retain each finding individually
for (const finding of findings) {
  await client.retain(bankId, `${finding.rule_name} finding in ${finding.filename}:${finding.line_number}: ${finding.message} (severity: ${finding.severity}, confidence: ${finding.confidence})`, {
    metadata: {
      type: 'finding',
      ruleName: finding.rule_name,
      filename: finding.filename,
      lineNumber: finding.line_number,
      severity: finding.severity,
      confidence: finding.confidence,
      author,
      prNumber
    }
  });
}
```

**When False Positive Is Marked:**
```javascript
await client.retain(bankId, `False positive correction: ${finding.rule_name} in ${finding.filename} was marked as false positive by developer. Original severity: ${finding.severity}. This rule now has elevated false positive rate for this file pattern.`, {
  metadata: {
    type: 'false_positive_correction',
    ruleName: finding.rule_name,
    filename: finding.filename,
    originalSeverity: finding.severity,
    correctedBy: userId,
    timestamp: new Date().toISOString()
  }
});
```

**On Project Creation:**
```javascript
await client.retain(bankId, `Project "${projectName}" monitors repository ${githubRepo}. This is a ${isPrivate ? 'private' : 'public'} repository.`, {
  metadata: {
    type: 'project_context',
    projectName,
    githubRepo,
    isPrivate
  }
});
```

### 4.3 What Gets Recalled (Before Each Analysis)

**Step 1: Recall Developer Patterns**
```javascript
const devPatterns = await client.recall(bankId, `What false positive patterns and code style habits does developer ${author} have? What rules tend to produce false positives for this developer?`, {
  types: ['observation', 'world'],
  maxTokens: 2048
});
// Returns observations like:
// "Alice uses optional chaining extensively, causing null-deref false positives"
// "console-log rule has 80% false positive rate for Alice in test files"
```

**Step 2: Recall File Context**
```javascript
const fileContext = await client.retain(bankId, `What history exists for files in this PR? Which files are danger zones? What past findings have been in these files?`, {
  metadata: { fileNames: changedFiles }
});
// Returns observations like:
// "auth/middleware.js has had 7 findings across 5 PRs — danger zone file"
// "routes/analyze.js had a race condition finding that was confirmed real"
```

**Step 3: Recall Rule Effectiveness**
```javascript
const ruleContext = await client.recall(bankId, `What is the false positive rate for each security rule in this project? Which rules are most reliable?`, {
  types: ['observation', 'world']
});
// Returns observations like:
// "sql-injection rule has 95% precision in this project"
// "console-log rule has 40% false positive rate overall"
// "null-deref has 60% FP rate with optional chaining patterns"
```

### 4.4 What Gets Reflected (After FP Corrections)

When a developer marks findings as false positive, Hindsight's reflect operation consolidates related facts:

```javascript
const reflection = await client.reflect(bankId, `Based on recent false positive corrections, what patterns should I adjust for future analyses? What observations should be updated?`, {
  budget: 'mid'
});
// Hindsight automatically:
// 1. Merges related FP corrections into observations
// 2. Updates existing observations with new evidence
// 3. Tracks proof counts for each observation
// 4. Marks stale observations for re-verification
```

### 4.5 How Recalled Context Influences Analysis

In `pipeline.js`, after loading SQL-based patterns, add Hindsight recall:

```javascript
// Existing SQL-based patterns (unchanged)
const patterns = await queries.getAuthorPatterns(projectId, meta.author);
const patternMap = new Map(patterns.map(p => [p.rule_name, Number(p.count || 0)]));

// NEW: Hindsight semantic patterns
const hindsightContext = await recallContext(bankId, meta.author, changedFiles);
// hindsightContext = {
//   fpObservations: ["console-log has 40% FP in test files", ...],
//   devPatterns: ["Alice uses optional chaining a lot", ...],
//   fileHistory: ["auth/middleware.js is a danger zone", ...],
//   ruleReliability: { "sql-injection": 0.95, "console-log": 0.60, ... }
// }

// Apply semantic adjustments
for (const hit of hits) {
  // If Hindsight has observation that this rule has high FP for this dev/context
  const fpRate = hindsightContext.ruleReliability[hit.rule_name] || 1.0;
  if (fpRate < 0.5) {
    // Boost threshold — rule is unreliable for this context
    escalatedThreshold = Math.min(85, escalatedThreshold + 10);
  }
  if (fpRate > 0.9) {
    // Reduce threshold — rule is highly reliable
    escalatedThreshold = Math.max(40, escalatedThreshold - 5);
  }
}
```

---

## 5. cascadeflow Integration Architecture

### 5.1 Model Cascade Configuration

```javascript
// backend/cascade/cascadeConfig.js
const { CascadeAgent, ModelConfig } = require('@cascadeflow/core');

const agent = new CascadeAgent({
  models: [
    // Tier 1: Free / cheap model (handles 60-70% of chunks)
    new ModelConfig({
      name: 'qwen/qwen3-32b',
      provider: 'groq',
      cost: 0.0,  // Free tier on Groq
    }),
    // Tier 2: Paid model (handles complex logic only)
    new ModelConfig({
      name: 'llama-3.3-70b-versatile',
      provider: 'groq',
      cost: 0.00059,  // $0.59/1M tokens
    }),
  ],
  quality: {
    threshold: 0.75,
    requireMinimumTokens: 10,
  },
  budget: parseFloat(process.env.CASCADEFLOW_BUDGET_PER_ANALYSIS || '0.10'),
});
```

### 5.2 How LLM Review Changes

**Before (logicReviewer.js):**
```javascript
// Direct Groq call — same model every time
const response = await axios.post(GROQ_API, {
  model: 'llama-3.3-70b-versatile',
  messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
  temperature: 0.2,
  max_tokens: 1024,
}, { timeout: 15000 });
```

**After (llmRouter.js wrapping logicReviewer.js):**
```javascript
// Route through cascadeflow — model selected per chunk
const result = await cascadeAgent.run(prompt, {
  system: SYSTEM,
  metadata: {
    chunkId: chunk.id,
    filename: chunk.filename,
    functionName: chunk.functionName,
    projectId,
    author,
  }
});

// Log audit trail
await auditTrail.log({
  chunkId: chunk.id,
  filename: chunk.filename,
  modelUsed: result.modelUsed,
  totalCost: result.totalCost,
  latencyMs: result.latencyMs,
  qualityScore: result.qualityScore,
  escalated: result.escalated,
  escalationReason: result.escalationReason,
});
```

### 5.3 Audit Trail Schema

Every LLM call produces an audit record:

```javascript
{
  id: 'uuid',
  project_id: 'uuid',
  pr_id: 123,
  chunk_filename: 'auth/middleware.js',
  chunk_function: 'requireAuth',
  model_used: 'qwen/qwen3-32b',
  model_cost: 0.0,
  latency_ms: 234,
  quality_score: 0.82,
  escalated: false,
  escalation_reason: null,
  step_number: 1,
  total_steps: 5,
  created_at: '2026-07-05T12:00:00Z'
}
```

### 5.4 Cost Intelligence Endpoint

New endpoint: `GET /api/analytics/:projectId/costs`

Returns:
```json
{
  "total_analyses": 25,
  "total_llm_calls": 150,
  "free_model_calls": 105,
  "paid_model_calls": 45,
  "total_cost": 0.02655,
  "estimated_cost_without_cascade": 0.0885,
  "savings_percentage": 70,
  "avg_latency_ms": 312,
  "escalation_rate": 0.30,
  "recent_decisions": [
    {
      "filename": "auth/middleware.js",
      "model": "qwen/qwen3-32b",
      "cost": 0.0,
      "quality": 0.82,
      "escalated": false
    }
  ]
}
```

---

## 6. New Backend Modules

### 6.1 memory/hindsightClient.js

Singleton Hindsight client. Initializes on first use.

```javascript
// Lazy-init Hindsight client
let client = null;

function getClient() {
  if (!client) {
    const { HindsightClient } = require('@vectorize-io/hindsight-client');
    client = new HindsightClient({
      baseUrl: process.env.HINDSIGHT_URL || 'http://localhost:8888',
    });
  }
  return client;
}

function getBankId(projectId) {
  return `${process.env.HINDSIGHT_BANK_PREFIX || 'devdiff-project'}-${projectId}`;
}

module.exports = { getClient, getBankId };
```

### 6.2 memory/memoryBank.js

Creates and configures memory banks for new projects.

```javascript
async function ensureBankExists(projectId, projectName, githubRepo) {
  const client = getClient();
  const bankId = getBankId(projectId);

  try {
    await client.createBank(bankId, {
      name: `DevDiff: ${projectName}`,
      mission: `I am a PR security reviewer for the "${projectName}" codebase (${githubRepo}). I learn from each review to reduce false positives and improve detection accuracy. I track developer-specific patterns and adapt thresholds based on real corrections.`,
      directives: [
        'Never suppress critical findings regardless of history',
        'Always cite evidence when adjusting confidence based on recalled patterns',
        'Weight recent corrections more heavily than old ones'
      ],
      disposition: {
        skepticism: 4,
        literalism: 3,
        empathy: 2
      }
    });
  } catch (e) {
    // Bank already exists — that's fine
    if (!e.message?.includes('already exists')) throw e;
  }
}

module.exports = { ensureBankExists };
```

### 6.3 memory/retainMemories.js

Stores analysis results and corrections in Hindsight.

Key functions:
- `retainAnalysisResult(bankId, prData, findings)` — After pipeline completes
- `retainFalsePositive(bankId, findingData, userId)` — When FP is marked
- `retainProjectContext(bankId, projectName, githubRepo)` — On project creation

### 6.4 memory/recallContext.js

Recalls relevant patterns before analysis.

Key function:
- `recallContext(bankId, author, changedFiles)` — Returns `{ fpObservations, devPatterns, fileHistory, ruleReliability }`

### 6.5 memory/reflectOnFeedback.js

Triggers reflection after FP corrections.

Key function:
- `reflectOnCorrection(bankId, findingData)` — Triggers observation consolidation

### 6.6 cascade/cascadeConfig.js

CascadeAgent configuration with model definitions and budget.

### 6.7 cascade/llmRouter.js

Wraps logic review calls through cascadeflow.

Key function:
- `routeLLMCall(prompt, systemPrompt, metadata)` — Routes through cascade, returns result + audit data

### 6.8 cascade/auditTrail.js

Logs every LLM call decision.

Key functions:
- `logDecision(data)` — Store in PostgreSQL audit_trail table
- `getCostSummary(projectId)` — Aggregate cost metrics
- `getRecentDecisions(projectId, limit)` — Recent routing decisions

### 6.9 routes/intelligence.js

New API endpoints for cost and memory analytics.

---

## 7. New Frontend Features

### 7.1 Learning Curve Page (`/projects/[id]/learning`)

Shows how the agent improves over time:
- **Chart:** False positive rate per PR (line chart, decreasing trend)
- **Metric Cards:** Total corrections learned, observations consolidated, accuracy improvement %
- **Timeline:** Each PR with FP rate, findings count, risk score
- **Rule Effectiveness:** Which rules improved most after corrections

### 7.2 Cost Intelligence Dashboard (`/projects/[id]/costs`)

Shows cascadeflow routing metrics:
- **Savings Card:** Total saved, savings percentage, estimated cost without cascade
- **Model Distribution:** Pie chart of free vs paid model usage
- **Escalation Log:** Table of each LLM call with model, cost, quality, reason
- **Budget Status:** Current spend vs budget cap

### 7.3 Memory Explorer (`/projects/[id]/memory`)

Browse Hindsight memory bank contents:
- **Observations:** Auto-consolidated insights about developers, rules, files
- **Recent Memories:** Last 50 retained facts (findings, corrections, context)
- **Evidence Chain:** For any observation, show source memories with quotes
- **Search:** Query memories by developer, rule, file, time range

### 7.4 Enhanced Analysis Page (`/projects/[id]`)

Additions to existing page:
- **Cost Per Finding:** Each finding shows which model reviewed it and cost contribution
- **Learning Indicator:** "This finding was deprioritized based on 3 past corrections" tooltip
- **Memory Badge:** "Hindsight recall used" indicator on findings influenced by recalled context

---

## 8. Database Schema Changes

### New Table: audit_trail

```sql
CREATE TABLE IF NOT EXISTS public.audit_trail (
  id              SERIAL PRIMARY KEY,
  project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  pr_id           INTEGER REFERENCES public.pull_requests(id) ON DELETE CASCADE,
  chunk_filename  TEXT,
  chunk_function  TEXT,
  model_used      TEXT NOT NULL,
  model_cost      REAL DEFAULT 0.0,
  latency_ms      INTEGER,
  quality_score   REAL,
  escalated       BOOLEAN DEFAULT FALSE,
  escalation_reason TEXT,
  step_number     INTEGER,
  total_steps     INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_project ON public.audit_trail(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_pr ON public.audit_trail(pr_id);

ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_trail' AND policyname = 'project audit') THEN
    CREATE POLICY "project audit" ON public.audit_trail
      FOR ALL USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()));
  END IF;
END $$;
```

### New Table: memory_events

```sql
CREATE TABLE IF NOT EXISTS public.memory_events (
  id              SERIAL PRIMARY KEY,
  project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL CHECK(event_type IN ('retain', 'recall', 'reflect', 'correction')),
  bank_id         TEXT NOT NULL,
  content_summary TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_project ON public.memory_events(project_id);
CREATE INDEX IF NOT EXISTS idx_memory_type ON public.memory_events(event_type);

ALTER TABLE public.memory_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'memory_events' AND policyname = 'project memory') THEN
    CREATE POLICY "project memory" ON public.memory_events
      FOR ALL USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()));
  END IF;
END $$;
```

---

## 9. API Changes

### New Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/analytics/:projectId/costs` | Cost intelligence summary |
| GET | `/api/analytics/:projectId/costs/decisions` | Recent LLM routing decisions |
| GET | `/api/analytics/:projectId/memory` | Memory events (retains, recalls, reflects) |
| GET | `/api/analytics/:projectId/learning` | Learning curve data (FP rate over time) |
| GET | `/api/analytics/:projectId/observations` | Hindsight consolidated observations |

### Modified Endpoints

**POST /api/analytics/findings/:id/fp** — Now also:
1. Retains correction in Hindsight
2. Triggers reflect operation
3. Logs memory event

**POST /api/analyze** — Now also:
1. Recalls context from Hindsight before running rules
2. Passes recalled context to pipeline
3. Retains results in Hindsight after completion
4. Logs LLM audit trail if logic review enabled

### WebSocket Events Added

| Event | Data | When |
|-------|------|------|
| `memory_recall` | `{ observations: [...], devPatterns: [...] }` | After Hindsight recall |
| `cascade_decision` | `{ model, cost, quality, escalated }` | After each LLM routing decision |
| `learning_update` | `{ fpRate, totalCorrections, accuracyGain }` | After analysis completes |

---

## 10. Data Flow: Before vs After

### Before (Current)

```
POST /api/analyze
  │
  ├─ Parse PR, fetch files
  ├─ Enrich code
  ├─ Insert PR record
  ├─ Get/create developer profile (SQL)
  ├─ Load patterns (SQL counters)
  ├─ Load danger zone files (SQL)
  ├─ Load suppression map (SQL)
  ├─ For each line: run 20 rules → ML score → store finding
  ├─ LLM review: always llama-70b → store findings
  ├─ Calculate risk score
  ├─ Recalculate weights (SQL aggregation)
  └─ Stream findings via WebSocket
```

### After (v2.0)

```
POST /api/analyze
  │
  ├─ Parse PR, fetch files
  ├─ Enrich code
  ├─ Insert PR record
  ├─ Get/create developer profile (SQL)
  ├─ Load patterns (SQL counters)
  ├─ Load danger zone files (SQL)
  ├─ Load suppression map (SQL)
  │
  ├─ NEW: Hindsight recall: dev patterns, FP history, file context, rule reliability
  │       → Returns semantic observations that adjust thresholds
  │
  ├─ For each line: run 20 rules → ML score → adjust confidence with recalled context
  │
  ├─ NEW: LLM review via cascadeflow:
  │       → Try qwen3-32b (free) first
  │       → Quality gate: score ≥ 0.75 → use it
  │       → Score < 0.75 → escalate to llama-70b (paid)
  │       → Log: model, cost, latency, decision
  │
  ├─ NEW: Hindsight retain: store all findings, observations
  │
  ├─ Calculate risk score
  ├─ Recalculate weights (SQL aggregation)
  │
  ├─ NEW: Hindsight reflect: consolidate patterns from this analysis
  │
  └─ Stream findings + cost data + learning metrics via WebSocket
```

### False Positive Flow

```
User marks finding as false positive
  │
  ├─ PATCH /api/analytics/findings/:id/fp (existing)
  ├─ Update PostgreSQL finding record (existing)
  ├─ Recalculate PR risk score (existing)
  │
  ├─ NEW: Hindsight retain: store correction with reasoning
  ├─ NEW: Hindsight reflect: consolidate into observations
  ├─ NEW: Log memory event
  │
  └─ Next analysis: recall adjusts thresholds for this rule/author/file
```

---

## 11. Environment Variables

### New Variables

```bash
# Hindsight Configuration
HINDSIGHT_URL=http://localhost:8888           # Hindsight server URL
HINDSIGHT_BANK_PREFIX=devdiff-project         # Memory bank naming prefix

# cascadeflow Configuration
CASCADEFLOW_BUDGET_PER_ANALYSIS=0.10          # Max USD per PR analysis
CASCADEFLOW_QUALITY_THRESHOLD=0.75            # Quality gate threshold
CASCADEFLOW_DRAFTER_MODEL=qwen/qwen3-32b     # Free tier model
CASCADEFLOW_VERIFIER_MODEL=llama-3.3-70b-versatile  # Paid tier model
```

### Existing Variables (Unchanged)

```bash
PORT=4000
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=...
GITHUB_TOKEN=...
GROQ_API_KEY=...
ENABLE_LOGIC_REVIEW=true
ML_MODEL_PATH=./ml/model.pkl
CONFIDENCE_THRESHOLD=65
```

---

## 12. Dependencies

### Backend (package.json additions)

```json
{
  "dependencies": {
    "@vectorize-io/hindsight-client": "^1.0.0",
    "@cascadeflow/core": "^1.0.0"
  }
}
```

### Docker Compose (new service)

```yaml
services:
  hindsight:
    image: ghcr.io/vectorize-io/hindsight:latest
    ports:
      - "8888:8888"
      - "9999:9999"
    environment:
      - HINDSIGHT_API_LLM_API_KEY=${GROQ_API_KEY}
      - HINDSIGHT_API_LLM_PROVIDER=groq
      - HINDSIGHT_API_WORKER_ID=devdiff-hindsight
    volumes:
      - hindsight-data:/home/hindsight/.pg0
    restart: unless-stopped
```

---

## 13. Deployment

### Local Development

```bash
# Terminal 1: Hindsight
docker run -it --name hindsight -p 8888:8888 -p 9999:9999 \
  -e HINDSIGHT_API_LLM_API_KEY=$GROQ_API_KEY \
  -e HINDSIGHT_API_LLM_PROVIDER=groq \
  -v hindsight-data:/home/hindsight/.pg0 \
  ghcr.io/vectorize-io/hindsight:latest

# Terminal 2: Backend
cd backend && npm run dev

# Terminal 3: Frontend
cd frontend && npm run dev
```

### Docker Compose (Full Stack)

```bash
docker-compose up --build
```

Services:
- `backend` — Express server (port 4000)
- `frontend` — Next.js app (port 3000)
- `hindsight` — Hindsight server (port 8888, UI: 9999)

---

## 14. Demo Plan

### Scene 1: The Problem (15 seconds)
"DevDiff analyzes a PR. 15 findings. Developer marks 6 as false positives. Next PR, same developer, same warnings. The system learned nothing."

### Scene 2: Hindsight Memory (20 seconds)
"Now with Hindsight. PR #1: 15 findings, 6 FPs. PR #5: 11 findings, 3 FPs. PR #10: 7 findings, 0 FPs. The agent remembers corrections, learns patterns, and dynamically adjusts."

Show: Learning curve chart decreasing, memory explorer showing observations, evidence chain.

### Scene 3: cascadeflow Cost (15 seconds)
"Every LLM call through cascadeflow. 65% handled by free model. Only complex bugs escalate. $0.03 per analysis vs $0.12 before. Full audit trail."

Show: Cost dashboard, model distribution pie chart, escalation log.

### Scene 4: The Dashboard (10 seconds)
"Learning curve. Cost intelligence. Memory explorer. This is a security agent that gets smarter and cheaper with every PR."

Show: All three new pages in quick succession.

---

## 15. Implementation Phases

### Phase 1: Infrastructure (Day 1)
- [ ] Set up Hindsight Docker container
- [ ] Install `@vectorize-io/hindsight-client` in backend
- [ ] Install `@cascadeflow/core` in backend
- [ ] Create `backend/memory/` module structure
- [ ] Create `backend/cascade/` module structure
- [ ] Add new database tables (audit_trail, memory_events)

### Phase 2: Hindsight Core (Day 1-2)
- [ ] Implement `hindsightClient.js` (singleton)
- [ ] Implement `memoryBank.js` (bank creation)
- [ ] Implement `retainMemories.js` (store analysis results)
- [ ] Implement `recallContext.js` (recall before analysis)
- [ ] Integrate recall into `pipeline.js` (before rules run)
- [ ] Integrate retain into `pipeline.js` (after analysis completes)

### Phase 3: cascadeflow Core (Day 2)
- [ ] Implement `cascadeConfig.js` (model definitions)
- [ ] Implement `llmRouter.js` (route through cascade)
- [ ] Implement `auditTrail.js` (log decisions)
- [ ] Modify `logicReviewer.js` to use cascadeflow router
- [ ] Add audit trail to database

### Phase 4: FP Learning Loop (Day 2-3)
- [ ] Implement `reflectOnFeedback.js`
- [ ] Modify FP endpoint to retain correction + trigger reflect
- [ ] Test recall context influence on rule thresholds
- [ ] Verify learning curve with test data

### Phase 5: Frontend (Day 3)
- [ ] Add cost badge component to findings
- [ ] Create learning curve page
- [ ] Create cost intelligence dashboard
- [ ] Create memory explorer
- [ ] Add WebSocket events for cascade decisions
- [ ] Update analysis page with memory/cost indicators

### Phase 6: Polish & Demo (Day 3-4)
- [ ] Seed demo data showing learning curve
- [ ] Test full flow end-to-end
- [ ] Prepare demo script
- [ ] Write submission documentation

---

## 16. Files Modified

### Summary

| Category | Files Modified | Files Created | Total |
|----------|:-------------:|:-------------:|:-----:|
| Backend - Memory | 0 | 5 | 5 |
| Backend - Cascade | 0 | 3 | 3 |
| Backend - Routes | 2 | 1 | 3 |
| Backend - Core | 3 | 0 | 3 |
| Backend - DB | 2 | 0 | 2 |
| Frontend - Pages | 1 | 3 | 4 |
| Frontend - Components | 0 | 2 | 2 |
| Config | 2 | 0 | 2 |
| **Total** | **10** | **14** | **24** |

### Critical Path Files

1. `backend/analysis/pipeline.js` — Core orchestration, Hindsight recall/retain integration
2. `backend/analysis/logicReviewer.js` — cascadeflow routing integration
3. `backend/memory/recallContext.js` — Semantic pattern recall
4. `backend/memory/retainMemories.js` — Analysis result storage
5. `backend/cascade/llmRouter.js` — Model cascading logic
6. `frontend/pages/projects/[id]/learning.tsx` — Learning curve visualization
7. `frontend/pages/projects/[id]/costs.tsx` — Cost intelligence dashboard

---

*This architecture plan transforms DevDiff from a stateless PR scanner into a memory-driven security agent that learns and optimizes with every review.*
