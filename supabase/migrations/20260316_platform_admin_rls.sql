-- ============================================================
-- Platform Admin RLS bypass
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Create is_platform_admin() helper function
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = auth.uid()
  );
$$;

-- 2. Organizations: allow platform admins to SELECT all rows
CREATE POLICY "Platform admins see all orgs"
  ON public.organizations
  FOR SELECT
  USING (public.is_platform_admin());

-- Allow platform admins to UPDATE any org (plan changes, limits, etc.)
CREATE POLICY "Platform admins update all orgs"
  ON public.organizations
  FOR UPDATE
  USING (public.is_platform_admin());

-- Allow platform admins to INSERT orgs
CREATE POLICY "Platform admins insert orgs"
  ON public.organizations
  FOR INSERT
  WITH CHECK (public.is_platform_admin());

-- 3. Org Members: allow platform admins full access
CREATE POLICY "Platform admins see all members"
  ON public.org_members
  FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "Platform admins manage all members"
  ON public.org_members
  FOR ALL
  USING (public.is_platform_admin());

-- 4. User Profiles: allow platform admins to read all profiles
CREATE POLICY "Platform admins see all profiles"
  ON public.user_profiles
  FOR SELECT
  USING (public.is_platform_admin());

-- 5. Org Invitations: allow platform admins full access
CREATE POLICY "Platform admins see all invitations"
  ON public.org_invitations
  FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "Platform admins manage all invitations"
  ON public.org_invitations
  FOR ALL
  USING (public.is_platform_admin());
