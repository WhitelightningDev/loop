-- Provider enum
CREATE TYPE public.integration_provider AS ENUM ('github', 'jira', 'figma');
CREATE TYPE public.integration_status AS ENUM ('connected', 'error', 'expired');

-- Public-ish metadata about the connection (no secrets)
CREATE TABLE public.org_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  provider public.integration_provider NOT NULL,
  status public.integration_status NOT NULL DEFAULT 'connected',
  account_label text,
  account_id text,
  scopes text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  connected_by uuid NOT NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, provider)
);

CREATE INDEX idx_org_integrations_org ON public.org_integrations(org_id);

ALTER TABLE public.org_integrations ENABLE ROW LEVEL SECURITY;

-- Any org member can see WHICH integrations are connected
CREATE POLICY "org_integrations: members read"
ON public.org_integrations FOR SELECT TO authenticated
USING (public.is_org_member(auth.uid(), org_id) OR public.is_super_admin(auth.uid()));

-- Only org admins can insert/update/delete
CREATE POLICY "org_integrations: admins manage"
ON public.org_integrations FOR ALL TO authenticated
USING (public.has_role(auth.uid(), org_id, 'org_admin'::public.app_role) OR public.is_super_admin(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), org_id, 'org_admin'::public.app_role) OR public.is_super_admin(auth.uid()));

-- Tokens: service-role only, RLS denies all
CREATE TABLE public.org_integration_secrets (
  integration_id uuid PRIMARY KEY REFERENCES public.org_integrations(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  token_type text,
  expires_at timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_integration_secrets ENABLE ROW LEVEL SECURITY;
-- No policies = no authenticated access. Only service_role bypasses RLS.

-- OAuth state for in-flight connect flows (also service-role only)
CREATE TABLE public.oauth_states (
  state text PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  provider public.integration_provider NOT NULL,
  code_verifier text,
  redirect_to text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes')
);

CREATE INDEX idx_oauth_states_expires ON public.oauth_states(expires_at);

ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
-- No policies = service-role only.

-- updated_at triggers
CREATE TRIGGER trg_org_integrations_touch
BEFORE UPDATE ON public.org_integrations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_org_integration_secrets_touch
BEFORE UPDATE ON public.org_integration_secrets
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();