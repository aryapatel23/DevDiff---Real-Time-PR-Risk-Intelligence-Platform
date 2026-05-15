# Backend Architecture

## Overview

The DevDiff backend is a Node.js/Express application that provides RESTful APIs and WebSocket support for real-time PR analysis. It integrates static analysis rules, ML scoring, and optional LLM review.

## Technology Stack

### Runtime & Framework
- **Node.js** - JavaScript runtime
- **Express** - Web framework
- **WebSocket (ws)** - Real-time communication

### Data & Storage
- **PostgreSQL** - Primary database (via Supabase)
- **SQLite** - Local development DB (fallback)

### External Integrations
- **Supabase** - Auth & Database
- **GitHub API** - PR/repository access
- **Groq API** - LLM logic review (optional)

### Analysis Tools
- **Tree-sitter** - AST parsing for multiple languages
- **Babel Parser** - JavaScript/TypeScript parsing

---

## Project Structure

```
backend/
├── analysis/               # Core analysis pipeline
│   ├── pipeline.js            # Main orchestrator
│   ├── codeEnricher.js       # Function context enrichment
│   └── logicReviewer.js      # LLM-based logic review
├── auth/                   # Authentication
│   └── middleware.js          # JWT & GitHub token validation
├── db/                     # Database layer
│   ├── db.js                 # Connection management
│   ├── migrate.js            # Schema migrations
│   ├── queries.js            # SQL queries
│   └── seed.js               # Demo data seeding
├── github/                 # GitHub integration
│   ├── fetcher.js            # PR/file fetching
│   └── repoLister.js         # Repository listing
├── ml/                     # ML layer
│   ├── mlBridge.js           # Python scorer bridge
│   ├── scorer.py             # ML inference script
│   ├── train.py              # Model training
│   ├── features.py           # Feature extraction
│   └── retrain_from_labels.py # Label-based retraining
├── parser/                 # Diff parsing
│   └── diffParser.js         # Unified diff parsing
├── projects/               # Historical import
│   └── importer.js           # Bulk PR importer
├── routes/                 # Express routes
│   ├── auth.js              # Auth endpoints
│   ├── projects.js         # Project CRUD
│   ├── analyze.js           # Analysis trigger
│   ├── analytics.js         # Analytics APIs
│   └── developer.js         # Developer profiles
├── rules/                  # Security rules (20 rules)
│   ├── index.js             # Rule runner
│   ├── nullDeref.js
│   ├── sqlInjection.js
│   ├── xssInnerHTML.js
│   ├── secretLeak.js
│   ├── evalUsage.js
│   ├── pathTraversal.js
│   ├── weakHash.js
│   ├── insecureRandom.js
│   ├── hardcodedIp.js
│   ├── missingValidation.js
│   ├── prototypePollu.js
│   ├── reDoS.js
│   ├── consoleLog.js
│   ├── memoryLeak.js
│   ├── asyncAwaitLeak.js
│   ├── sensitiveDataLog.js
│   ├── missingRateLimit.js
│   ├── corsWildcard.js
│   ├── jwtNoExpiry.js
│   └── syntaxError.js
├── intent/                 # Ticket validation
│   └── ticketValidator.js    # PR-ticket linkage check
├── ast/                    # AST analysis
│   ├── treesitter.js        # Tree-sitter wrapper
│   └── syntaxCheck.js       # Syntax validation
├── behavioral/             # Developer behavior
│   └── engine.js            # Pattern analysis
├── reports/               # Export functionality
│   └── exporter.js          # Report generation
├── server.js              # Entry point
└── package.json
```

---

## Request Flow

### 1. Analysis Request Flow

```
Client (POST /api/analyze)
    │
    ▼
┌─────────────────────────────────────────────┐
│  analyze.js route handler                   │
│  - Validate JWT                             │
│  - Check project ownership                  │
│  - Validate PR belongs to project repo      │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│  Create Job (in-memory Map)                 │
│  - Generate UUID jobId                      │
│  - Initialize job state                      │
│  - Return immediately (async processing)   │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│  Pipeline (analysis/pipeline.js)            │
│  1. Fetch PR metadata (GitHub)              │
│  2. Fetch changed files                     │
│  3. Parse diff into lines                   │
│  4. Enrich with function context             │
│  5. Run 20 security rules                    │
│  6. Score with ML model                      │
│  7. Run LLM review (optional)               │
│  8. Store results in DB                     │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│  WebSocket Events (for each finding)        │
│  - pr_meta, code_loaded                     │
│  - finding (multiple)                       │
│  - logic_review_start/logic_finding         │
│  - complete                                 │
└─────────────────────────────────────────────┘
```

---

## Database Schema

### Tables

#### user_profiles
```sql
id, user_id, github_username, created_at, updated_at
```

#### projects
```sql
id, user_id, name, github_repo, description,
is_private, import_status, import_count,
created_at, updated_at
```

#### pull_requests
```sql
id, project_id, pr_url, repo, pr_number,
pr_title, author, ticket_url, files_count,
risk_score, status, is_historical, created_at
```

#### findings
```sql
id, project_id, pr_id, filename, line_number,
rule_name, severity, confidence, message,
fix_hint, author, false_positive, created_at
```

#### developer_profiles
```sql
id, project_id, author, total_prs, critical_count,
warning_count, info_count, avg_risk_score,
rule_weights, rule_thresholds, created_at, updated_at
```

#### developer_patterns
```sql
id, project_id, author, rule_name, count, last_seen
```

---

## Security Rules (20 Rules)

### High Severity (Deterministic)
These rules always trigger findings regardless of ML score:

| Rule | Description |
|------|-------------|
| `secret-leak` | Hardcoded credentials/secrets |
| `eval-usage` | eval/new Function usage |
| `sql-injection` | SQL from user input |
| `prototype-pollution` | Unsafe object merge |
| `jwt-no-expiry` | JWT without expiration |
| `sensitive-data-log` | Logging sensitive data |

### Medium/High Severity (ML-scored)
| Rule | Description |
|------|-------------|
| `null-deref` | Possible null/undefined access |
| `xss-innerhtml` | Unsafe innerHTML usage |
| `path-traversal` | Unsafe file paths |
| `weak-hash` | MD5/SHA1 for security |
| `insecure-random` | Math.random for security |
| `hardcoded-ip` | Hardcoded IP addresses |
| `missing-validation` | Unvalidated input |
| `redos` | Catastrophic regex |
| `console-log` | Production logging |
| `memory-leak` | Uncleaned listeners |
| `async-await-leak` | Unhandled async |
| `missing-rate-limit` | No rate limiting |
| `cors-wildcard` | Insecure CORS |
| `sensitive-data-log` | Sensitive data in logs |

---

## ML Architecture

### Feature Engineering (15 features)
1. `is_critical_file` - Auth/payment/token files
2. `is_test_file` - Test file detection
3. `has_user_input` - req.body/query presence
4. `has_template_literal` - Template string usage
5. `has_null_guard` - Null check nearby
6. `line_length_bucket` - Line length category
7. `dot_depth` - Object chaining depth
8. `paren_depth` - Parentheses nesting
9. `async_signal` - Async/await presence
10. `conditional_signal` - If/ternary presence
11. `concat_signal` - String concatenation
12. `rule_base_weight` - Rule severity weight
13. `author_history_count` - Author pattern count
14. `eval_like_signal` - eval-like patterns
15. `weak_crypto_in_critical` - Crypto in critical files

### ML Pipeline
```
Raw Features → StandardScaler → RandomForestClassifier
                                    │
                                    ▼
                           [probability: bug/safe]
                                    │
                                    ▼
                           confidence_score (0-100)
```

### Runtime Bridge (mlBridge.js)
- Spawns Python process for scorer
- IPC via stdin/stdout JSON
- Timeout handling (8s default)
- Fallback to safe defaults on failure
- Automatic process restart

---

## WebSocket Architecture

### Connection Flow
1. Client connects to `/ws/findings/:jobId`
2. Server validates jobId exists
3. Client added to job's client Set
4. Historical events replayed to client
5. New events streamed in real-time
6. On completion, final summary sent
7. Client disconnects, removed from Set

### Event Protocol
```javascript
// Each message is JSON with structure:
{
  event: "finding",
  data: { /* event-specific data */ }
}
```

---

## Authentication & Authorization

### Middleware Layer
1. **JWT Validation** - Supabase access token
2. **GitHub Token** - From OAuth provider token
3. **Project Ownership** - Verify user owns project

### Token Flow
```
Request → Authorization Header (JWT)
                │
                ▼
        Supabase JWT Verify
                │
                ▼
        Attach user to request
                │
                ▼
        Route Handler
```

---

## Error Handling

### Error Types
- **ValidationError** - Input validation failures
- **AuthError** - Authentication/authorization failures
- **GitHubError** - GitHub API failures
- **MLError** - ML scoring failures
- **DatabaseError** - DB operation failures

### Error Response Format
```json
{
  "error": "Descriptive error message"
}
```

---

## Performance Considerations

### Async Processing
- Analysis runs in background (setImmediate)
- Non-blocking WebSocket updates
- Database writes batched where possible

### Caching
- GitHub responses not cached (fresh data)
- ML model loaded once per process

### Resource Limits
- Default timeout: 8s for ML scoring
- Max timeout failures: 3 before fallback

---

## Scalability Architecture

### Current (Monolith)
- Single Express server
- In-memory job storage
- Local SQLite fallback

### Future (Multi-instance)
- Redis for job state
- Separate ML workers
- Load balancer for WebSocket
- PostgreSQL pooling

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 4000) |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key |
| `DATABASE_URL` | No | PostgreSQL connection |
| `GROQ_API_KEY` | No | For LLM review |
| `ENABLE_LOGIC_REVIEW` | No | Enable LLM (set to "true") |
| `ML_BRIDGE_TIMEOUT_MS` | No | ML timeout (default: 8000) |
| `SEED_USER_ID` | No | Deterministic seed user |

---

## Testing

### Unit Tests
- Diff parser tests (`test_diffParser.js`)
- Rule engine tests (`test_rules.js`)
- CLI tests (`test_cli.js`)

### Integration Tests
- API endpoint tests (`test_api.sh`)
- End-to-end flows

### ML Tests
- Python ML validation (`test_ml.py`)
- Feature extraction tests