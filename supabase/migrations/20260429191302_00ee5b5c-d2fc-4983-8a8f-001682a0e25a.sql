CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.org_email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE,
  brand_name text NOT NULL DEFAULT '',
  accent_color text NOT NULL DEFAULT '#111111',
  logo_url text,
  invite_subject text NOT NULL DEFAULT '',
  invite_heading text NOT NULL DEFAULT '',
  invite_body text NOT NULL DEFAULT '',
  signature_name text NOT NULL DEFAULT '',
  signature_title text NOT NULL DEFAULT '',
  signature_company text NOT NULL DEFAULT '',
  signature_phone text NOT NULL DEFAULT '',
  signature_website text NOT NULL DEFAULT '',
  signature_disclaimer text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_settings: admins read"
ON public.org_email_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), org_id, 'org_admin'::app_role) OR public.is_super_admin(auth.uid()));

CREATE POLICY "email_settings: admins insert"
ON public.org_email_settings
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), org_id, 'org_admin'::app_role) OR public.is_super_admin(auth.uid()));

CREATE POLICY "email_settings: admins update"
ON public.org_email_settings
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), org_id, 'org_admin'::app_role) OR public.is_super_admin(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), org_id, 'org_admin'::app_role) OR public.is_super_admin(auth.uid()));

CREATE POLICY "email_settings: admins delete"
ON public.org_email_settings
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), org_id, 'org_admin'::app_role) OR public.is_super_admin(auth.uid()));

CREATE TRIGGER update_org_email_settings_updated_at
BEFORE UPDATE ON public.org_email_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();