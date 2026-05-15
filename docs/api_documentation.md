# API Documentation

## Overview

DevDiff provides a RESTful API with real-time WebSocket support for PR risk analysis. All endpoints (except `/health`) require authentication via Supabase JWT.

## Base URL

```
Production: http://localhost:4000
```

## Authentication

### Headers Required
```http
Authorization: Bearer <supabase_jwt_token>
X-GitHub-Token: <github_oauth_token>
Content-Type: application/json
```

---

## Endpoints

### System

#### `GET /health`
Health check endpoint to verify server status.

**Response:**
```json
{ "ok": true }
```

---

### Authentication

#### `GET /api/auth/me`
Retrieve current authenticated user information.

**Response:**
```json
{
  "id": "user-uuid",
  "email": "user@example.com"
}
```

#### `GET /api/auth/repos`
Fetch list of GitHub repositories accessible to the authenticated user.

**Response:**
```json
[
  {
    "full_name": "owner/repo-name",
    "private": false,
    "language": "JavaScript"
  }
]
```

---

### Projects

#### `GET /api/projects`
List all projects associated with the authenticated user.

**Response:**
```json
[
  {
    "id": "project-uuid",
    "name": "My Project",
    "github_repo": "owner/repo",
    "description": "Project description",
    "is_private": true,
    "pr_count": 25,
    "finding_count": 142
  }
]
```

#### `POST /api/projects`
Create a new project.

**Request Body:**
```json
{
  "name": "Project Name",
  "github_repo": "owner/repo",
  "description": "Optional description",
  "is_private": false
}
```

**Response:**
```json
{
  "id": "project-uuid",
  "name": "Project Name",
  "github_repo": "owner/repo"
}
```

#### `GET /api/projects/:id`
Retrieve a specific project by ID.

**Response:**
```json
{
  "id": "project-uuid",
  "name": "My Project",
  "github_repo": "owner/repo",
  "description": "Project description",
  "is_private": true,
  "created_at": "2024-01-01T00:00:00Z"
}
```

---

### Analyze

#### `POST /api/analyze`
Initiate a new PR analysis job. This is the core endpoint that triggers the complete analysis pipeline.

**Request Body:**
```json
{
  "prUrl": "https://github.com/owner/repo/pull/123",
  "ticketUrl": "https://jira.company.com/browse/PROJ-456",
  "projectId": "project-uuid"
}
```

**Response:**
```json
{
  "jobId": "uuid-v4",
  "status": "processing"
}
```

**How It Works:**
1. Validates PR belongs to project repo
2. Creates a job in memory
3. Returns immediately with jobId
4. Analysis runs asynchronously
5. Real-time findings streamed via WebSocket

#### `GET /api/analyze/:jobId`
Check status of an analysis job.

**Response:**
```json
{
  "status": "complete",
  "findingsCount": 15,
  "summary": {
    "prId": "pr-uuid",
    "totalFindings": 12,
    "riskScore": 68,
    "author": "username"
  }
}
```

---

### Analytics

#### `GET /api/analytics/:projectId/history`
Retrieve historical PR data for a project.

**Query Parameters:**
- `limit` (optional): Number of PRs to return (default: 30)

**Response:**
```json
{
  "prs": [
    {
      "id": "pr-uuid",
      "pr_url": "https://github.com/owner/repo/pull/1",
      "pr_number": 1,
      "pr_title": "Fix authentication bug",
      "author": "developer1",
      "risk_score": 45,
      "status": "complete",
      "created_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

#### `GET /api/analytics/:projectId/scorecard`
Get aggregated scoring data for all authors in a project.

**Response:**
```json
{
  "authors": [
    {
      "author": "developer1",
      "total_prs": 25,
      "avg_risk_score": 42.5,
      "critical_count": 3,
      "warning_count": 15,
      "info_count": 22
    }
  ]
}
```

#### `GET /api/analytics/:projectId/heatmap`
Get risk heatmap data showing risk patterns over time.

**Query Parameters:**
- `days` (optional): Number of days to look back (default: 30)

**Response:**
```json
{
  "heatmap": [
    {
      "date": "2024-01-15",
      "count": 5,
      "avg_risk": 35.2
    }
  ]
}
```

#### `GET /api/analytics/:projectId/findings/:prId`
Retrieve all findings for a specific PR.

**Response:**
```json
{
  "findings": [
    {
      "id": "finding-uuid",
      "filename": "src/auth.js",
      "line_number": 45,
      "rule_name": "sql-injection",
      "severity": "critical",
      "confidence": 92,
      "message": "User input directly concatenated into SQL query",
      "fix_hint": "Use parameterized queries instead"
    }
  ]
}
```

#### `POST /api/analytics/findings/:id/fp`
Mark a finding as false positive (user feedback).

**Request Body:**
```json
{
  "level": 1
}
```

- `level: 0` - Not a false positive
- `level: 1` - Mark as info severity
- `level: 2` - Suppress entirely

**Response:**
```json
{ "success": true }
```

---

### Developer

#### `GET /api/developer/:projectId/:author`
Retrieve detailed developer profile and pattern analysis.

**Response:**
```json
{
  "author": "developer1",
  "total_prs": 25,
  "avg_risk_score": 42.5,
  "patterns": [
    {
      "rule_name": "sql-injection",
      "count": 5,
      "recent_frequency": "increasing"
    }
  ],
  "rule_weights": {
    "sql-injection": 1.2,
    "xss-innerhtml": 1.0
  },
  "rule_thresholds": {
    "sql-injection": 55
  }
}
```

---

## WebSocket Events

### Connection
```javascript
ws://localhost:4000/ws/findings/:jobId
```

### Event Sequence

1. **`pr_meta`** - PR metadata loaded
```json
{
  "event": "pr_meta",
  "data": {
    "title": "Fix authentication",
    "author": "developer1",
    "repo": "owner/repo",
    "prNumber": 123,
    "files": [...]
  }
}
```

2. **`code_loaded`** - All changed files parsed
```json
{
  "event": "code_loaded",
  "data": {
    "files": [{ "filename": "src/auth.js", "lines": [...] }]
  }
}
```

3. **`new_user`** - First PR from this author
```json
{
  "event": "new_user",
  "data": {
    "author": "developer1",
    "message": "First PR from developer1 — building their baseline profile"
  }
}
```

4. **`intent_warning`** - Ticket/PR intent mismatch (optional)
```json
{
  "event": "intent_warning",
  "data": {
    "message": "No linked ticket found"
  }
}
```

5. **`finding`** - Security finding discovered
```json
{
  "event": "finding",
  "data": {
    "id": "finding-uuid",
    "filename": "src/auth.js",
    "line_number": 45,
    "rule_name": "sql-injection",
    "severity": "critical",
    "confidence": 92,
    "message": "User input directly concatenated into SQL query",
    "fix_hint": "Use parameterized queries"
  }
}
```

6. **`logic_review_start`** - LLM review begins (if enabled)
```json
{
  "event": "logic_review_start",
  "data": { "chunks": 15 }
}
```

7. **`logic_finding`** - LLM finding (optional)
```json
{
  "event": "logic_finding",
  "data": {
    "type": "logic_finding",
    "filename": "src/utils.js",
    "line": 78,
    "functionName": "calculatePayment",
    "severity": "warning",
    "confidence": 85,
    "message": "Off-by-one error in loop condition",
    "fix": "Change i < length to i <= length"
  }
}
```

8. **`logic_review_complete`** - LLM review finished (optional)
```json
{
  "event": "logic_review_complete",
  "data": { "count": 3 }
}
```

9. **`complete`** - Analysis finished
```json
{
  "event": "complete",
  "data": {
    "prId": "pr-uuid",
    "totalFindings": 12,
    "riskScore": 68,
    "author": "developer1"
  }
}
```

10. **`error`** - Analysis failed
```json
{
  "event": "error",
  "data": { "message": "Failed to fetch PR from GitHub" }
}
```

---

## Error Handling

All error responses follow this format:

```json
{
  "error": "Descriptive error message"
}
```

Common HTTP status codes:
- `400` - Bad Request (missing parameters, invalid input)
- `401` - Unauthorized (missing/invalid JWT)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

---

## Rate Limiting

Currently no rate limiting implemented. Future versions may include:
- Per-user rate limits
- Per-project rate limits
- LLM-specific rate limiting