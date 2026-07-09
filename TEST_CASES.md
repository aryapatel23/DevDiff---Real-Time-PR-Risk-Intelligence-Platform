# DevDiff — Senior Test Engineer Test Suite
## Real-Time PR Risk Intelligence Platform

**Version**: v0.1 | **Date**: 2026-07-09 | **Tester**: Senior Test Engineer (Black Box)

---

## TABLE OF CONTENTS

1. [Authentication (AUTH-xxx)](#1-authentication)
2. [Dashboard (DASH-xxx)](#2-dashboard)
3. [Project Creation (PROJ-xxx)](#3-project-creation)
4. [PR Analysis (ANAL-xxx)](#4-pr-analysis)
5. [Findings Display (FIND-xxx)](#5-findings-display)
6. [Developer Scorecard (SCOR-xxx)](#6-developer-scorecard)
7. [File Heatmap (HEAT-xxx)](#7-file-heatmap)
8. [History Page (HIST-xxx)](#8-history-page)
9. [Developer Profile (PROF-xxx)](#9-developer-profile)
10. [WebSocket Streaming (WS-xxx)](#10-websocket-streaming)
11. [Navigation & Layout (NAV-xxx)](#11-navigation--layout)
12. [Error Handling (ERR-xxx)](#12-error-handling)
13. [Unused Components (UNUSED-xxx)](#13-unused-components)
14. [Export Features (EXP-xxx)](#14-export-features)
15. [Summary Table](#15-summary-table)
16. [Risk Matrix](#16-risk-matrix)
17. [Acceptance Criteria](#17-acceptance-criteria)
18. [Known Bugs List](#18-known-bugs-list)
19. [Priority Fix Order](#19-priority-fix-order)

---

## 1. AUTHENTICATION

### TEST CASE: AUTH-001 - Login Page Visual Elements
- **Priority**: Medium
- **Type**: Happy Path
- **Precondition**: No active session
- **Steps**:
  1. Navigate to `http://localhost:3000/login`
  2. Observe all page elements
- **Expected**: Page displays DevDiff logo (ShieldCheck icon in blue-purple gradient), "DevDiff" heading, tagline "PR intelligence that remembers your patterns", two feature badges ("Real-time Risk Analysis", "Custom ML Scoring Engine"), "Continue with GitHub" button, and disclaimer text. Background has animated blue/purple gradient blobs.
- **Actual**:
- **Status**:
- **Notes**: Uses framer-motion for entrance animation. Button shows Github icon.

### TEST CASE: AUTH-002 - Unauthenticated Root Redirect
- **Priority**: Critical
- **Type**: Happy Path
- **Precondition**: No active session
- **Steps**:
  1. Navigate to `http://localhost:3000/`
  2. Wait for page load and redirect
- **Expected**: User is redirected to `/login` page. No content from root page is visible.
- **Actual**:
- **Status**:
- **Notes**: `index.tsx` checks session and calls `router.replace('/login')`.

### TEST CASE: AUTH-003 - Authenticated Root Redirect
- **Priority**: Critical
- **Type**: Happy Path
- **Precondition**: Active Supabase session exists
- **Steps**:
  1. Log in via GitHub OAuth
  2. Navigate to `http://localhost:3000/`
- **Expected**: User is redirected to `/dashboard`. No content from root page is visible.
- **Actual**:
- **Status**:
- **Notes**: `index.tsx` calls `router.replace('/dashboard')`.

### TEST CASE: AUTH-004 - GitHub OAuth Login Flow
- **Priority**: Critical
- **Type**: Happy Path
- **Precondition**: No active session. Supabase configured with GitHub OAuth. GitHub account available.
- **Steps**:
  1. Navigate to `/login`
  2. Click "Continue with GitHub" button
  3. On GitHub, authorize the DevDiff OAuth app
  4. Wait for redirect back to app
- **Expected**: Redirect to GitHub authorization page. After approval, redirected to `/dashboard`. Session established. User email/initials visible in sidebar. GitHub token stored as provider_token.
- **Actual**:
- **Status**:
- **Notes**: OAuth scopes: "repo user:email". Redirect URL from env or origin + /dashboard.

### TEST CASE: AUTH-005 - OAuth Redirect Cancelled
- **Priority**: High
- **Type**: Error
- **Precondition**: No active session
- **Steps**:
  1. Navigate to `/login`
  2. Click "Continue with GitHub"
  3. On GitHub, click "Cancel" or navigate away
- **Expected**: User redirected back to app. Login page remains visible. No session created. **No error shown (silent failure).**
- **Actual**:
- **Status**:
- **Notes**: KNOWN ISSUE — No error display if OAuth fails.

### TEST CASE: AUTH-006 - Session Persists Across Reload
- **Priority**: Critical
- **Type**: Happy Path
- **Precondition**: User is logged in
- **Steps**:
  1. Log in via GitHub OAuth
  2. Navigate to `/dashboard`
  3. Press F5 to refresh page
  4. Wait for page to reload
- **Expected**: Page reloads. User remains on `/dashboard`. Sidebar still shows user info. Session restored from Supabase storage. No redirect to `/login`.
- **Actual**:
- **Status**:
- **Notes**: AuthProvider calls `getSession()` on mount to restore session.

### TEST CASE: AUTH-007 - Login Button Disabled During Load
- **Priority**: Medium
- **Type**: Loading
- **Precondition**: No session, app initializing
- **Steps**:
  1. Navigate to `/login`
  2. Observe button state while `loading=true`
- **Expected**: "Continue with GitHub" button is visually disabled (opacity-50). Not clickable.
- **Actual**:
- **Status**:
- **Notes**: Button uses `disabled={loading}`.

### TEST CASE: AUTH-008 - Logout Clears Session
- **Priority**: Critical
- **Type**: Happy Path
- **Precondition**: User is logged in, on `/dashboard`
- **Steps**:
  1. Click "Sign out" button in sidebar
  2. Wait for session to clear
- **Expected**: Session cleared. `githubToken` set to null. User redirected to `/login`. Sidebar not visible.
- **Actual**:
- **Status**:
- **Notes**: `signOut()` calls `supabase.auth.signOut()`.

### TEST CASE: AUTH-009 - Logout From Dashboard Header
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: User logged in, on `/dashboard`
- **Steps**:
  1. Click "Sign out" button in dashboard header
- **Expected**: Session clears. User redirected to `/login`.
- **Actual**:
- **Status**:
- **Notes**: Dashboard has its own signOut button.

### TEST CASE: AUTH-010 - Already Auth Redirect from Login
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: Active session exists
- **Steps**:
  1. Navigate to `http://localhost:3000/login`
  2. Wait for page load
- **Expected**: Page detects session and redirects to `/dashboard` via `router.replace()`. Login page not rendered.
- **Actual**:
- **Status**:
- **Notes**: `useEffect` in `login.tsx`: `if (!loading && session) router.replace('/dashboard')`.

### TEST CASE: AUTH-011 - Protected Route Redirect
- **Priority**: Critical
- **Type**: Error
- **Precondition**: No active session
- **Steps**:
  1. Navigate directly to `http://localhost:3000/dashboard` (without login)
  2. Wait for page load
- **Expected**: Dashboard detects no session and redirects to `/login`. No dashboard content visible.
- **Actual**:
- **Status**:
- **Notes**: `dashboard.tsx` useEffect: `if (!loading && !session) router.replace('/login')`.

### TEST CASE: AUTH-012 - No Email/Password Fallback
- **Priority**: Medium
- **Type**: Edge Case
- **Precondition**: No active session
- **Steps**:
  1. Navigate to `/login`
  2. Inspect page for email/password login form
- **Expected**: No email input. No password input. Only "Continue with GitHub" button exists.
- **Actual**:
- **Status**:
- **Notes**: KNOWN LIMITATION — GitHub OAuth is the only auth method.

### TEST CASE: AUTH-013 - Token Expiry Mid-Session
- **Priority**: High
- **Type**: Error
- **Precondition**: User logged in, token near expiry
- **Steps**:
  1. Log in and wait for token to expire
  2. Perform any action (e.g., load projects)
  3. Observe behavior
- **Expected**: API returns 401. Frontend should redirect to `/login` or show error. No unhandled exception.
- **Actual**:
- **Status**:
- **Notes**: KNOWN ISSUE — No explicit 401 handler in most fetch calls.

### TEST CASE: AUTH-014 - Login No Loading State Feedback
- **Priority**: Medium
- **Type**: Loading
- **Precondition**: No session, clicking login
- **Steps**:
  1. Navigate to `/login`
  2. Click "Continue with GitHub"
  3. Observe UI during OAuth redirect
- **Expected**: Button should show loading spinner or visual feedback while redirecting.
- **Actual**:
- **Status**:
- **Notes**: KNOWN ISSUE — No loading state feedback during OAuth redirect.

### TEST CASE: AUTH-015 - Concurrent Tabs Session
- **Priority**: Medium
- **Type**: Edge Case
- **Precondition**: User logged in tab A
- **Steps**:
  1. Log in on tab A
  2. Open tab B, navigate to localhost:3000
  3. Verify session on tab B
  4. On tab A, click Sign out
  5. Check tab B
- **Expected**: Tab B shows `/login` after tab A signs out. Supabase `onAuthStateChange` propagates across tabs.
- **Actual**:
- **Status**:
- **Notes**: Supabase uses localStorage which shares across tabs.

---

## 2. DASHBOARD

### TEST CASE: DASH-001 - Dashboard Loads for Auth User
- **Priority**: Critical
- **Type**: Happy Path
- **Precondition**: User is logged in
- **Steps**:
  1. Log in via GitHub OAuth
  2. Wait for redirect to `/dashboard`
- **Expected**: Header shows "Dashboard" heading with subtitle. "New Project" and "Sign out" buttons in header. Project list or empty state visible. Sidebar visible with navigation.
- **Actual**:
- **Status**:
- **Notes**: Fetches projects from `GET /api/projects`.

### TEST CASE: DASH-002 - Loading State Display
- **Priority**: Critical
- **Type**: Loading
- **Precondition**: User logged in, API call in progress
- **Steps**:
  1. Log in
  2. Observe while `GET /api/projects` is loading
- **Expected**: Shows centered spinner (Activity icon with `animate-spin`) and "Loading your projects..." text.
- **Actual**:
- **Status**:
- **Notes**: BUG — Loading spinner shows indefinitely if API never responds. No timeout, no error fallback.

### TEST CASE: DASH-003 - Loading Timeout (BUG)
- **Priority**: Critical
- **Type**: Error
- **Precondition**: Backend server is slow or unresponsive
- **Steps**:
  1. Slow down or stop backend API
  2. Log in and navigate to `/dashboard`
  3. Wait 30+ seconds
- **Expected**: Should show error state or timeout message after reasonable time. Should NOT spin forever.
- **Actual**:
- **Status**:
- **Notes**: KNOWN BUG — No timeout on `loadProjects()`. "Loading your projects..." shows indefinitely. No console output on failure.

### TEST CASE: DASH-004 - Empty State Display
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: User logged in, no projects exist
- **Steps**:
  1. Log in as user with no projects
  2. Wait for loading to complete
- **Expected**: Shows empty state with FolderOpen icon (with ping animation), "No projects found" heading, description text, and "Connect your first repository" button that opens create project modal.
- **Actual**:
- **Status**:
- **Notes**: Animated entrance with framer-motion scale/opacity.

### TEST CASE: DASH-005 - Error State Display
- **Priority**: High
- **Type**: Error
- **Precondition**: Backend returns error or is down
- **Steps**:
  1. Stop backend server
  2. Log in and navigate to `/dashboard`
  3. Wait for fetch to fail
- **Expected**: Red error banner appears below header with AlertCircle icon and error message text. Loading spinner disappears.
- **Actual**:
- **Status**:
- **Notes**: Error banner uses `motion.div` animation.

### TEST CASE: DASH-006 - Project Card Display
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: User has at least one project
- **Steps**:
  1. Log in and navigate to `/dashboard`
  2. Observe project cards
- **Expected**: Each card shows: FolderGit2 icon, project name (truncated), Lock icon for private repos, GitHub repo path (mono font), description text (2-line clamp), import status, PR count, finding count. Card is wrapped in Link to `/projects/{id}`.
- **Actual**:
- **Status**:
- **Notes**: Cards have hover state with blue border.

### TEST CASE: DASH-007 - Import Status Indicators
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: User has projects with different statuses
- **Steps**:
  1. View dashboard with multiple projects
  2. Observe status labels on each card
- **Expected**: Correct status labels:
  - `pending`: "Pending sync" (gray)
  - `running`: "Syncing (N/30)..." with pulse animation (blue)
  - `done`: "N PRs indexed" (emerald)
  - `error`: "Sync failed" (red)
- **Actual**:
- **Status**:
- **Notes**: Uses Activity icon with `animate-pulse` for running.

### TEST CASE: DASH-008 - Card Click Navigation
- **Priority**: Critical
- **Type**: Happy Path
- **Precondition**: User has at least one project
- **Steps**:
  1. Click on a project card
- **Expected**: Navigates to `/projects/{id}`. URL changes. Project detail page loads.
- **Actual**:
- **Status**:
- **Notes**: Card wrapped in `<Link href={/projects/${p.id}}>`.

### TEST CASE: DASH-009 - Card Hover State
- **Priority**: Low
- **Type**: Happy Path
- **Precondition**: User has projects
- **Steps**:
  1. Hover mouse over a project card
- **Expected**: Border changes to `blue-500/50`. Background changes to `gray-900/50`. Smooth 300ms transition.
- **Actual**:
- **Status**:
- **Notes**: Uses Tailwind hover classes with `transition-all duration-300`.

### TEST CASE: DASH-010 - Grid Responsive Layout
- **Priority**: Medium
- **Type**: Edge Case
- **Precondition**: User has 3+ projects
- **Steps**:
  1. Set viewport to 1200px (desktop) — observe grid
  2. Resize to 768px (tablet) — observe grid
  3. Resize to 375px (mobile) — observe grid
- **Expected**: Desktop: 3-column grid (`lg:grid-cols-3`). Tablet: 2-column (`md:grid-cols-2`). Mobile: 1-column (default).
- **Actual**:
- **Status**:
- **Notes**: Uses `grid md:grid-cols-2 lg:grid-cols-3 gap-5`.

### TEST CASE: DASH-011 - SortedProjects Memo No-Op (BUG)
- **Priority**: Low
- **Type**: Edge Case
- **Precondition**: User has multiple projects
- **Steps**:
  1. Create 3 projects with different names
  2. Observe project order on dashboard
  3. Reload page and observe order again
- **Expected**: Projects should be sorted by some consistent order.
- **Actual**:
- **Status**:
- **Notes**: BUG — `sortedProjects` memo is `useMemo(() => projects, [projects])`. Returns same array unchanged. No actual sorting.

### TEST CASE: DASH-012 - No Search/Filter for Projects
- **Priority**: Low
- **Type**: Edge Case
- **Precondition**: User has 10+ projects
- **Steps**:
  1. View dashboard with many projects
  2. Look for search bar or filter controls
- **Expected**: No search bar. No filter options.
- **Actual**:
- **Status**:
- **Notes**: KNOWN LIMITATION — No search/filter for projects.

---

## 3. PROJECT CREATION

### TEST CASE: PROJ-001 - Open Create Project Modal
- **Priority**: Critical
- **Type**: Happy Path
- **Precondition**: User on `/dashboard`
- **Steps**:
  1. Click "New Project" button in header
- **Expected**: Modal overlay appears with dark backdrop (`bg-black/80 backdrop-blur-sm`). Contains: "Add New Project" heading, close (X) button, Project Name input, Target Repository with Select/Manual toggle, Description textarea (optional), Cancel and Create Project buttons.
- **Actual**:
- **Status**:
- **Notes**: Modal uses AnimatePresence for enter/exit.

### TEST CASE: PROJ-002 - Repo List Loading State
- **Priority**: High
- **Type**: Loading
- **Precondition**: Modal opening
- **Steps**:
  1. Click "New Project"
  2. Observe repository selector immediately
- **Expected**: Shows "Connecting to GitHub..." with spinner while repos load from `GET /api/auth/repos`.
- **Actual**:
- **Status**:
- **Notes**: `reposLoading` state controls spinner display.

### TEST CASE: PROJ-003 - Repo Dropdown Populated
- **Priority**: Critical
- **Type**: Happy Path
- **Precondition**: User has GitHub repos accessible
- **Steps**:
  1. Open create project modal
  2. Wait for repos to load
  3. Click on repo dropdown
- **Expected**: Select dropdown shows repos in format: "[lock] owner/repo (language)". Private repos show lock emoji. First repo auto-selected.
- **Actual**:
- **Status**:
- **Notes**: If no repos, falls back to manual mode.

### TEST CASE: PROJ-004 - Toggle Select/Manual Mode
- **Priority**: Medium
- **Type**: Happy Path
- **Precondition**: Modal is open
- **Steps**:
  1. Click "Manual" toggle
  2. Observe input field changes
  3. Click "Select" toggle
  4. Observe input field changes back
- **Expected**: Manual: text input with placeholder "owner/repo". Select: dropdown with repo list. Toggle buttons have active/inactive visual states.
- **Actual**:
- **Status**:
- **Notes**: Default mode is 'list' if repos loaded, 'manual' if repos failed.

### TEST CASE: PROJ-005 - Create Button Disabled (Empty)
- **Priority**: Medium
- **Type**: Edge Case
- **Precondition**: Modal is open
- **Steps**:
  1. Leave project name empty
  2. Observe "Create Project" button
  3. Fill name, leave repo empty (manual mode)
  4. Observe button
- **Expected**: Button disabled (opacity-50) when name empty OR repo empty. Enabled only when all required fields filled.
- **Actual**:
- **Status**:
- **Notes**: Disabled: `saving || !name || (repoInputMode==='manual' ? !manualRepo.trim() : !selectedRepo)`.

### TEST CASE: PROJ-006 - Successful Creation (List Mode)
- **Priority**: Critical
- **Type**: Happy Path
- **Precondition**: Modal open, repos loaded
- **Steps**:
  1. Enter project name "Test Project"
  2. Select a repo from dropdown
  3. Enter description "Test description"
  4. Click "Create Project"
- **Expected**: Button shows "Creating..." with spinner. API call to `POST /api/projects`. On success: modal closes, form resets, project list reloads with new project.
- **Actual**:
- **Status**:
- **Notes**: BUG — Shows "Creating..." forever with no console output. Backend may not process request.

### TEST CASE: PROJ-007 - Successful Creation (Manual Mode)
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: Modal open
- **Steps**:
  1. Switch to "Manual" mode
  2. Enter "owner/repo" in text field
  3. Enter project name
  4. Click "Create Project"
- **Expected**: Creates project with manually entered repo. `is_private` defaults to false.
- **Actual**:
- **Status**:
- **Notes**: Manual repos get `is_private: false` by default.

### TEST CASE: PROJ-008 - Cancel Closes and Resets Form
- **Priority**: Medium
- **Type**: Happy Path
- **Precondition**: Modal open with fields filled
- **Steps**:
  1. Fill in project name and description
  2. Click "Cancel"
  3. Reopen modal
- **Expected**: Modal closes. On reopen, form is reset: name empty, description empty, repo at default.
- **Actual**:
- **Status**:
- **Notes**: `setShowAdd(false)` closes. Reset in `openAddModal` and `createProject` success.

### TEST CASE: PROJ-009 - Close Modal via X Button
- **Priority**: Low
- **Type**: Happy Path
- **Precondition**: Modal is open
- **Steps**:
  1. Click the "✕" button in modal header
- **Expected**: Modal closes.
- **Actual**:
- **Status**:
- **Notes**: `setShowAdd(false)`.

### TEST CASE: PROJ-010 - Close Modal via Backdrop Click
- **Priority**: Low
- **Type**: Happy Path
- **Precondition**: Modal is open
- **Steps**:
  1. Click outside modal on dark overlay
- **Expected**: Modal closes.
- **Actual**:
- **Status**:
- **Notes**: Overlay has onClick via motion.div.

### TEST CASE: PROJ-011 - Repo Fetch Failure Fallback
- **Priority**: High
- **Type**: Error
- **Precondition**: GitHub API unavailable or auth error
- **Steps**:
  1. Open create project modal
  2. Wait for repo fetch to fail
- **Expected**: Error message shown. Repo selector falls back to manual input mode.
- **Actual**:
- **Status**:
- **Notes**: Catch block sets `repoInputMode` to 'manual'.

### TEST CASE: PROJ-012 - Failed Creation Error State
- **Priority**: High
- **Type**: Error
- **Precondition**: Modal open, API returns error
- **Steps**:
  1. Fill in project name and repo
  2. Click "Create Project"
  3. API returns error response
- **Expected**: Error banner appears in modal. Form remains filled (user can retry). Button returns to "Create Project" state.
- **Actual**:
- **Status**:
- **Notes**: `setError(e.message)` in catch block.

### TEST CASE: PROJ-013 - Description Field Optional
- **Priority**: Medium
- **Type**: Edge Case
- **Precondition**: Modal is open
- **Steps**:
  1. Enter project name and select repo
  2. Leave description empty
  3. Click "Create Project"
- **Expected**: Project created successfully. No validation error for empty description.
- **Actual**:
- **Status**:
- **Notes**: Label says "(Optional)". No required validation.

### TEST CASE: PROJ-014 - No Duplicate Project Check
- **Priority**: Medium
- **Type**: Edge Case
- **Precondition**: Project "X" already exists
- **Steps**:
  1. Open create project modal
  2. Enter same name and repo as existing project
  3. Click "Create Project"
- **Expected**: Should either prevent duplicate or show error.
- **Actual**:
- **Status**:
- **Notes**: KNOWN LIMITATION — No duplicate check in UI.

### TEST CASE: PROJ-015 - Manual Input No Validation
- **Priority**: Medium
- **Type**: Edge Case
- **Precondition**: Modal open, manual mode
- **Steps**:
  1. Switch to manual mode
  2. Enter invalid repo format (e.g., "just-a-name")
  3. Enter project name
  4. Click "Create Project"
- **Expected**: Should validate repo format (owner/repo).
- **Actual**:
- **Status**:
- **Notes**: KNOWN ISSUE — Manual input doesn't validate repo format or existence.

--- END OF PART 1 ---

---

## 4. PR ANALYSIS

### TEST CASE: ANAL-001 - Project Detail Page Loads
- **Priority**: Critical
- **Type**: Happy Path
- **Precondition**: User logged in, project exists
- **Steps**:
  1. Navigate to `/projects/{id}`
  2. Wait for page load
- **Expected**: Header shows project name and GitHub repo. "Back to Dashboard" link present. Analysis panel with PR URL input, ticket URL input, Analyze button, Risk Meter visible. Navigation tabs (History, Scorecard, Heatmap) at bottom. Delete Project button in header.
- **Actual**:
- **Status**:
- **Notes**: Fetches project via `GET /api/projects/{id}`.

### TEST CASE: ANAL-002 - Valid PR URL Submission
- **Priority**: Critical
- **Type**: Happy Path
- **Precondition**: Project loaded, valid PR URL
- **Steps**:
  1. Enter valid PR URL: `https://github.com/owner/repo/pull/123`
  2. Click "Analyze" button
- **Expected**: Button shows "Analyzing..." with Loader2 spinner. API call to `POST /api/analyze` with `{prUrl, projectId, ticketUrl}`. Phase indicator shows "Starting analysis...". Previous findings cleared.
- **Actual**:
- **Status**:
- **Notes**: Validates `prUrl.trim()` before submission.

### TEST CASE: ANAL-003 - Analyze Button Disabled States
- **Priority**: Medium
- **Type**: Edge Case
- **Precondition**: On project detail page
- **Steps**:
  1. Leave PR URL empty, observe button
  2. Enter PR URL, start analysis, observe button
- **Expected**: Button disabled (opacity-50) when URL empty. Button disabled during analysis (shows spinner).
- **Actual**:
- **Status**:
- **Notes**: `disabled={isAnalyzing || !prUrl.trim()}`.

### TEST CASE: ANAL-004 - Phase Indicator Updates
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: PR analysis submitted
- **Steps**:
  1. Submit valid PR for analysis
  2. Watch phase indicator in analysis panel
- **Expected**: Phase text updates: "Starting analysis..." → "PR loaded" → "Running rule checks..." → "Streaming findings..." → "Running logic review..." → "Logic review completed" → "Complete"
- **Actual**:
- **Status**:
- **Notes**: Phase text set by WebSocket event handlers.

### TEST CASE: ANAL-005 - Risk Meter Updates
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: Analysis in progress with findings
- **Steps**:
  1. Submit PR that produces critical and warning findings
  2. Watch risk meter bar and score
- **Expected**: Risk meter starts at 0/100. Increments: +12 per critical, +4 per warning. Final score set by `complete` event. Bar animates from left. Color: green (<40), amber (40-69), red (>=70). Label: "Low/Medium/High Risk".
- **Actual**:
- **Status**:
- **Notes**: Score capped at 100 via `Math.min(100, prev+N)`.

### TEST CASE: ANAL-006 - PR Metadata Display
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: `pr_meta` event received via WebSocket
- **Steps**:
  1. Submit PR for analysis
  2. Wait for `pr_meta` event
- **Expected**: PR metadata card shows: PR number, title, author, file count, external link icon linking to GitHub PR. Purple GitPullRequest icon.
- **Actual**:
- **Status**:
- **Notes**: Phase text updates to "PR loaded" on receipt.

### TEST CASE: ANAL-007 - Invalid PR URL
- **Priority**: High
- **Type**: Error
- **Precondition**: On project detail page
- **Steps**:
  1. Enter invalid URL: "not-a-url"
  2. Click "Analyze"
- **Expected**: API returns error. Error banner shown. Phase text shows "Error". Analysis stops.
- **Actual**:
- **Status**:
- **Notes**: Basic URL validation via regex on backend.

### TEST CASE: ANAL-008 - PR From Different Repo
- **Priority**: High
- **Type**: Error
- **Precondition**: Project linked to repo A
- **Steps**:
  1. Enter PR URL from repo B (different owner/repo)
  2. Click "Analyze"
- **Expected**: Backend should detect mismatch and return error. Error banner shown.
- **Actual**:
- **Status**:
- **Notes**: UI hint: "PRs must belong to {github_repo}". Validation may be backend-only.

### TEST CASE: ANAL-009 - Clean PR (Zero Findings)
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: PR with no security issues
- **Steps**:
  1. Analyze a clean PR
  2. Wait for analysis to complete
- **Expected**: Shows "All Clear!" message with ShieldCheck icon (emerald). Summary shows 0 findings, 0/100 risk. "Check Another PR" button appears.
- **Actual**:
- **Status**:
- **Notes**: Condition: `summary && findings.length === 0 && !error`.

### TEST CASE: ANAL-010 - Check Another PR Button
- **Priority**: Medium
- **Type**: Happy Path
- **Precondition**: Analysis just completed
- **Steps**:
  1. Complete a PR analysis
  2. Click "Check Another PR" button
- **Expected**: Resets: PR URL, ticket URL, findings, PR meta, summary, risk score, phase text (back to "Idle"). Button disappears after click.
- **Actual**:
- **Status**:
- **Notes**: Button only shows when `!isAnalyzing && phaseText === 'Complete'`.

### TEST CASE: ANAL-011 - Delete Project Flow
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: On project detail page
- **Steps**:
  1. Click "Delete Project" button
  2. Confirm in browser dialog
  3. Wait for API response
- **Expected**: Browser confirm dialog shown. On confirm: `DELETE /api/projects/{id}`. On success: redirect to `/dashboard`.
- **Actual**:
- **Status**:
- **Notes**: Uses `window.confirm()`.

### TEST CASE: ANAL-012 - Delete Project Cancel
- **Priority**: Medium
- **Type**: Happy Path
- **Precondition**: On project detail page
- **Steps**:
  1. Click "Delete Project"
  2. Click "Cancel" in confirm dialog
- **Expected**: Dialog closes. No deletion. Page unchanged.
- **Actual**:
- **Status**:
- **Notes**: `if (!confirmed) return;`.

### TEST CASE: ANAL-013 - No Cancel Analysis Button
- **Priority**: Medium
- **Type**: Edge Case
- **Precondition**: Analysis in progress
- **Steps**:
  1. Start analysis
  2. Look for cancel/stop button
- **Expected**: No cancel button visible. Once started, analysis cannot be stopped by user.
- **Actual**:
- **Status**:
- **Notes**: KNOWN LIMITATION — No cancel analysis button.

### TEST CASE: ANAL-014 - Network Drop During Analysis
- **Priority**: High
- **Type**: Error
- **Precondition**: Analysis in progress
- **Steps**:
  1. Start analysis
  2. Kill backend server mid-analysis
  3. Observe UI behavior
- **Expected**: WebSocket closes. `isAnalyzing` set to false. No visual error notification shown (silent failure).
- **Actual**:
- **Status**:
- **Notes**: BUG — No reconnection logic. WebSocket errors silently call `onDone()`.

### TEST CASE: ANAL-015 - Ticket URL Optional
- **Priority**: Low
- **Type**: Edge Case
- **Precondition**: On project detail page
- **Steps**:
  1. Enter PR URL, leave ticket URL empty, submit
  2. Enter PR URL with ticket URL, submit
- **Expected**: Both analyses proceed. Ticket URL optional, only sent if non-empty.
- **Actual**:
- **Status**:
- **Notes**: `ticketUrl` sent as `undefined` if empty.

### TEST CASE: ANAL-016 - Large PR Analysis
- **Priority**: Medium
- **Type**: Edge Case
- **Precondition**: PR with 100+ changed files
- **Steps**:
  1. Analyze PR with 100+ files
  2. Observe streaming and rendering
- **Expected**: Findings stream in real-time. Page may become slow but should not crash. No virtualization — all findings rendered to DOM.
- **Actual**:
- **Status**:
- **Notes**: No virtualization for findings list. Performance degrades with 50+ findings.

### TEST CASE: ANAL-017 - High Risk PR Score Capping
- **Priority**: Medium
- **Type**: Edge Case
- **Precondition**: PR triggering many critical findings
- **Steps**:
  1. Analyze PR that produces 10+ critical findings
  2. Observe risk score
- **Expected**: Risk score increments by 12 per critical. Caps at 100/100 (`Math.min(100, prev+12)`). "High Risk" label in red.
- **Actual**:
- **Status**:
- **Notes**: 9 critical = 108 → capped to 100.

---

## 5. FINDINGS DISPLAY

### TEST CASE: FIND-001 - Findings Grouped by File
- **Priority**: Critical
- **Type**: Happy Path
- **Precondition**: PR analysis complete with findings
- **Steps**:
  1. Complete analysis with findings from multiple files
  2. Scroll to findings section
- **Expected**: Findings grouped by filename. Each file group has: FileCode2 icon, filename (mono font), issue count. Individual findings show: SeverityBadge, rule name, line number, confidence %, message. Divider lines between findings.
- **Actual**:
- **Status**:
- **Notes**: Uses `grouped` useMemo to group by filename.

### TEST CASE: FIND-002 - Severity Badge Colors
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: Findings with all severity levels
- **Steps**:
  1. View findings with critical, warning, info, and suggestion severities
- **Expected**: Correct badge styling:
  - critical: red bg, red text, ShieldAlert icon
  - warning: amber bg, amber text, AlertCircle icon
  - info: sky bg, sky text, Zap icon
  - suggestion: gray bg, gray text, Lightbulb icon
- **Actual**:
- **Status**:
- **Notes**: Uses SeverityBadge component with config map.

### TEST CASE: FIND-003 - ConfidenceBadge Color Inversion (BUG)
- **Priority**: High
- **Type**: Error (Bug)
- **Precondition**: Finding with high confidence (>=80%)
- **Steps**:
  1. View finding with confidence >= 80%
  2. Observe confidence badge color
- **Expected**: High confidence should show GREEN (reliable finding). Low confidence should show gray/red.
- **Actual**:
- **Status**:
- **Notes**: KNOWN BUG — ConfidenceBadge.tsx: >=80% = `bg-red-900 text-red-300` (BAD), >=60% = amber, <60% = gray. Colors are inverted. Should be: >=80% = green, <60% = red.

### TEST CASE: FIND-004 - Danger Zone Badge
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: File with 5+ findings
- **Steps**:
  1. Analyze PR producing 5+ findings in one file
  2. View findings section
- **Expected**: File group header shows "DANGER ZONE" badge (red). File border changes to `red-900/50`. Background tinted red. FileCode2 icon turns red.
- **Actual**:
- **Status**:
- **Notes**: Condition: `rows.length >= 5` per filename.

### TEST CASE: FIND-005 - Fix Hint Expand/Collapse
- **Priority**: Medium
- **Type**: Happy Path
- **Precondition**: Finding with `fix_hint` text
- **Steps**:
  1. Find finding with "View fix suggestion" link
  2. Click the link
  3. Click again
- **Expected**: First click: section expands showing fix hint in monospace on gray background. ChevronDown rotates 180°. Second click: collapses.
- **Actual**:
- **Status**:
- **Notes**: Uses HTML `<details>` element.

### TEST CASE: FIND-006 - Mark as False Positive (Stage 1)
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: Finding with `false_positive=0`
- **Steps**:
  1. Find finding with "Mark as False Positive" button
  2. Click button
  3. Wait for API response
- **Expected**: Button shows "Saving...". API `POST /api/analytics/findings/{id}/fp`. Finding updates: `false_positive=1`, severity changes to "info". "LOW PRIORITY" badge appears. Button text changes to "Mark Again to Ignore". Risk score may update.
- **Actual**:
- **Status**:
- **Notes**: `advanceFindingSuppression` handles the update.

### TEST CASE: FIND-007 - Mark Again to Ignore (Stage 2)
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: Finding with `false_positive=1`
- **Steps**:
  1. Find finding with "Mark Again to Ignore" button
  2. Click button
  3. Wait for API response
- **Expected**: Finding updates to `false_positive>=2`. "IGNORED" badge (gray). "Ignored in future scans for this same file + rule" text. Button disappears. Finding moves to "Ignored" filter tab.
- **Actual**:
- **Status**:
- **Notes**: Second click advances fp from 1 to 2.

### TEST CASE: FIND-008 - Filter by Severity
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: Multiple findings with different severities
- **Steps**:
  1. Click "Critical" filter
  2. Click "Warnings" filter
  3. Click "Info" filter
  4. Click "All" filter
- **Expected**: Each filter shows only matching severity. Active filter highlighted (blue bg/border). Counts update. "No findings for this filter" when zero matches.
- **Actual**:
- **Status**:
- **Notes**: Filters also consider `false_positive` level: ignored (fp>=2), low (fp==1), all (fp<=1).

### TEST CASE: FIND-009 - Critical Finding Highlight
- **Priority**: Medium
- **Type**: Happy Path
- **Precondition**: Finding with `severity=critical`, `fp=0`
- **Steps**:
  1. View critical finding
- **Expected**: Critical finding row has red left border (`border-l-2 border-red-500/40`) and red-tinted background (`bg-red-950/10`).
- **Actual**:
- **Status**:
- **Notes**: Condition: `severity === 'critical' && false_positive === 0`.

### TEST CASE: FIND-010 - Multiple Findings Per File
- **Priority**: Medium
- **Type**: Edge Case
- **Precondition**: File with 3 findings
- **Steps**:
  1. View file group with multiple findings
- **Expected**: All findings listed under same filename header. Issue count shows "3 issues". Divider lines between findings.
- **Actual**:
- **Status**:
- **Notes**: Issue count shows "issues" plural for >1.

### TEST CASE: FIND-011 - Summary Card After Analysis
- **Priority**: Medium
- **Type**: Happy Path
- **Precondition**: Analysis complete with findings
- **Steps**:
  1. Complete analysis with findings
  2. Scroll to summary section
- **Expected**: "Analysis Complete" card: total findings count, risk score (color-coded), author name. 3-column grid. CheckCircle2 icon (emerald).
- **Actual**:
- **Status**:
- **Notes**: Only shown when `summary` exists AND `findings.length > 0`.

### TEST CASE: FIND-012 - New User Notification
- **Priority**: Low
- **Type**: Happy Path
- **Precondition**: Author is first-time user
- **Steps**:
  1. Analyze PR from a first-time author
  2. Observe notification area
- **Expected**: Blue notification banner with UserPlus icon and personalized welcome message.
- **Actual**:
- **Status**:
- **Notes**: `setNewUserMsg(msg.data?.message || '')`.

---

## 6. DEVELOPER SCORECARD

### TEST CASE: SCOR-001 - Global Scorecard Loads
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: User logged in, developer data exists
- **Steps**:
  1. Navigate to `/scorecard`
  2. Wait for data to load
- **Expected**: Header shows "Team Health Scorecard" with Users icon. "Last 30 days" badge. Developer count. Developer cards visible.
- **Actual**:
- **Status**:
- **Notes**: Fetches from `GET /api/scorecard`.

### TEST CASE: SCOR-002 - Scorecard Empty State
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: No developer data
- **Steps**:
  1. Navigate to `/scorecard` with no data
- **Expected**: Shows "No team data yet" with Users icon, description about needing 2+ PR analyses, and "Go to Dashboard" button.
- **Actual**:
- **Status**:
- **Notes**: Empty state message is informative.

### TEST CASE: SCOR-003 - Developer Badge Colors
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: Developers with different scores
- **Steps**:
  1. View scorecard with developers scoring 85, 60, 30
- **Expected**: Badge per developer:
  - Score 85: "Clean" (green bg, ShieldCheck icon)
  - Score 60: "Watch" (amber bg, Activity icon)
  - Score 30: "Risky" (red bg, AlertTriangle icon)
- **Actual**:
- **Status**:
- **Notes**: Thresholds: Clean >=80, Watch >=50, Risky <50.

### TEST CASE: SCOR-004 - Score Bar Animation
- **Priority**: Medium
- **Type**: Happy Path
- **Precondition**: Developer data loaded
- **Steps**:
  1. Load scorecard page
  2. Watch score bars
- **Expected**: Score bars animate from 0% to actual width with 0.8s easeOut transition. Bar color matches score (green >=80, amber >=50, red <50).
- **Actual**:
- **Status**:
- **Notes**: Uses `motion.div` with `initial={{ width: 0 }}`.

### TEST CASE: SCOR-005 - Auto-Escalation Warning
- **Priority**: Medium
- **Type**: Happy Path
- **Precondition**: Developer with score < 50
- **Steps**:
  1. View scorecard with low-scoring developer
- **Expected**: Red warning banner: "Rules have been auto-escalated for this developer's future PRs." with AlertTriangle icon.
- **Actual**:
- **Status**:
- **Notes**: Condition: `dev.score < 50`.

### TEST CASE: SCOR-006 - Developer Link to Profile
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: Developer data exists
- **Steps**:
  1. Click on developer name in scorecard
- **Expected**: Navigates to `/profile/{encoded-author}`. Developer profile page loads.
- **Actual**:
- **Status**:
- **Notes**: Link uses `encodeURIComponent` for author name.

### TEST CASE: SCOR-007 - Loading State
- **Priority**: Medium
- **Type**: Loading
- **Precondition**: Page loading
- **Steps**:
  1. Navigate to `/scorecard`
  2. Observe while data loads
- **Expected**: Spinner (Activity icon with animate-spin) and "Loading team scores..." text.
- **Actual**:
- **Status**:
- **Notes**: Blue-500 spinner color.

### TEST CASE: SCOR-008 - Back Navigation
- **Priority**: Low
- **Type**: Happy Path
- **Precondition**: On global scorecard
- **Steps**:
  1. Click "Back to Dashboard" link
- **Expected**: Navigation to `/dashboard`.
- **Actual**:
- **Status**:
- **Notes**: Uses Link component.

### TEST CASE: SCOR-009 - No Auth Headers on Global Fetch (BUG)
- **Priority**: High
- **Type**: Error (Bug)
- **Precondition**: User logged in
- **Steps**:
  1. Navigate to `/scorecard`
  2. Check network request in DevTools
- **Expected**: Request should include Authorization header.
- **Actual**:
- **Status**:
- **Notes**: BUG — Global scorecard fetch uses `fetch(API + '/api/scorecard')` with NO auth headers. May fail with 401.

### TEST CASE: SCOR-010 - No Time Range Selector
- **Priority**: Low
- **Type**: Edge Case
- **Precondition**: On global scorecard
- **Steps**:
  1. Look for time range filter
- **Expected**: No time range selector. Hardcoded "Last 30 days" badge only.
- **Actual**:
- **Status**:
- **Notes**: KNOWN LIMITATION — Hardcoded "Last 30 days".

---

## 7. FILE HEATMAP

### TEST CASE: HEAT-001 - Global Heatmap Loads
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: User logged in, heatmap data exists
- **Steps**:
  1. Navigate to `/heatmap`
  2. Wait for data to load
- **Expected**: Header shows "Codebase Bug Heatmap" with Flame icon. Horizontal stacked bar chart visible. "Requires Immediate Attention" section if applicable.
- **Actual**:
- **Status**:
- **Notes**: Fetches from `GET /api/heatmap`.

### TEST CASE: HEAT-002 - Global Heatmap Empty State
- **Priority**: Medium
- **Type**: Happy Path
- **Precondition**: No heatmap data
- **Steps**:
  1. Navigate to `/heatmap` with no data
- **Expected**: Shows "No data yet" with Flame icon, description, and "Go to Dashboard" button.
- **Actual**:
- **Status**:
- **Notes**: Empty state explains need for 1+ PR analysis.

### TEST CASE: HEAT-003 - Stacked Bar Chart Display
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: Heatmap data with multiple files
- **Steps**:
  1. View global heatmap chart
- **Expected**: Horizontal bar chart with filename on Y-axis (truncated to 38 chars), count on X-axis. Stacked bars: Critical (red #ef4444), Warning (amber #f59e0b), Info (gray #6b7280). Legend visible.
- **Actual**:
- **Status**:
- **Notes**: Uses Recharts BarChart with horizontal layout.

### TEST CASE: HEAT-004 - Danger Zone Section
- **Priority**: Medium
- **Type**: Happy Path
- **Precondition**: Files with 5+ total findings
- **Steps**:
  1. View heatmap with high-finding files
- **Expected**: "Requires Immediate Attention" section with red background cards. Each shows: "DANGER ZONE" label, filename, total bug count, and "Schedule a refactor sprint." recommendation.
- **Actual**:
- **Status**:
- **Notes**: Condition: `data.some(r => r.total >= 5)`.

### TEST CASE: HEAT-005 - Chart Tooltip
- **Priority**: Low
- **Type**: Happy Path
- **Precondition**: Chart displayed
- **Steps**:
  1. Hover over a bar in the chart
- **Expected**: Tooltip shows filename and finding counts (critical, warning, info).
- **Actual**:
- **Status**:
- **Notes**: Uses Recharts Tooltip component.

### TEST CASE: HEAT-006 - Per-Project Heatmap Loads
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: User logged in, project has analysis data
- **Steps**:
  1. Navigate to `/projects/{id}/heatmap`
  2. Wait for data
- **Expected**: Header shows "Heatmap" with Back and Scorecard links. Vertical bar chart with filename on X-axis (shortened to last 2 segments), total on Y-axis. Color: >=10 red, >=6 dark red, >=3 blue, <3 dark blue.
- **Actual**:
- **Status**:
- **Notes**: Fetches from `GET /api/analytics/{projectId}/heatmap`.

### TEST CASE: HEAT-007 - Per-Project Heatmap Empty State
- **Priority**: Medium
- **Type**: Happy Path
- **Precondition**: Project has no analyzed PRs
- **Steps**:
  1. Navigate to project heatmap with no data
- **Expected**: Shows empty chart placeholder: "Analyze a PR to populate the heatmap" inside chart container.
- **Actual**:
- **Status**:
- **Notes**: Shows inside chart container, not separate card.

### TEST CASE: HEAT-008 - Per-Project File List Below Chart
- **Priority**: Medium
- **Type**: Happy Path
- **Precondition**: Heatmap data exists
- **Steps**:
  1. Scroll below chart on per-project heatmap
- **Expected**: List of files showing filename (mono font) and counts: "critical N · warning N · info N · total N".
- **Actual**:
- **Status**:
- **Notes**: Separate list below chart.

### TEST CASE: HEAT-009 - Global Heatmap No Auth Headers (BUG)
- **Priority**: High
- **Type**: Error (Bug)
- **Precondition**: User logged in
- **Steps**:
  1. Navigate to `/heatmap`
  2. Check network request headers
- **Expected**: Request should include Authorization header.
- **Actual**:
- **Status**:
- **Notes**: BUG — Global heatmap fetch uses `fetch(API + '/api/heatmap')` with NO auth headers.

---

## 8. HISTORY PAGE

### TEST CASE: HIST-001 - History Page Loads
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: User logged in, project exists
- **Steps**:
  1. Navigate to `/projects/{id}/history`
  2. Wait for data
- **Expected**: Header shows "PR Analysis History" with Clock icon. PR count. Back link to project. List of analyzed PRs.
- **Actual**:
- **Status**:
- **Notes**: Fetches from `GET /api/analytics/{projectId}/history`.

### TEST CASE: HIST-002 - History Empty State
- **Priority**: Medium
- **Type**: Happy Path
- **Precondition**: No analyzed PRs
- **Steps**:
  1. Navigate to project history with no data
- **Expected**: Shows "No history yet" with Clock icon, description, and "Go to Project" button.
- **Actual**:
- **Status**:
- **Notes**: Empty state when `rows.length === 0`.

### TEST CASE: HIST-003 - Scanned vs Imported Indicators
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: History has both scanned and imported PRs
- **Steps**:
  1. View history list with mixed PR types
- **Expected**: Scanned: Blue Search icon, "Scanned in DevDiff" label, risk score. Imported: Gray Archive icon, "Imported history" label, "N/A" for risk score.
- **Actual**:
- **Status**:
- **Notes**: `isScanned = r.source_type !== 'imported'`.

### TEST CASE: HIST-004 - Expand Scanned PR Findings
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: Scanned PR with findings
- **Steps**:
  1. Click "View Analysis" on a scanned PR
  2. Wait for findings to load
- **Expected**: Button changes to "Hide Analysis". Findings expand below PR row. Each finding: filename:line, severity badge, rule, confidence %, message. Loading spinner during fetch.
- **Actual**:
- **Status**:
- **Notes**: Fetches from `GET /api/analytics/{projectId}/findings/{prId}`.

### TEST CASE: HIST-005 - Collapse PR Findings
- **Priority**: Medium
- **Type**: Happy Path
- **Precondition**: PR findings expanded
- **Steps**:
  1. Click "Hide Analysis" button
- **Expected**: Findings collapse. Button returns to "View Analysis".
- **Actual**:
- **Status**:
- **Notes**: `togglePRDetails` checks `expandedPR === prId`.

### TEST CASE: HIST-006 - FP Marking From History
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: Scanned PR with findings, `fp=0`
- **Steps**:
  1. Expand a scanned PR
  2. Click "Mark as False Positive" on a finding
  3. Wait for API response
- **Expected**: Button shows "Saving...". Finding updates to "Low Priority" badge. Risk score updates. Button changes to "Mark Again to Ignore". Feedback stats refresh.
- **Actual**:
- **Status**:
- **Notes**: `advanceFalsePositive` handles the update.

### TEST CASE: HIST-007 - Imported PRs Not Expandable
- **Priority**: Medium
- **Type**: Edge Case
- **Precondition**: History has imported PRs
- **Steps**:
  1. View imported PR in history
- **Expected**: No "View Analysis" button. Risk score shows "N/A". No expandable section.
- **Actual**:
- **Status**:
- **Notes**: `isScanned` check controls button visibility.

### TEST CASE: HIST-008 - Feedback Stats Panel
- **Priority**: Medium
- **Type**: Happy Path
- **Precondition**: Project has findings with feedback
- **Steps**:
  1. Navigate to history
  2. Observe feedback stats card
- **Expected**: "False Positive Learning" section: Feedback Marked (count/total), Low / Ignored counts, Model Updated timestamp.
- **Actual**:
- **Status**:
- **Notes**: Fetches from `GET /api/analytics/{projectId}/feedback-stats`.

### TEST CASE: HIST-009 - No Date Range Filter
- **Priority**: Low
- **Type**: Edge Case
- **Precondition**: History has many PRs
- **Steps**:
  1. View history page
  2. Look for date range filter
- **Expected**: No date range filter. No sorting. Shows last 20 PRs only.
- **Actual**:
- **Status**:
- **Notes**: KNOWN LIMITATION — No date filter, no sorting, limited to 20 PRs.

---

## 9. DEVELOPER PROFILE

### TEST CASE: PROF-001 - Per-Project Profile Loads
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: User logged in, developer has data
- **Steps**:
  1. Navigate to `/projects/{id}/developer/{author}`
  2. Wait for data
- **Expected**: Header shows "Developer Profile" with User icon. Profile card with avatar (2-letter initials), name, quality score bar, personalized model badge, update timestamp.
- **Actual**:
- **Status**:
- **Notes**: Fetches from `GET /api/developer/{projectId}/{author}`.

### TEST CASE: PROF-002 - Quality Score Calculation
- **Priority**: Medium
- **Type**: Happy Path
- **Precondition**: Developer profile loaded
- **Steps**:
  1. View quality score on profile page
- **Expected**: Score = `max(0, 100 - critical*8 - warning*2)`. Color: >=80 emerald, >=50 amber, <50 red. Animated progress bar.
- **Actual**:
- **Status**:
- **Notes**: `qualityScore = Math.max(0, 100 - total_critical * 8 - total_warnings * 2)`.

### TEST CASE: PROF-003 - Personalized Detection Sensitivity
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: Developer has `rule_weights`
- **Steps**:
  1. View "Personalized Detection Sensitivity" section
- **Expected**: Shows each rule with weight as multiplier (e.g., "1.70x"). Color: red (>1.2x), green (<0.8x), gray (neutral). Bar shows percentage relative to 2.5x max. "Personal model active" badge.
- **Actual**:
- **Status**:
- **Notes**: `pct = Math.min(100, (weight / 2.5) * 100)`.

### TEST CASE: PROF-004 - No Weights State
- **Priority**: Medium
- **Type**: Edge Case
- **Precondition**: Developer has no `rule_weights`
- **Steps**:
  1. View developer with insufficient data
- **Expected**: Shows "Analyzing patterns... Need more PRs to build a personal model." with Cpu icon. No weight bars.
- **Actual**:
- **Status**:
- **Notes**: `hasWeights` check determines display.

### TEST CASE: PROF-005 - Top Triggered Rules
- **Priority**: Medium
- **Type**: Happy Path
- **Precondition**: Developer has rule hit data
- **Steps**:
  1. View "Top Triggered Rules" section
- **Expected**: List of rules with total count and critical count. Critical count in red if > 0.
- **Actual**:
- **Status**:
- **Notes**: Data from `top_rules` array.

### TEST CASE: PROF-006 - Recent PRs Section
- **Priority**: Medium
- **Type**: Happy Path
- **Precondition**: Developer has recent PRs
- **Steps**:
  1. View "Recent Pull Requests" section
- **Expected**: List of PRs with number, title, date, and risk score (color-coded: red >=70, amber >=40, green <40).
- **Actual**:
- **Status**:
- **Notes**: Data from `recent_prs` array.

### TEST CASE: PROF-007 - Global Developer Profile Loads
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: Developer exists in system
- **Steps**:
  1. Navigate to `/developer/{author}`
  2. Wait for data
- **Expected**: Shows "Developer Analysis" header. Stats grid (PRs, Critical, Warnings, Avg confidence, Escalated rules). Score bar. Personalized scoring profile. Patterns. Top rules. Recent findings. Recent PRs.
- **Actual**:
- **Status**:
- **Notes**: Fetches from `GET /api/developer/{author}` (global, no projectId).

### TEST CASE: PROF-008 - Profile Alias Route
- **Priority**: Low
- **Type**: Edge Case
- **Precondition**: Developer exists
- **Steps**:
  1. Navigate to `/profile/{author}`
- **Expected**: Renders same content as `/developer/{author}`.
- **Actual**:
- **Status**:
- **Notes**: `profile/[author].tsx` re-exports `developer/[author]`.

### TEST CASE: PROF-009 - No Auth Headers on Global Profile (BUG)
- **Priority**: High
- **Type**: Error (Bug)
- **Precondition**: User logged in
- **Steps**:
  1. Navigate to `/developer/{author}`
  2. Check network request headers
- **Expected**: Request should include Authorization header.
- **Actual**:
- **Status**:
- **Notes**: BUG — Global developer page uses `fetch(API + '/api/developer/' + author)` with NO auth headers.

---

## 10. WEBSOCKET STREAMING

### TEST CASE: WS-001 - WebSocket Connection Established
- **Priority**: Critical
- **Type**: Happy Path
- **Precondition**: PR analysis submitted successfully
- **Steps**:
  1. Submit PR for analysis
  2. Open browser DevTools → Network → WS tab
- **Expected**: WebSocket connection to `ws://localhost:4000/ws/findings/{jobId}`. Shows as "101 Switching Protocols".
- **Actual**:
- **Status**:
- **Notes**: `connectWS()` in `websocket.ts` creates connection.

### TEST CASE: WS-002 - pr_meta Event Received
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: WebSocket connected
- **Steps**:
  1. Submit analysis
  2. Listen for `pr_meta` event
- **Expected**: PR metadata (title, author, repo, prNumber, prUrl, files) displayed. Phase text → "PR loaded".
- **Actual**:
- **Status**:
- **Notes**: `setPrMeta(msg.data)` and `setPhaseText('PR loaded')`.

### TEST CASE: WS-003 - Finding Events Stream In Real-Time
- **Priority**: Critical
- **Type**: Happy Path
- **Precondition**: WebSocket connected, analysis in progress
- **Steps**:
  1. Submit analysis
  2. Observe findings list growing
- **Expected**: Each finding event appends new finding. Findings appear one-by-one with animation. Phase: "Streaming findings...". Risk meter increments.
- **Actual**:
- **Status**:
- **Notes**: `setFindings(prev => [...prev, msg.data])`.

### TEST CASE: WS-004 - Logic Finding Events
- **Priority**: Medium
- **Type**: Happy Path
- **Precondition**: LLM logic review enabled, WS connected
- **Steps**:
  1. Submit analysis on PR with code logic
  2. Wait for `logic_review_start`
  3. Observe logic findings
- **Expected**: `logic_finding` events arrive, converted to Finding with `source: 'llm'` and `rule_name: 'logic:{functionName}'`. Phase: "Running logic review..." → "Streaming logic findings...".
- **Actual**:
- **Status**:
- **Notes**: Logic findings mapped to Finding type.

### TEST CASE: WS-005 - Complete Event
- **Priority**: Critical
- **Type**: Happy Path
- **Precondition**: Analysis finishing
- **Steps**:
  1. Wait for analysis to complete
- **Expected**: `complete` event sets summary with prId, totalFindings, riskScore, author. Phase → "Complete". Summary card appears. "Check Another PR" button appears.
- **Actual**:
- **Status**:
- **Notes**: `setSummary(msg.data)`.

### TEST CASE: WS-006 - Error Event
- **Priority**: High
- **Type**: Error
- **Precondition**: Analysis encounters error
- **Steps**:
  1. Submit analysis that triggers backend error
- **Expected**: Error banner with message. Phase → "Error". `isAnalyzing` set to false.
- **Actual**:
- **Status**:
- **Notes**: `setError(msg.data?.message || 'Analyze failed')`.

### TEST CASE: WS-007 - No Reconnection on Drop (BUG)
- **Priority**: Critical
- **Type**: Error (Bug)
- **Precondition**: Analysis in progress
- **Steps**:
  1. Start analysis
  2. Kill backend server mid-analysis
  3. Observe behavior
- **Expected**: Should attempt reconnection with backoff. Should show reconnection status.
- **Actual**:
- **Status**:
- **Notes**: KNOWN BUG — No reconnection logic. `ws.onclose` calls `onDone()` silently.

### TEST CASE: WS-008 - WebSocket Cleanup on Unmount
- **Priority**: Medium
- **Type**: Happy Path
- **Precondition**: Analysis in progress
- **Steps**:
  1. Start analysis
  2. Navigate away from project detail page
- **Expected**: WebSocket closed via useEffect cleanup. No orphaned connections.
- **Actual**:
- **Status**:
- **Notes**: `useEffect` cleanup closes wsRef.

### TEST CASE: WS-009 - Previous WS Closed Before New
- **Priority**: Medium
- **Type**: Happy Path
- **Precondition**: Previous analysis completed
- **Steps**:
  1. Complete first analysis
  2. Submit second analysis immediately
- **Expected**: Previous WebSocket closed before new one opens. No duplicate connections.
- **Actual**:
- **Status**:
- **Notes**: `if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }`.

### TEST CASE: WS-010 - Malformed Message Handled
- **Priority**: Low
- **Type**: Edge Case
- **Precondition**: WebSocket connected
- **Steps**:
  1. (Simulate) Server sends non-JSON message
- **Expected**: Message silently ignored. No console error. No UI breakage.
- **Actual**:
- **Status**:
- **Notes**: `catch { /* ignore malformed message */ }`.

### TEST CASE: WS-011 - No Auth on WebSocket
- **Priority**: High
- **Type**: Error (Security)
- **Precondition**: WebSocket connection
- **Steps**:
  1. Connect to WebSocket URL without auth token
  2. Observe if connection accepted
- **Expected**: Connection should be rejected without valid token.
- **Actual**:
- **Status**:
- **Notes**: KNOWN ISSUE — No authentication on WebSocket. Anyone with jobId can connect.

### TEST CASE: WS-012 - No Heartbeat/Ping
- **Priority**: Medium
- **Type**: Edge Case
- **Precondition**: WebSocket connected, long analysis
- **Steps**:
  1. Start analysis taking >30 seconds
  2. Monitor WebSocket connection
- **Expected**: Connection should stay alive via heartbeat/ping.
- **Actual**:
- **Status**:
- **Notes**: KNOWN LIMITATION — No heartbeat/ping defined.

### TEST CASE: WS-013 - intent_warning Not Handled (BUG)
- **Priority**: High
- **Type**: Error (Bug)
- **Precondition**: Analysis with ticket URL triggering intent warning
- **Steps**:
  1. Analyze PR with mismatched ticket URL
  2. Observe UI for warning
- **Expected**: Should show ticket/file mismatch warning.
- **Actual**:
- **Status**:
- **Notes**: KNOWN BUG — `intent_warning` event type defined in WSMessage but NO handler exists. Warning silently dropped.

---

## 11. NAVIGATION & LAYOUT

### TEST CASE: NAV-001 - Sidebar Displays on Auth Pages
- **Priority**: High
- **Type**: Happy Path
- **Precondition**: User logged in
- **Steps**:
  1. Navigate to `/dashboard`
  2. Observe sidebar
- **Expected**: Sidebar visible: DevDiff logo + "DevDiff" + "v0.1" badge, "Navigation" section, Dashboard link (active), user info (avatar + email + "developer" role), Sign out button, Collapse toggle.
- **Actual**:
- **Status**:
- **Notes**: Sidebar part of AppShell component.

### TEST CASE: NAV-002 - Sidebar Collapse
- **Priority**: Medium
- **Type**: Happy Path
- **Precondition**: Sidebar expanded (260px)
- **Steps**:
  1. Click "Collapse" button at bottom of sidebar
- **Expected**: Sidebar collapses to 72px. Only icons visible. Labels hidden. "PanelLeft" icon for expand.
- **Actual**:
- **Status**:
- **Notes**: Uses `useUIStore` with `sidebarCollapsed` state.

### TEST CASE: NAV-003 - Sidebar Expand
- **Priority**: Medium
- **Type**: Happy Path
- **Precondition**: Sidebar collapsed (72px)
- **Steps**:
  1. Click expand icon (PanelLeft)
- **Expected**: Sidebar expands to 260px. Labels reappear. "PanelLeftClose" icon for collapse.
- **Actual**:
- **Status**:
- **Notes**: Toggle via `toggleSidebar()`.

### TEST CASE: NAV-004 - Active Nav Indicator
- **Priority**: Medium
- **Type**: Happy Path
- **Precondition**: User on `/dashboard`
- **Steps**:
  1. Navigate to `/dashboard`
  2. Observe Dashboard nav item
- **Expected**: Dashboard link highlighted: blue bg, blue border, blue text, animated dot indicator.
- **Actual**:
- **Status**:
- **Notes**: `active = router.pathname === '/dashboard'`. Dot uses framer-motion layout animation.

### TEST CASE: NAV-005 - Login Page Has No Sidebar
- **Priority**: Medium
- **Type**: Happy Path
- **Precondition**: No session
- **Steps**:
  1. Navigate to `/login`
- **Expected**: Login page renders without AppShell/sidebar. Full-screen centered layout.
- **Actual**:
- **Status**:
- **Notes**: `_app.tsx` conditionally wraps in AppShell.

### TEST CASE: NAV-006 - User Info in Sidebar
- **Priority**: Low
- **Type**: Happy Path
- **Precondition**: User logged in
- **Steps**:
  1. View sidebar bottom section
- **Expected**: User initials avatar (gradient bg, 2-char uppercase), email (truncated), "developer" role label.
- **Actual**:
- **Status**:
- **Notes**: `initials = email.slice(0, 2).toUpperCase()`.

### TEST CASE: NAV-007 - Only 1 Nav Item (Limitation)
- **Priority**: Low
- **Type**: Edge Case
- **Precondition**: Sidebar expanded
- **Steps**:
  1. View sidebar navigation section
- **Expected**: Only "Dashboard" nav item visible. No other shortcuts.
- **Actual**:
- **Status**:
- **Notes**: KNOWN LIMITATION — navItems array has only 1 item.

### TEST CASE: NAV-008 - Navigation Tabs on Project Detail
- **Priority**: Medium
- **Type**: Happy Path
- **Precondition**: On project detail page
- **Steps**:
  1. View bottom of project detail page
- **Expected**: Three navigation cards: History (Clock, blue), Scorecard (BarChart3, emerald), Heatmap (Flame, orange). Each with label and description.
- **Actual**:
- **Status**:
- **Notes**: 3-column grid layout.

### TEST CASE: NAV-009 - No Breadcrumbs
- **Priority**: Low
- **Type**: Edge Case
- **Precondition**: On any sub-page
- **Steps**:
  1. Navigate to a sub-page (e.g., `/projects/{id}/history`)
  2. Look for breadcrumb navigation
- **Expected**: No breadcrumb trail. Only "Back to Project" or "Back to Dashboard" links.
- **Actual**:
- **Status**:
- **Notes**: KNOWN LIMITATION — No breadcrumbs.

### TEST CASE: NAV-010 - No Mobile Hamburger Menu
- **Priority**: Low
- **Type**: Edge Case
- **Precondition**: Viewport at 375px
- **Steps**:
  1. Set viewport to mobile width
  2. Try to access sidebar
- **Expected**: Sidebar may overflow or be inaccessible. No hamburger menu toggle.
- **Actual**:
- **Status**:
- **Notes**: KNOWN LIMITATION — No mobile hamburger menu.

---

## 12. ERROR HANDLING

### TEST CASE: ERR-001 - Backend Server Down
- **Priority**: Critical
- **Type**: Error
- **Precondition**: Backend not running
- **Steps**:
  1. Stop backend server
  2. Navigate to `/dashboard`
  3. Wait for fetch
- **Expected**: Error message displayed. Page doesn't crash. User can see error.
- **Actual**:
- **Status**:
- **Notes**: Catch block in `loadProjects` sets error state.

### TEST CASE: ERR-002 - Invalid Project ID
- **Priority**: High
- **Type**: Error
- **Precondition**: User logged in
- **Steps**:
  1. Navigate to `/projects/invalid-uuid`
- **Expected**: Error message: "Failed to load project". Page shows error state without crashing.
- **Actual**:
- **Status**:
- **Notes**: Fetch to invalid ID returns error.

### TEST CASE: ERR-003 - Network Timeout
- **Priority**: High
- **Type**: Error
- **Precondition**: Slow network
- **Steps**:
  1. Simulate slow network
  2. Navigate to dashboard
- **Expected**: Loading spinner continues until timeout. No crash.
- **Actual**:
- **Status**:
- **Notes**: No explicit timeout handling in frontend fetch calls.

### TEST CASE: ERR-004 - Auth Expiry Mid-Session
- **Priority**: High
- **Type**: Error
- **Precondition**: User logged in, token about to expire
- **Steps**:
  1. Wait for token to expire
  2. Try to perform action
- **Expected**: API returns 401. Frontend should redirect to login or show error.
- **Actual**:
- **Status**:
- **Notes**: No explicit 401 handler in most fetch calls.

### TEST CASE: ERR-005 - WebSocket Connection Failure
- **Priority**: High
- **Type**: Error
- **Precondition**: Backend WebSocket server down
- **Steps**:
  1. Submit PR for analysis
  2. WebSocket server unavailable
- **Expected**: `onerror` fires, `onDone` called, `isAnalyzing` set to false. No visual error shown (silent failure).
- **Actual**:
- **Status**:
- **Notes**: BUG — WebSocket errors silently caught. No reconnection or notification.

### TEST CASE: ERR-006 - 404 Page for Invalid Routes
- **Priority**: Medium
- **Type**: Error
- **Precondition**: Any state
- **Steps**:
  1. Navigate to `/nonexistent-page`
- **Expected**: Custom 404 page with branded not-found message and navigation.
- **Actual**:
- **Status**:
- **Notes**: KNOWN ISSUE — No custom 404 page. Next.js default may show or blank page.

### TEST CASE: ERR-007 - Unexpected API Response Format
- **Priority**: Medium
- **Type**: Error
- **Precondition**: Backend returns non-JSON
- **Steps**:
  1. Trigger API call returning HTML or plain text
- **Expected**: `res.json()` throws. Catch block handles. Error message shown.
- **Actual**:
- **Status**:
- **Notes**: Most calls use `.json().catch(() => ...)`.

### TEST CASE: ERR-008 - No Error Boundaries
- **Priority**: Medium
- **Type**: Edge Case
- **Precondition**: React component throws
- **Steps**:
  1. (Simulate) Trigger unhandled component error
- **Expected**: Should show error boundary fallback, not white screen.
- **Actual**:
- **Status**:
- **Notes**: KNOWN LIMITATION — No error boundaries defined.

### TEST CASE: ERR-009 - No Toast Notifications
- **Priority**: Low
- **Type**: Edge Case
- **Precondition**: Any success or error event
- **Steps**:
  1. Perform action that succeeds or fails
- **Expected**: Toast notification should appear for feedback.
- **Actual**:
- **Status**:
- **Notes**: KNOWN LIMITATION — No toast notification system.

### TEST CASE: ERR-010 - Blank Screens on Errors
- **Priority**: High
- **Type**: Error
- **Precondition**: Component fails to render
- **Steps**:
  1. Trigger rendering error
- **Expected**: Should show error state, not blank screen.
- **Actual**:
- **Status**:
- **Notes**: KNOWN ISSUE — Some pages show blank screens on errors.

---

## 13. UNUSED COMPONENTS

### TEST CASE: UNUSED-001 - DiffViewer Component Exists But Not Integrated
- **Priority**: Low
- **Type**: Edge Case
- **Precondition**: Component exists at `frontend/components/DiffViewer.tsx`
- **Steps**:
  1. Check if DiffViewer is imported anywhere in pages
- **Expected**: Component is defined but not used in any page. No inline diff viewing available.
- **Actual**:
- **Status**:
- **Notes**: KNOWN — DiffViewer available but not integrated.

### TEST CASE: UNUSED-002 - FindingCard Component Exists But Not Integrated
- **Priority**: Low
- **Type**: Edge Case
- **Precondition**: Component exists at `frontend/components/FindingCard.tsx`
- **Steps**:
  1. Check if FindingCard is imported anywhere
- **Expected**: Component exists but findings are rendered inline, not using FindingCard.
- **Actual**:
- **Status**:
- **Notes**: KNOWN — FindingCard available but not integrated.

### TEST CASE: UNUSED-003 - SuggestionsPanel Component Exists But Not Integrated
- **Priority**: Low
- **Type**: Edge Case
- **Precondition**: Component exists at `frontend/components/SuggestionsPanel.tsx`
- **Steps**:
  1. Check if SuggestionsPanel is imported anywhere
- **Expected**: Component exists but LLM suggestions shown inline, not using SuggestionsPanel.
- **Actual**:
- **Status**:
- **Notes**: KNOWN — SuggestionsPanel available but not integrated.

### TEST CASE: UNUSED-004 - PRMeta Component Exists But Not Integrated
- **Priority**: Low
- **Type**: Edge Case
- **Precondition**: Component exists at `frontend/components/PRMeta.tsx`
- **Steps**:
  1. Check if PRMeta is imported anywhere
- **Expected**: Component exists but PR metadata rendered inline in project detail page.
- **Actual**:
- **Status**:
- **Notes**: KNOWN — PRMeta available but not integrated.

### TEST CASE: UNUSED-005 - ScoreBar Component Usage
- **Priority**: Low
- **Type**: Edge Case
- **Precondition**: Component exists at `frontend/components/ScoreBar.tsx`
- **Steps**:
  1. Check if ScoreBar is imported and used
- **Expected**: ScoreBar IS used in global scorecard and developer pages. This component IS integrated.
- **Actual**:
- **Status**:
- **Notes**: ScoreBar is the only unused-component-adjacent component that IS actually used.

---

## 14. EXPORT FEATURES

### TEST CASE: EXP-001 - CSV Export No UI Trigger
- **Priority**: Low
- **Type**: Edge Case
- **Precondition**: Analysis complete with findings
- **Steps**:
  1. Look for CSV export button on findings page
- **Expected**: No export button visible. Backend `exporter.js` exists but no UI trigger.
- **Actual**:
- **Status**:
- **Notes**: KNOWN — CSV generation exists in backend but no UI trigger.

### TEST CASE: EXP-002 - Email Summary No UI Trigger
- **Priority**: Low
- **Type**: Edge Case
- **Precondition**: Analysis complete
- **Steps**:
  1. Look for email summary button
- **Expected**: No email button visible. Backend email generation exists but no sending mechanism or UI.
- **Actual**:
- **Status**:
- **Notes**: KNOWN — Email generation exists but no sending or UI.

### TEST CASE: EXP-003 - No PDF Export
- **Priority**: Low
- **Type**: Edge Case
- **Precondition**: Any state
- **Steps**:
  1. Look for PDF export option
- **Expected**: No PDF export functionality exists.
- **Actual**:
- **Status**:
- **Notes**: KNOWN — No PDF export.

### TEST CASE: EXP-004 - No Scheduled Reports
- **Priority**: Low
- **Type**: Edge Case
- **Precondition**: Any state
- **Steps**:
  1. Look for scheduled report configuration
- **Expected**: No scheduled report functionality exists.
- **Actual**:
- **Status**:
- **Notes**: KNOWN — No scheduled reports.

---

## 15. SUMMARY TABLE

| ID | Feature | Title | Priority | Type |
|----|---------|-------|----------|------|
| AUTH-001 | Authentication | Login Page Visual Elements | Medium | Happy Path |
| AUTH-002 | Authentication | Unauthenticated Root Redirect | Critical | Happy Path |
| AUTH-003 | Authentication | Authenticated Root Redirect | Critical | Happy Path |
| AUTH-004 | Authentication | GitHub OAuth Login Flow | Critical | Happy Path |
| AUTH-005 | Authentication | OAuth Redirect Cancelled | High | Error |
| AUTH-006 | Authentication | Session Persists Across Reload | Critical | Happy Path |
| AUTH-007 | Authentication | Login Button Disabled During Load | Medium | Loading |
| AUTH-008 | Authentication | Logout Clears Session | Critical | Happy Path |
| AUTH-009 | Authentication | Logout From Dashboard Header | High | Happy Path |
| AUTH-010 | Authentication | Already Auth Redirect from Login | High | Happy Path |
| AUTH-011 | Authentication | Protected Route Redirect | Critical | Happy Path |
| AUTH-012 | Authentication | No Email/Password Fallback | Medium | Edge Case |
| AUTH-013 | Authentication | Token Expiry Mid-Session | High | Error |
| AUTH-014 | Authentication | Login No Loading State Feedback | Medium | Loading |
| AUTH-015 | Authentication | Concurrent Tabs Session | Medium | Edge Case |
| DASH-001 | Dashboard | Dashboard Loads for Auth User | Critical | Happy Path |
| DASH-002 | Dashboard | Loading State Display | Critical | Loading |
| DASH-003 | Dashboard | Loading Timeout (BUG) | Critical | Error |
| DASH-004 | Dashboard | Empty State Display | High | Happy Path |
| DASH-005 | Dashboard | Error State Display | High | Error |
| DASH-006 | Dashboard | Project Card Display | High | Happy Path |
| DASH-007 | Dashboard | Import Status Indicators | High | Happy Path |
| DASH-008 | Dashboard | Card Click Navigation | Critical | Happy Path |
| DASH-009 | Dashboard | Card Hover State | Low | Happy Path |
| DASH-010 | Dashboard | Grid Responsive Layout | Medium | Edge Case |
| DASH-011 | Dashboard | SortedProjects Memo No-Op (BUG) | Low | Edge Case |
| DASH-012 | Dashboard | No Search/Filter for Projects | Low | Edge Case |
| PROJ-001 | Project Creation | Open Create Project Modal | Critical | Happy Path |
| PROJ-002 | Project Creation | Repo List Loading State | High | Loading |
| PROJ-003 | Project Creation | Repo Dropdown Populated | Critical | Happy Path |
| PROJ-004 | Project Creation | Toggle Select/Manual Mode | Medium | Happy Path |
| PROJ-005 | Project Creation | Create Button Disabled (Empty) | Medium | Edge Case |
| PROJ-006 | Project Creation | Successful Creation (List Mode) | Critical | Happy Path |
| PROJ-007 | Project Creation | Successful Creation (Manual Mode) | High | Happy Path |
| PROJ-008 | Project Creation | Cancel Closes and Resets Form | Medium | Happy Path |
| PROJ-009 | Project Creation | Close Modal via X Button | Low | Happy Path |
| PROJ-010 | Project Creation | Close Modal via Backdrop Click | Low | Happy Path |
| PROJ-011 | Project Creation | Repo Fetch Failure Fallback | High | Error |
| PROJ-012 | Project Creation | Failed Creation Error State | High | Error |
| PROJ-013 | Project Creation | Description Field Optional | Medium | Edge Case |
| PROJ-014 | Project Creation | No Duplicate Project Check | Medium | Edge Case |
| PROJ-015 | Project Creation | Manual Input No Validation | Medium | Edge Case |
| ANAL-001 | PR Analysis | Project Detail Page Loads | Critical | Happy Path |
| ANAL-002 | PR Analysis | Valid PR URL Submission | Critical | Happy Path |
| ANAL-003 | PR Analysis | Analyze Button Disabled States | Medium | Edge Case |
| ANAL-004 | PR Analysis | Phase Indicator Updates | High | Happy Path |
| ANAL-005 | PR Analysis | Risk Meter Updates | High | Happy Path |
| ANAL-006 | PR Analysis | PR Metadata Display | High | Happy Path |
| ANAL-007 | PR Analysis | Invalid PR URL | High | Error |
| ANAL-008 | PR Analysis | PR From Different Repo | High | Error |
| ANAL-009 | PR Analysis | Clean PR (Zero Findings) | High | Happy Path |
| ANAL-010 | PR Analysis | Check Another PR Button | Medium | Happy Path |
| ANAL-011 | PR Analysis | Delete Project Flow | High | Happy Path |
| ANAL-012 | PR Analysis | Delete Project Cancel | Medium | Happy Path |
| ANAL-013 | PR Analysis | No Cancel Analysis Button | Medium | Edge Case |
| ANAL-014 | PR Analysis | Network Drop During Analysis | High | Error |
| ANAL-015 | PR Analysis | Ticket URL Optional | Low | Edge Case |
| ANAL-016 | PR Analysis | Large PR Analysis | Medium | Edge Case |
| ANAL-017 | PR Analysis | High Risk PR Score Capping | Medium | Edge Case |
| FIND-001 | Findings Display | Findings Grouped by File | Critical | Happy Path |
| FIND-002 | Findings Display | Severity Badge Colors | High | Happy Path |
| FIND-003 | Findings Display | ConfidenceBadge Color Inversion (BUG) | High | Error |
| FIND-004 | Findings Display | Danger Zone Badge | High | Happy Path |
| FIND-005 | Findings Display | Fix Hint Expand/Collapse | Medium | Happy Path |
| FIND-006 | Findings Display | Mark as False Positive (Stage 1) | High | Happy Path |
| FIND-007 | Findings Display | Mark Again to Ignore (Stage 2) | High | Happy Path |
| FIND-008 | Findings Display | Filter by Severity | High | Happy Path |
| FIND-009 | Findings Display | Critical Finding Highlight | Medium | Happy Path |
| FIND-010 | Findings Display | Multiple Findings Per File | Medium | Edge Case |
| FIND-011 | Findings Display | Summary Card After Analysis | Medium | Happy Path |
| FIND-012 | Findings Display | New User Notification | Low | Happy Path |
| SCOR-001 | Scorecard | Global Scorecard Loads | High | Happy Path |
| SCOR-002 | Scorecard | Scorecard Empty State | High | Happy Path |
| SCOR-003 | Scorecard | Developer Badge Colors | High | Happy Path |
| SCOR-004 | Scorecard | Score Bar Animation | Medium | Happy Path |
| SCOR-005 | Scorecard | Auto-Escalation Warning | Medium | Happy Path |
| SCOR-006 | Scorecard | Developer Link to Profile | High | Happy Path |
| SCOR-007 | Scorecard | Loading State | Medium | Loading |
| SCOR-008 | Scorecard | Back Navigation | Low | Happy Path |
| SCOR-009 | Scorecard | No Auth Headers on Global Fetch (BUG) | High | Error |
| SCOR-010 | Scorecard | No Time Range Selector | Low | Edge Case |
| HEAT-001 | Heatmap | Global Heatmap Loads | High | Happy Path |
| HEAT-002 | Heatmap | Global Heatmap Empty State | Medium | Happy Path |
| HEAT-003 | Heatmap | Stacked Bar Chart Display | High | Happy Path |
| HEAT-004 | Heatmap | Danger Zone Section | Medium | Happy Path |
| HEAT-005 | Heatmap | Chart Tooltip | Low | Happy Path |
| HEAT-006 | Heatmap | Per-Project Heatmap Loads | High | Happy Path |
| HEAT-007 | Heatmap | Per-Project Heatmap Empty State | Medium | Happy Path |
| HEAT-008 | Heatmap | Per-Project File List Below Chart | Medium | Happy Path |
| HEAT-009 | Heatmap | Global Heatmap No Auth Headers (BUG) | High | Error |
| HIST-001 | History | History Page Loads | High | Happy Path |
| HIST-002 | History | History Empty State | Medium | Happy Path |
| HIST-003 | History | Scanned vs Imported Indicators | High | Happy Path |
| HIST-004 | History | Expand Scanned PR Findings | High | Happy Path |
| HIST-005 | History | Collapse PR Findings | Medium | Happy Path |
| HIST-006 | History | FP Marking From History | High | Happy Path |
| HIST-007 | History | Imported PRs Not Expandable | Medium | Edge Case |
| HIST-008 | History | Feedback Stats Panel | Medium | Happy Path |
| HIST-009 | History | No Date Range Filter | Low | Edge Case |
| PROF-001 | Developer Profile | Per-Project Profile Loads | High | Happy Path |
| PROF-002 | Developer Profile | Quality Score Calculation | Medium | Happy Path |
| PROF-003 | Developer Profile | Personalized Detection Sensitivity | High | Happy Path |
| PROF-004 | Developer Profile | No Weights State | Medium | Edge Case |
| PROF-005 | Developer Profile | Top Triggered Rules | Medium | Happy Path |
| PROF-006 | Developer Profile | Recent PRs Section | Medium | Happy Path |
| PROF-007 | Developer Profile | Global Developer Profile Loads | High | Happy Path |
| PROF-008 | Developer Profile | Profile Alias Route | Low | Edge Case |
| PROF-009 | Developer Profile | No Auth Headers on Global Profile (BUG) | High | Error |
| WS-001 | WebSocket | WebSocket Connection Established | Critical | Happy Path |
| WS-002 | WebSocket | pr_meta Event Received | High | Happy Path |
| WS-003 | WebSocket | Finding Events Stream Real-Time | Critical | Happy Path |
| WS-004 | WebSocket | Logic Finding Events | Medium | Happy Path |
| WS-005 | WebSocket | Complete Event | Critical | Happy Path |
| WS-006 | WebSocket | Error Event | High | Error |
| WS-007 | WebSocket | No Reconnection on Drop (BUG) | Critical | Error |
| WS-008 | WebSocket | WebSocket Cleanup on Unmount | Medium | Happy Path |
| WS-009 | WebSocket | Previous WS Closed Before New | Medium | Happy Path |
| WS-010 | WebSocket | Malformed Message Handled | Low | Edge Case |
| WS-011 | WebSocket | No Auth on WebSocket | High | Error |
| WS-012 | WebSocket | No Heartbeat/Ping | Medium | Edge Case |
| WS-013 | WebSocket | intent_warning Not Handled (BUG) | High | Error |
| NAV-001 | Navigation | Sidebar Displays on Auth Pages | High | Happy Path |
| NAV-002 | Navigation | Sidebar Collapse | Medium | Happy Path |
| NAV-003 | Navigation | Sidebar Expand | Medium | Happy Path |
| NAV-004 | Navigation | Active Nav Indicator | Medium | Happy Path |
| NAV-005 | Navigation | Login Page Has No Sidebar | Medium | Happy Path |
| NAV-006 | Navigation | User Info in Sidebar | Low | Happy Path |
| NAV-007 | Navigation | Only 1 Nav Item (Limitation) | Low | Edge Case |
| NAV-008 | Navigation | Navigation Tabs on Project Detail | Medium | Happy Path |
| NAV-009 | Navigation | No Breadcrumbs | Low | Edge Case |
| NAV-010 | Navigation | No Mobile Hamburger Menu | Low | Edge Case |
| ERR-001 | Error Handling | Backend Server Down | Critical | Error |
| ERR-002 | Error Handling | Invalid Project ID | High | Error |
| ERR-003 | Error Handling | Network Timeout | High | Error |
| ERR-004 | Error Handling | Auth Expiry Mid-Session | High | Error |
| ERR-005 | Error Handling | WebSocket Connection Failure | High | Error |
| ERR-006 | Error Handling | 404 Page for Invalid Routes | Medium | Error |
| ERR-007 | Error Handling | Unexpected API Response Format | Medium | Error |
| ERR-008 | Error Handling | No Error Boundaries | Medium | Edge Case |
| ERR-009 | Error Handling | No Toast Notifications | Low | Edge Case |
| ERR-010 | Error Handling | Blank Screens on Errors | High | Error |
| UNUSED-001 | Unused Components | DiffViewer Not Integrated | Low | Edge Case |
| UNUSED-002 | Unused Components | FindingCard Not Integrated | Low | Edge Case |
| UNUSED-003 | Unused Components | SuggestionsPanel Not Integrated | Low | Edge Case |
| UNUSED-004 | Unused Components | PRMeta Not Integrated | Low | Edge Case |
| UNUSED-005 | Unused Components | ScoreBar IS Integrated | Low | Edge Case |
| EXP-001 | Export Features | CSV Export No UI Trigger | Low | Edge Case |
| EXP-002 | Export Features | Email Summary No UI Trigger | Low | Edge Case |
| EXP-003 | Export Features | No PDF Export | Low | Edge Case |
| EXP-004 | Export Features | No Scheduled Reports | Low | Edge Case |

---

## 16. RISK MATRIX

| Feature | Total Tests | Critical | High | Medium | Low | Risk Level |
|---------|-------------|----------|------|--------|-----|------------|
| Authentication | 15 | 5 | 4 | 5 | 1 | **HIGH** |
| Dashboard | 12 | 3 | 4 | 2 | 3 | **CRITICAL** |
| Project Creation | 15 | 3 | 4 | 5 | 3 | **CRITICAL** |
| PR Analysis | 17 | 3 | 6 | 5 | 3 | **HIGH** |
| Findings Display | 12 | 1 | 5 | 4 | 2 | **HIGH** |
| Developer Scorecard | 10 | 0 | 4 | 4 | 2 | **MEDIUM** |
| File Heatmap | 9 | 0 | 3 | 4 | 2 | **MEDIUM** |
| History Page | 9 | 0 | 4 | 3 | 2 | **MEDIUM** |
| Developer Profile | 9 | 0 | 3 | 4 | 2 | **MEDIUM** |
| WebSocket Streaming | 13 | 3 | 4 | 4 | 2 | **CRITICAL** |
| Navigation & Layout | 10 | 0 | 1 | 5 | 4 | **LOW** |
| Error Handling | 10 | 1 | 5 | 3 | 1 | **HIGH** |
| Unused Components | 5 | 0 | 0 | 0 | 5 | **INFO** |
| Export Features | 4 | 0 | 0 | 0 | 4 | **INFO** |
| **TOTAL** | **150** | **19** | **47** | **50** | **34** | — |

---

## 17. ACCEPTANCE CRITERIA

### Authentication
- [ ] Unauthenticated users are redirected to `/login`
- [ ] GitHub OAuth flow completes successfully
- [ ] Session persists across page refreshes
- [ ] Sign out clears session and redirects to login
- [ ] Expired tokens trigger re-authentication
- [ ] Login page shows all branding elements
- [ ] No error shown on OAuth cancel (silent handling)

### Dashboard
- [ ] Loads project list within 5 seconds
- [ ] Shows loading spinner during fetch
- [ ] Shows error state if fetch fails
- [ ] Loading does NOT spin indefinitely (timeout exists)
- [ ] Empty state shows when no projects exist
- [ ] Project cards display correct data
- [ ] Project cards navigate to project detail
- [ ] Grid is responsive (1/2/3 columns)

### Project Creation
- [ ] Modal opens with repo list or manual input
- [ ] Form validates required fields
- [ ] Creates project via API and refreshes list
- [ ] Shows loading state during creation
- [ ] "Creating..." does NOT show indefinitely
- [ ] Shows error state on failure
- [ ] Closes and resets on cancel/success
- [ ] Manual input validates repo format

### PR Analysis
- [ ] Submits PR for analysis via API
- [ ] WebSocket connects and streams findings in real-time
- [ ] Phase indicator updates correctly
- [ ] Risk meter updates with each finding
- [ ] Findings grouped by file
- [ ] Severity badges color-coded correctly
- [ ] Confidence badge colors are NOT inverted
- [ ] Filter buttons work (All, Critical, Warnings, Info, Low, Ignored)
- [ ] Fix hints are expandable
- [ ] Clean PR shows "All Clear!" message
- [ ] "Check Another PR" resets the form
- [ ] Delete project works with confirmation
- [ ] Analysis can be cancelled by user

### Findings Display
- [ ] Findings grouped by filename
- [ ] Severity badges correct colors
- [ ] Confidence badge NOT inverted
- [ ] Danger Zone badge on 5+ files
- [ ] Fix hints expand/collapse
- [ ] False positive marking works (2 stages)
- [ ] Filter buttons work correctly
- [ ] Summary card shows after analysis

### Developer Scorecard
- [ ] Shows all developers with scores
- [ ] Badge color matches score
- [ ] Score bar animates on load
- [ ] Links to developer profile
- [ ] Shows escalation warning for low scores
- [ ] Empty state when no data
- [ ] Auth headers included in API requests

### File Heatmap
- [ ] Displays chart with correct data
- [ ] Color codes by severity
- [ ] Shows danger zone for high-finding files
- [ ] Tooltip works
- [ ] Empty state when no data
- [ ] Auth headers included in API requests

### PR History
- [ ] Lists all analyzed PRs
- [ ] Distinguishes scanned vs imported
- [ ] Expandable findings for scanned PRs
- [ ] False positive marking works
- [ ] Risk score updates after marking
- [ ] Feedback stats displayed

### Developer Profile
- [ ] Shows quality score with correct calculation
- [ ] Displays personalized detection sensitivity
- [ ] Shows top triggered rules
- [ ] Lists recent PRs with risk scores
- [ ] Empty states for insufficient data
- [ ] Auth headers included in global API requests

### WebSocket
- [ ] Connects to correct URL
- [ ] Handles all event types
- [ ] Reconnects on connection drop
- [ ] Cleans up on unmount
- [ ] Shows error on failure
- [ ] Handles malformed messages
- [ ] Authenticates connections

### Navigation
- [ ] Sidebar on all authenticated pages
- [ ] Sidebar collapse/expand works
- [ ] Active state highlights current page
- [ ] Back links navigate correctly
- [ ] Login page has no sidebar
- [ ] Mobile responsive

### Error Handling
- [ ] Backend down: error message shown
- [ ] Invalid routes: 404 page shown
- [ ] Auth expiry: redirect to login
- [ ] Network errors: error state displayed
- [ ] WebSocket errors: handled gracefully
- [ ] No blank screens on errors
- [ ] Error boundaries catch component errors

---

## 18. KNOWN BUGS LIST

| Bug ID | Feature | Description | Severity | Repro Steps |
|--------|---------|-------------|----------|-------------|
| BUG-001 | Dashboard | Loading spinner never times out | Critical | 1. Slow/stop backend 2. Navigate to /dashboard 3. Wait 30s+ |
| BUG-002 | Project Creation | "Creating..." shows forever | Critical | 1. Open modal 2. Fill fields 3. Click Create 4. Observe no progress |
| BUG-003 | WebSocket | No reconnection on drop | Critical | 1. Start analysis 2. Kill backend 3. Observe silent failure |
| BUG-004 | WebSocket | intent_warning event not handled | High | 1. Analyze PR with mismatched ticket 2. No warning shown |
| BUG-005 | Findings | ConfidenceBadge colors inverted | High | 1. View finding with 85% confidence 2. Badge shows red (should be green) |
| BUG-006 | Scorecard | Global fetch has no auth headers | High | 1. Check network tab on /scorecard 2. No Authorization header |
| BUG-007 | Heatmap | Global fetch has no auth headers | High | 1. Check network tab on /heatmap 2. No Authorization header |
| BUG-008 | Developer Profile | Global fetch has no auth headers | High | 1. Check network tab on /developer/{author} 2. No Authorization header |
| BUG-009 | WebSocket | No authentication on WS connection | High | 1. Connect to WS URL without token 2. Connection accepted |
| BUG-010 | Dashboard | sortedProjects is a no-op memo | Low | 1. Create 3 projects 2. Observe order never changes |
| BUG-011 | Navigation | Only 1 sidebar nav item | Low | 1. View sidebar 2. Only Dashboard link visible |

---

## 19. PRIORITY FIX ORDER

### P0 — Fix Immediately (Blocking Core Functionality)

1. **Dashboard Loading Timeout** (BUG-001) — Add 10s timeout to `loadProjects()`. Show error state on timeout. Prevents infinite spinner that blocks all users.
2. **Project Creation Broken** (BUG-002) — Debug `POST /api/projects` endpoint. Ensure request body is properly parsed. Core feature completely broken.
3. **WebSocket Reconnection** (BUG-003) — Implement exponential backoff reconnection in `connectWS()`. Show reconnection status in UI. Analysis results lost on disconnect.
4. **ConfidenceBadge Color Fix** (BUG-005) — Invert colors in `ConfidenceBadge.tsx`: high confidence (>=80) should be green, low should be gray/red. Directly affects user trust in findings.

### P1 — Fix Soon (Degrading User Experience)

5. **Auth Headers on Global Pages** (BUG-006, BUG-007, BUG-008) — Add auth headers to fetch calls on `/scorecard`, `/heatmap`, `/developer/{author}`. These pages may fail with 401.
6. **Intent Warning Handler** (BUG-004) — Add `if (msg.event === 'intent_warning')` handler in project detail page WebSocket callback. Important for ticket validation workflow.
7. **WebSocket Authentication** (BUG-009) — Add token validation on WebSocket connection. Security vulnerability — any user with jobId can view findings.
8. **404 Page** — Create `pages/404.tsx` with branded not-found page. Users hitting invalid routes see blank screen.
9. **Auth Expiry Handling** — Add 401 response interceptor. Redirect to login on auth failure. Users stuck in broken state after token expiry.
10. **Error Boundaries** — Add React error boundaries to prevent white screen of death on component errors.

### P2 — Fix When Possible (Quality Improvements)

11. **Loading Skeletons** — Replace spinner-only states with skeleton UI for dashboard, scorecard, heatmap. Better perceived performance.
12. **Integrate Unused Components** — Replace inline finding rendering with `FindingCard`. Add `DiffViewer` for inline diffs. Use `SuggestionsPanel` for LLM findings.
13. **Cancel Analysis Button** — Allow users to stop long-running analyses. Currently no way to abort.
14. **No Toast Notifications** — Add toast system for success/error feedback across the app.
15. **Responsive Sidebar** — Make sidebar responsive (hamburger menu on mobile). Currently unusable on small screens.

### P3 — Nice to Have (Polish)

16. **Search/Filter for Projects** — Add search bar to dashboard for many projects.
17. **Sorting for Projects** — Fix `sortedProjects` memo to actually sort.
18. **Date Range Filters** — Add time range selector to scorecard and history.
19. **CSV/PDF Export** — Add UI triggers for existing backend export functionality.
20. **Breadcrumb Navigation** — Add breadcrumbs for sub-page navigation.
21. **Keyboard Navigation** — Ensure all interactive elements are keyboard accessible.
22. **Accessibility Audit** — ARIA labels, color contrast, screen reader support.

---

*End of Test Suite — 150 test cases across 14 feature areas + summary table, risk matrix, acceptance criteria, known bugs list, and priority fix order.*