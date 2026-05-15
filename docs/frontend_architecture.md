# Frontend Architecture

## Overview

The DevDiff frontend is built with **Next.js 14**, **React 18**, and **TypeScript**, featuring a modern dark-mode UI with Tailwind CSS. It provides real-time PR analysis visualization with live WebSocket updates.

## Technology Stack

### Core Framework
- **Next.js 14** - React framework with App Router capabilities
- **React 18** - UI library with concurrent features
- **TypeScript** - Type-safe development

### Styling
- **Tailwind CSS** - Utility-first CSS framework
- **PostCSS** - CSS processing
- **Autoprefixer** - CSS vendor prefixes

### State Management & Data
- **Zustand** - Lightweight state management
- **SWR** - Data fetching with caching/revalidation
- **Supabase Client** - Auth and real-time subscriptions

### UI Components
- **Lucide React** - Icon library
- **Framer Motion** - Animations and transitions
- **Recharts** - Data visualization (heatmaps, graphs)

---

## Project Structure

```
frontend/
├── components/          # Reusable UI components
│   ├── AppShell.tsx         # Main layout wrapper
│   ├── ConfidenceBadge.tsx  # ML confidence indicator
│   ├── DiffViewer.tsx      # Code diff display
│   ├── FindingCard.tsx     # Individual finding display
│   ├── PRMeta.tsx          # PR metadata card
│   ├── ScoreBar.tsx        # Risk score visualization
│   └── SuggestionsPanel.tsx # AI suggestions panel
├── lib/                # Core utilities and services
│   ├── auth.tsx            # Authentication context
│   ├── supabase.ts         # Supabase client setup
│   ├── uiStore.ts          # Zustand UI state
│   └── websocket.ts        # WebSocket connection handler
├── pages/              # Next.js pages (Pages Router)
│   ├── _app.tsx            # App entry point
│   ├── index.tsx           # Landing page
│   ├── login.tsx           # GitHub OAuth login
│   ├── dashboard.tsx       # Projects overview
│   ├── heatmap.tsx         # Global heatmap view
│   ├── scorecard.tsx       # Global scorecard view
│   ├── profile/
│   │   └── [author].tsx    # Developer profile
│   ├── developer/
│   │   └── [author].tsx    # Public developer stats
│   └── projects/
│       └── [id]/
│           ├── index.tsx       # Project analysis page
│           ├── scorecard.tsx   # Project scorecard
│           ├── heatmap.tsx    # Project heatmap
│           ├── history.tsx    # PR history
│           └── developer/
│               └── [author].tsx # Project-specific developer view
├── styles/
│   └── globals.css          # Global styles
├── tailwind.config.js       # Tailwind configuration
├── next.config.js          # Next.js configuration
├── tsconfig.json           # TypeScript configuration
└── postcss.config.js       # PostCSS configuration
```

---

## Page Architecture

### 1. Landing Page (`/`)
- Hero section with product positioning
- Feature highlights
- Call-to-action buttons
- Links to login

### 2. Login Page (`/login`)
- GitHub OAuth authentication
- Supabase provider integration
- Redirects to dashboard on success

### 3. Dashboard (`/dashboard`)
- Grid of project cards
- Create new project modal
- Project statistics display
- Import status indicators

### 4. Project Analysis (`/projects/[id]`)
- PR URL input form
- Real-time analysis progress
- WebSocket connection for live findings
- Finding cards with:
  - Severity badges (critical/warning/info)
  - Confidence scores
  - Fix suggestions
  - File/line location

### 5. Scorecard (`/projects/[id]/scorecard`)
- Author performance table
- Risk metrics per developer
- Sortable columns
- Aggregated statistics

### 6. Heatmap (`/projects/[id]/heatmap`)
- Recharts-based visualization
- Date-based risk density
- Interactive tooltips
- 30-day rolling view

### 7. History (`/projects/[id]/history`)
- Chronological PR list
- Risk score trends
- Filtering and search

### 8. Developer Profile (`/projects/[id]/developer/[author]`)
- Individual developer analysis
- Pattern breakdown
- Historical PRs
- Risk trends

---

## Component Architecture

### AppShell
The main layout component providing:
- Navigation header
- Sidebar (optional)
- Footer
- Auth state handling
- Responsive design

### Auth Context
React Context providing:
- Session management
- GitHub token handling
- API header generation
- Sign in/out functionality

### WebSocket Service
Manages real-time connections:
```typescript
// Connection flow
const ws = new WebSocket(`ws://localhost:4000/ws/findings/${jobId}`);
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle different event types
};
```

### Zustand UI Store
Global UI state management:
```typescript
interface UIStore {
  selectedProject: string | null;
  setSelectedProject: (id: string) => void;
  theme: 'dark' | 'light';
  // ...
}
```

---

## Design System

### Color Palette
- **Background**: `#0a0a0a` (near black)
- **Surface**: `#111` (dark gray)
- **Border**: `#333` to `#800` (gray scale)
- **Primary**: Blue `#2563eb`
- **Success**: Emerald `#10b981`
- **Warning**: Amber `#f59e0b`
- **Error**: Red `#ef4444`
- **Text Primary**: White `#fff`
- **Text Secondary**: Gray `#9ca3af`

### Typography
- **Font Family**: Geist (Next.js default)
- **Headings**: Bold, tracking-tight
- **Body**: Regular, 14-16px
- **Code**: Monospace, JetBrains Mono style

### Spacing
- Base unit: 4px
- Common spacing: 4, 6, 8, 12, 16, 24, 32, 48px

### Animations
- Framer Motion for transitions
- Page transitions: fade + slide
- Card hover: scale + border glow
- Loading states: pulse, spin

---

## Data Fetching Strategy

### SWR Integration
```typescript
// Example: Fetch project data
const { data, error } = useSWR(
  projectId ? `/api/projects/${projectId}` : null,
  fetcher,
  { revalidateOnFocus: false }
);
```

### Authentication Flow
1. User clicks "Login with GitHub"
2. Redirect to Supabase OAuth
3. GitHub OAuth redirect back
4. Session stored in Supabase client
5. Provider token (GitHub) extracted for API calls

### Real-time Updates
- WebSocket for analysis progress
- Polling for dashboard updates (optional)
- Optimistic UI updates

---

## Performance Optimizations

1. **Code Splitting** - Next.js automatic
2. **Image Optimization** - Next.js Image component
3. **SWR Caching** - Stale-while-revalidate
4. **Virtualization** - For large lists (future)
5. **Lazy Loading** - Heavy components

---

## Responsive Design

### Breakpoints
- **Mobile**: < 640px
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px

### Mobile Considerations
- Stacked layouts
- Touch-friendly buttons (min 44px)
- Collapsible navigation

---

## State Management Architecture

### Local State
- React `useState` for component-specific state
- Form inputs, toggle states

### Global State (Zustand)
- Selected project
- Theme preference
- UI visibility states

### Server State (SWR)
- Project list
- Analysis results
- Developer profiles
- Analytics data

---

## Security Considerations

1. **JWT in memory** - Not stored in localStorage
2. **GitHub token** - Only in memory, sent via headers
3. **HTTPS** - Enforced in production
4. **CORS** - Configured for localhost only
5. **XSS prevention** - React auto-escaping

---

## Future Enhancements

1. **Dark/Light mode toggle**
2. **Keyboard shortcuts**
3. **PWA capabilities**
4. **Offline support**
5. **Advanced filtering**
6. **Export to PDF/CSV**