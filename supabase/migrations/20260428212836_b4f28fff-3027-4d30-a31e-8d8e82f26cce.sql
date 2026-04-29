-- Add account_type to user_profiles to distinguish personal vs organisation accounts
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'personal'
  CHECK (account_type IN ('personal', 'organisation'));

-- Add account_type to organisations to mark personal workspaces (hidden from team UI)
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'organisation'
  CHECK (account_type IN ('personal', 'organisation'));

CREATE INDEX IF NOT EXISTS idx_organisations_account_type ON public.organisations(account_type);