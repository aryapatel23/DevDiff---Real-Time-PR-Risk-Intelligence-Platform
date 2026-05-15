# DevDiff

## 🔍 Real-Time PR Risk Intelligence Platform

*Catch risky code earlier, with less noise.*

---

## 🎯 Features

### Security Analysis
- **20 Security Rules Engine** - Fast pattern-based detection of vulnerabilities
- **Custom ML Scorer** - Random Forest model with 15 engineered features
- **LLM Logic Review** - Groq-powered deep code analysis (optional)
- **Real-time Streaming** - WebSocket-powered live findings

### Developer Insights
- **Risk Scorecards** - Per-developer security performance metrics
- **Heatmaps** - Visualize risk patterns over time
- **Historical Analysis** - Track PR quality across projects
- **Pattern Detection** - Adaptive thresholds based on developer history

### Workflow Integration
- **GitHub OAuth** - Seamless authentication
- **Project Management** - Multi-repo support
- **False Positive Feedback** - Learn from user corrections
- **CLI Tool** - Pre-commit security scanning

---

## 🛠️ Technology Stack

### Frontend
[<img src="https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js&logoColor=white">](https://nextjs.org/)
[<img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black">](https://react.dev/)
[<img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white">](https://www.typescriptlang.org/)
[<img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white">](https://tailwindcss.com/)
[<img src="https://img.shields.io/badge/Framer_Motion-0055FF?style=for-the-badge&logo=framer&logoColor=white">](https://www.framer.com/motion/)
[<img src="https://img.shields.io/badge/Zustand-764ABC?style=for-the-badge&logo=react&logoColor=white">](https://zustand-demo.pmnd.rs/)

### Backend
[<img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white">](https://nodejs.org/)
[<img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white">](https://expressjs.com/)
[<img src="https://img.shields.io/badge/WebSocket-010101?style=for-the-badge&logo=websocket&logoColor=white">](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
[<img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white">](https://www.postgresql.org/)
[<img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white">](https://supabase.com/)

### ML & AI
[<img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white">](https://www.python.org/)
[<img src="https://img.shields.io/badge/scikit_learn-F7931E?style=for-the-badge&logo=scikit-learn&logoColor=white">](https://scikit-learn.org/)
[<img src="https://img.shields.io/badge/Random_Forest-FF6B6B?style=for-the-badge&logo=tree&logoColor=white">](https://en.wikipedia.org/wiki/Random_forest)
[<img src="https://img.shields.io/badge/Groq-FF4500?style=for-the-badge&logo=groq&logoColor=white">](https://groq.com/)

### Security Analysis
[<img src="https://img.shields.io/badge/Tree--sitter-404040?style=for-the-badge&logo=tree-sitter&logoColor=white">](https://tree-sitter.github.io/tree-sitter/)

---

## 📊 Architecture Overview

```mermaid
flowchart LR
  U[User in Next.js UI] -->|OAuth login| S[Supabase Auth]
  U -->|Analyze PR request| B[DevDiff Backend API]
  U <-->|Live findings stream| W[WebSocket /ws/findings/:jobId]

  B -->|Validate JWT + GitHub token| A[Auth Middleware]
  A --> G[GitHub API]
  G -->|PR metadata + changed files| P[Analysis Pipeline]

  P --> R[20 Rule Engine]
  R --> M[Random Forest Scorer]
  P --> L[Groq LLM Logic Reviewer]

  M --> D[(PostgreSQL / Supabase PG)]
  L --> D
  P --> D

  D --> X[Analytics APIs]
  X --> U
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.12+
- PostgreSQL (or Supabase)

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env

# Configure your environment variables
# SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL

# Train ML model
py -3.12 -m pip install -r ml/requirements.txt
py -3.12 ml/train.py

# Setup database
npm run migrate
npm run seed

# Start server
npm run dev
```

### Frontend Setup

```bash
cd frontend
npm install
cp .env.local.example .env.local

# Configure:
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# NEXT_PUBLIC_API_URL (default: http://localhost:4000)

npm run dev
```

### Access
- Frontend: http://localhost:3000
- Backend Health: http://localhost:4000/health

---

## 📝 API Endpoints

### System
- `GET /health` - Health check

### Authentication
- `GET /api/auth/me` - Current user info
- `GET /api/auth/repos` - List GitHub repos

### Projects
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project

### Analyze
- `POST /api/analyze` - Start PR analysis
- `GET /api/analyze/:jobId` - Check job status

### Analytics
- `GET /api/analytics/:projectId/history` - PR history
- `GET /api/analytics/:projectId/scorecard` - Scorecard
- `GET /api/analytics/:projectId/heatmap` - Risk heatmap
- `GET /api/analytics/:projectId/findings/:prId` - PR findings
- `POST /api/analytics/findings/:id/fp` - Mark false positive

### Developer
- `GET /api/developer/:projectId/:author` - Developer profile

---

## 🔐 Security Rules (20 Rules)

| # | Rule | Severity |
|---|------|----------|
| 1 | `secret-leak` | Critical |
| 2 | `sql-injection` | Critical |
| 3 | `eval-usage` | Critical |
| 4 | `xss-innerhtml` | High |
| 5 | `path-traversal` | High |
| 6 | `prototype-pollution` | High |
| 7 | `jwt-no-expiry` | High |
| 8 | `weak-hash` | Medium |
| 9 | `insecure-random` | Medium |
| 10 | `hardcoded-ip` | Medium |
| 11 | `null-deref` | Medium |
| 12 | `missing-validation` | Medium |
| 13 | `redos` | Medium |
| 14 | `memory-leak` | Medium |
| 15 | `async-await-leak` | Medium |
| 16 | `unhandled-promise` | Medium |
| 17 | `sensitive-data-log` | Medium |
| 18 | `console-log` | Low |
| 19 | `missing-rate-limit` | Low |
| 20 | `cors-wildcard` | Low |

---

## 🤖 ML Model Details

### Features (15 engineered features)
- Critical file detection
- Test file detection
- User input presence
- Template literal usage
- Null guards
- Line length buckets
- Object depth
- Async patterns
- And more...

### Model
- **Algorithm**: RandomForestClassifier
- **Estimators**: 300 trees
- **Max Depth**: 12
- **Cross-validation F1**: ~0.92

---

## 📁 Project Structure

```
devdiff/
├── backend/
│   ├── analysis/         # Pipeline + LLM reviewer
│   ├── auth/             # Supabase auth middleware
│   ├── db/               # Schema, queries, seed
│   ├── github/           # PR/repo fetchers
│   ├── intent/           # Ticket validation
│   ├── ml/               # Python ML model
│   ├── parser/           # Diff parser
│   ├── projects/         # Historical import
│   ├── routes/           # API routes
│   ├── rules/            # 20 security rules
│   └── server.js
├── frontend/
│   ├── components/       # UI components
│   ├── lib/              # Auth, websocket, store
│   ├── pages/            # Next.js pages
│   └── styles/
├── cli/
│   └── bin/devdiff.js    # Pre-commit CLI
└── tests/
```

---

## 📖 Documentation

- [API Documentation](./docs/api_documentation.md)
- [Frontend Architecture](./docs/frontend_architecture.md)
- [Backend Architecture](./docs/backend.md)
- [AI & ML Model](./docs/ai_ml_model.md)

---

## 🧪 Testing

```bash
# Backend tests
cd backend
node tests/test_diffParser.js
node tests/test_rules.js
python tests/test_ml.py

# API tests
bash tests/test_api.sh

# CLI tests
node tests/test_cli.js
```

---

## 🔧 CLI Usage

```bash
cd cli
npm install
npm link

devdiff init
devdiff check
devdiff check --json
devdiff check --json --include-tests
```

---

## 🐳 Docker

```bash
docker-compose up --build
```

---

## 📝 License

MIT

---

## 🙏 Acknowledgments

- Supabase for auth & database
- GitHub for OAuth & API access
- Groq for LLM capabilities
- scikit-learn for ML
- Tree-sitter for AST parsing