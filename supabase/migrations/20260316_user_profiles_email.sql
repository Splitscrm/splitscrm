-- ============================================================
-- Add email column to user_profiles
-- Run this in the Supabase SQL Editor AFTER the RLS migration
-- ============================================================

-- Add email column (nullable, for display fallback in admin panel)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS email text;

-- Backfill existing rows from auth.users
UPDATE public.user_profiles up
SET email = au.email
FROM auth.users au
WHERE up.user_id = au.id
  AND up.email IS NULL;
