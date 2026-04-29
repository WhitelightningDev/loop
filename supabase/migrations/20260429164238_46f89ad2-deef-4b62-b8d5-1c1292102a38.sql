-- 1. Add column
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS username text;

-- 2. Helper: slugify a candidate string into username-safe characters
CREATE OR REPLACE FUNCTION public.slugify_username(_input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    substring(
      regexp_replace(lower(coalesce(_input, '')), '[^a-z0-9_.]+', '', 'g')
      from 1 for 30
    ),
    ''
  );
$$;

-- 3. Helper: pick a unique username, appending digits if needed
CREATE OR REPLACE FUNCTION public.generate_unique_username(_seed text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
  n int := 0;
BEGIN
  base := public.slugify_username(_seed);
  IF base IS NULL OR length(base) < 3 THEN
    base := 'user' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
  END IF;
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.user_profiles WHERE lower(username) = lower(candidate)) LOOP
    n := n + 1;
    candidate := substring(base from 1 for greatest(1, 30 - length(n::text))) || n::text;
  END LOOP;
  RETURN candidate;
END;
$$;

-- 4. Backfill existing rows
UPDATE public.user_profiles
SET username = public.generate_unique_username(coalesce(full_name, split_part(email, '@', 1)))
WHERE username IS NULL;

-- 5. Constraints: not null, format, case-insensitive unique
ALTER TABLE public.user_profiles
  ALTER COLUMN username SET NOT NULL;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_username_format
  CHECK (username ~ '^[a-z0-9_.]{3,30}$');

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_username_lower_key
  ON public.user_profiles ((lower(username)));

-- 6. Force lowercase on write via trigger
CREATE OR REPLACE FUNCTION public.normalize_username()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.username IS NOT NULL THEN
    NEW.username := lower(NEW.username);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_normalize_username ON public.user_profiles;
CREATE TRIGGER user_profiles_normalize_username
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.normalize_username();

-- 7. Update handle_new_user trigger to seed username for new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url, username)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'avatar_url',
    public.generate_unique_username(
      coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1))
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;