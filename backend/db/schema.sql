CREATE TABLE IF NOT EXISTS public.user_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  github_username TEXT,
  github_avatar   TEXT,
  full_name       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  github_repo   TEXT NOT NULL,
  description   TEXT,
  is_private    BOOLEAN DEFAULT FALSE,
  import_status    TEXT DEFAULT 'pending',
  import_count     INTEGER DEFAULT 0,
  analysis_status  TEXT DEFAULT 'idle',
  analysis_count   INTEGER DEFAULT 0,
  analysis_total   INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pull_requests (
  id            SERIAL PRIMARY KEY,
  project_id    UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  pr_url        TEXT NOT NULL,
  repo          TEXT NOT NULL,
  pr_number     INTEGER NOT NULL,
  pr_title      TEXT,
  author        TEXT,
  ticket_url    TEXT,
  analyzed_at   TIMESTAMPTZ DEFAULT NOW(),
  files_count   INTEGER DEFAULT 0,
  risk_score    INTEGER DEFAULT 0,
  status        TEXT DEFAULT 'pending',
  is_historical BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.findings (
  id             SERIAL PRIMARY KEY,
  project_id     UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  pr_id          INTEGER NOT NULL REFERENCES public.pull_requests(id) ON DELETE CASCADE,
  filename       TEXT NOT NULL,
  line_number    INTEGER NOT NULL,
  rule_name      TEXT NOT NULL,
  severity       TEXT NOT NULL CHECK(severity IN ('critical','warning','info')),
  confidence     REAL NOT NULL DEFAULT 0.0,
  message        TEXT NOT NULL,
  fix_hint       TEXT,
  author         TEXT,
  false_positive INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.developer_patterns (
  id          SERIAL PRIMARY KEY,
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author      TEXT NOT NULL,
  rule_name   TEXT NOT NULL,
  count       INTEGER DEFAULT 1,
  last_seen   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, author, rule_name)
);

CREATE TABLE IF NOT EXISTS public.developer_profiles (
  id                  SERIAL PRIMARY KEY,
  project_id          UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  github_login        TEXT NOT NULL,
  rule_weights        JSONB DEFAULT '{}',
  rule_thresholds     JSONB DEFAULT '{}',
  total_prs_analyzed  INTEGER DEFAULT 0,
  total_findings      INTEGER DEFAULT 0,
  total_critical      INTEGER DEFAULT 0,
  total_warnings      INTEGER DEFAULT 0,
  weights_updated_at  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, github_login)
);

CREATE INDEX IF NOT EXISTS idx_projects_owner       ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_prs_project          ON public.pull_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_findings_project     ON public.findings(project_id);
CREATE INDEX IF NOT EXISTS idx_findings_author      ON public.findings(author);
CREATE INDEX IF NOT EXISTS idx_findings_filename    ON public.findings(filename);
CREATE INDEX IF NOT EXISTS idx_findings_pr_id       ON public.findings(pr_id);
CREATE INDEX IF NOT EXISTS idx_patterns_project     ON public.developer_patterns(project_id);
CREATE INDEX IF NOT EXISTS idx_profiles_project     ON public.developer_profiles(project_id);

ALTER TABLE public.user_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pull_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.findings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developer_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developer_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'own profile') THEN
    CREATE POLICY "own profile"    ON public.user_profiles      FOR ALL USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'own projects') THEN
    CREATE POLICY "own projects"   ON public.projects           FOR ALL USING (auth.uid() = owner_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pull_requests' AND policyname = 'project prs') THEN
    CREATE POLICY "project prs"    ON public.pull_requests      FOR ALL USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'findings' AND policyname = 'project finds') THEN
    CREATE POLICY "project finds"  ON public.findings           FOR ALL USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'developer_patterns' AND policyname = 'project pats') THEN
    CREATE POLICY "project pats"   ON public.developer_patterns FOR ALL USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'developer_profiles' AND policyname = 'project profs') THEN
    CREATE POLICY "project profs"  ON public.developer_profiles FOR ALL USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, github_username, github_avatar, full_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'user_name',
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'full_name'
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Migration: add analysis tracking columns to projects
DO $$ BEGIN
  ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS analysis_status TEXT DEFAULT 'idle';
  ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS analysis_count  INTEGER DEFAULT 0;
  ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS analysis_total  INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- CascadeFlow audit trail for LLM routing decisions
CREATE TABLE IF NOT EXISTS public.audit_trail (
  id                SERIAL PRIMARY KEY,
  project_id        UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  pr_id             INTEGER REFERENCES public.pull_requests(id) ON DELETE CASCADE,
  chunk_filename    TEXT,
  chunk_function    TEXT,
  model_used        TEXT NOT NULL,
  model_cost        REAL DEFAULT 0.0,
  latency_ms        INTEGER DEFAULT 0,
  quality_score     REAL DEFAULT 0.0,
  escalated         BOOLEAN DEFAULT FALSE,
  escalation_reason TEXT,
  tokens_used       INTEGER DEFAULT 0,
  step_number       INTEGER DEFAULT 0,
  total_steps       INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_project ON public.audit_trail(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_pr ON public.audit_trail(pr_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_trail(created_at);

ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_trail' AND policyname = 'project audit') THEN
    CREATE POLICY "project audit" ON public.audit_trail
      FOR ALL USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()));
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
