# SaaS Schemas Research: Feature Flags, Plan Limits, and Team Invites

Research date: 2026-03-11

---

## TOPIC 1: Feature Flags and Plan-Based Limits

### Overview

The industry pattern (used by Checkly, Lago, and most SaaS boilerplates) is:

1. A `plans` table defines what each tier includes
2. Limits are **copied** from plans onto the organization/account row at subscription time
3. Feature toggles are stored as a Postgres `text[]` array or a JSONB column
4. Usage is tracked in a separate `usage_tracking` table and checked against limits

This "copy limits to org" pattern is deliberate -- it lets you give a specific customer a custom limit without creating a whole new plan.

### Complete SQL Schema

```sql
-- ============================================================
-- PLANS & FEATURES
-- ============================================================

-- Subscription plans (Starter, Pro, Enterprise, etc.)
CREATE TABLE public.plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL UNIQUE,          -- 'starter', 'pro', 'enterprise'
  display_name  text NOT NULL,                 -- 'Starter Plan'
  stripe_price_id text,                        -- Stripe price lookup
  price_monthly integer NOT NULL DEFAULT 0,    -- cents ($99 = 9900)
  price_yearly  integer NOT NULL DEFAULT 0,    -- cents
  is_active     boolean NOT NULL DEFAULT true,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Master list of features that can be toggled on/off
CREATE TABLE public.features (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text NOT NULL UNIQUE,          -- 'residual_import', 'api_access', 'sso'
  display_name  text NOT NULL,                 -- 'Residual File Import'
  description   text,
  category      text,                          -- 'billing', 'reporting', 'integrations'
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Which features are included in which plan
CREATE TABLE public.plan_features (
  plan_id    uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  feature_id uuid NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  PRIMARY KEY (plan_id, feature_id)
);

-- Quantitative limits per plan (max users, max MIDs, storage, etc.)
CREATE TABLE public.plan_limits (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id    uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  limit_key  text NOT NULL,                    -- 'max_users', 'max_merchants', 'max_file_uploads_monthly'
  limit_value integer NOT NULL,                -- -1 = unlimited
  UNIQUE (plan_id, limit_key)
);

-- Example seed data:
-- INSERT INTO plan_limits (plan_id, limit_key, limit_value) VALUES
--   (starter_id, 'max_users', 3),
--   (starter_id, 'max_merchants', 100),
--   (starter_id, 'max_residual_files_monthly', 5),
--   (pro_id, 'max_users', 15),
--   (pro_id, 'max_merchants', 1000),
--   (pro_id, 'max_residual_files_monthly', -1),   -- unlimited
--   (enterprise_id, 'max_users', -1),
--   (enterprise_id, 'max_merchants', -1),
--   (enterprise_id, 'max_residual_files_monthly', -1);


-- ============================================================
-- ORGANIZATIONS (TENANTS)
-- ============================================================

CREATE TABLE public.organizations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  slug                  text NOT NULL UNIQUE,

  -- Subscription info
  plan_id               uuid REFERENCES public.plans(id),
  subscription_status   text NOT NULL DEFAULT 'trialing'
                        CHECK (subscription_status IN ('trialing','active','past_due','canceled','unpaid')),
  trial_ends_at         timestamptz,
  current_period_ends   timestamptz,

  -- Stripe integration
  stripe_customer_id    text UNIQUE,
  stripe_subscription_id text UNIQUE,

  -- Copied limits (overridable per-org for custom deals)
  max_users             integer NOT NULL DEFAULT 3,
  max_merchants         integer NOT NULL DEFAULT 100,
  max_residual_files_monthly integer NOT NULL DEFAULT 5,

  -- Feature flags (copied from plan, overridable)
  -- Stores feature keys: {'residual_import','agent_portal','api_access'}
  enabled_features      text[] NOT NULL DEFAULT '{}',

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Organization members
CREATE TABLE public.organization_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'member'
                  CHECK (role IN ('owner','admin','member','viewer')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);


-- ============================================================
-- USAGE TRACKING
-- ============================================================

-- Tracks current usage against limits, reset monthly
CREATE TABLE public.usage_tracking (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  usage_key       text NOT NULL,               -- 'users', 'merchants', 'residual_files_monthly'
  current_value   integer NOT NULL DEFAULT 0,
  period_start    date NOT NULL,               -- first of the billing month
  period_end      date NOT NULL,               -- last of the billing month
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, usage_key, period_start)
);

-- Quick index for limit checks
CREATE INDEX idx_usage_tracking_org_key
  ON public.usage_tracking(organization_id, usage_key, period_start);
```

### How Limit Checks Work

```sql
-- Function to check if an org has hit a limit
CREATE OR REPLACE FUNCTION public.check_usage_limit(
  p_org_id uuid,
  p_limit_key text  -- e.g. 'max_users'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_current integer;
  v_usage_key text;
BEGIN
  -- Map limit key to usage key
  v_usage_key := replace(p_limit_key, 'max_', '');  -- 'max_users' -> 'users'

  -- Get the org's limit (copied from plan, possibly overridden)
  EXECUTE format('SELECT %I FROM organizations WHERE id = $1', p_limit_key)
    INTO v_limit USING p_org_id;

  -- -1 means unlimited
  IF v_limit = -1 THEN RETURN true; END IF;

  -- Get current usage
  SELECT COALESCE(current_value, 0) INTO v_current
  FROM usage_tracking
  WHERE organization_id = p_org_id
    AND usage_key = v_usage_key
    AND period_start <= CURRENT_DATE
    AND period_end >= CURRENT_DATE;

  RETURN COALESCE(v_current, 0) < v_limit;
END;
$$;
```

### How Feature Flag Checks Work

```sql
-- Check if a feature is enabled for an org
CREATE OR REPLACE FUNCTION public.has_feature(
  p_org_id uuid,
  p_feature_key text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p_feature_key = ANY(enabled_features)
  FROM organizations
  WHERE id = p_org_id;
$$;
```

### Syncing Plan Changes to Org Limits

```sql
-- Call this when an org upgrades/downgrades via Stripe webhook
CREATE OR REPLACE FUNCTION public.sync_org_to_plan(
  p_org_id uuid,
  p_plan_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_features text[];
  v_limits record;
BEGIN
  -- Update plan reference
  UPDATE organizations SET plan_id = p_plan_id, updated_at = now()
  WHERE id = p_org_id;

  -- Sync feature flags
  SELECT array_agg(f.key) INTO v_features
  FROM plan_features pf
  JOIN features f ON f.id = pf.feature_id
  WHERE pf.plan_id = p_plan_id;

  UPDATE organizations SET enabled_features = COALESCE(v_features, '{}')
  WHERE id = p_org_id;

  -- Sync limits
  FOR v_limits IN
    SELECT limit_key, limit_value FROM plan_limits WHERE plan_id = p_plan_id
  LOOP
    -- Only update columns that exist
    EXECUTE format(
      'UPDATE organizations SET %I = $1, updated_at = now() WHERE id = $2',
      v_limits.limit_key
    ) USING v_limits.limit_value, p_org_id;
  END LOOP;
END;
$$;
```

### RLS Policies for Multi-Tenancy

```sql
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

-- Users can only see their own orgs
CREATE POLICY "Users see own orgs" ON public.organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Members can see their own membership
CREATE POLICY "Members see own memberships" ON public.organization_members
  FOR SELECT USING (user_id = auth.uid());

-- Admins/owners can manage members
CREATE POLICY "Admins manage members" ON public.organization_members
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Usage visible to org members
CREATE POLICY "Members see usage" ON public.usage_tracking
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );
```

### Client-Side Pattern (Next.js)

```typescript
// lib/features.ts
export async function checkFeature(orgId: string, featureKey: string): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('has_feature', { p_org_id: orgId, p_feature_key: featureKey });
  return data === true;
}

export async function checkLimit(orgId: string, limitKey: string): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('check_usage_limit', { p_org_id: orgId, p_limit_key: limitKey });
  return data === true;
}

// Usage in a component or API route:
if (!(await checkFeature(orgId, 'residual_import'))) {
  return { error: 'Upgrade to Pro to use Residual Import' };
}
if (!(await checkLimit(orgId, 'max_merchants'))) {
  return { error: 'Merchant limit reached. Upgrade your plan.' };
}
```

### Example Plan Seed Data (for ISOCRM)

```sql
INSERT INTO plans (id, name, display_name, price_monthly, sort_order) VALUES
  ('11111111-0000-0000-0000-000000000001', 'starter',    'Starter',    9900,  1),
  ('11111111-0000-0000-0000-000000000002', 'pro',        'Pro',        29900, 2),
  ('11111111-0000-0000-0000-000000000003', 'enterprise', 'Enterprise', 49900, 3);

INSERT INTO features (id, key, display_name, category) VALUES
  ('22222222-0000-0000-0000-000000000001', 'residual_import',     'Residual File Import',       'billing'),
  ('22222222-0000-0000-0000-000000000002', 'multi_processor',     'Multi-Processor Support',    'billing'),
  ('22222222-0000-0000-0000-000000000003', 'agent_portal',        'Agent Self-Service Portal',  'agents'),
  ('22222222-0000-0000-0000-000000000004', 'anomaly_detection',   'Month-over-Month Anomalies', 'reporting'),
  ('22222222-0000-0000-0000-000000000005', 'api_access',          'API Access',                 'integrations'),
  ('22222222-0000-0000-0000-000000000006', 'sso',                 'SSO / SAML',                 'security'),
  ('22222222-0000-0000-0000-000000000007', 'automated_payouts',   'Automated ACH Payouts',      'billing'),
  ('22222222-0000-0000-0000-000000000008', 'eboarding',           'E-Boarding Integration',     'integrations');

-- Starter: basic features
INSERT INTO plan_features (plan_id, feature_id) VALUES
  ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001');  -- residual_import only

-- Pro: most features
INSERT INTO plan_features (plan_id, feature_id) VALUES
  ('11111111-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001'),
  ('11111111-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002'),
  ('11111111-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000003'),
  ('11111111-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000004'),
  ('11111111-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000005');

-- Enterprise: everything
INSERT INTO plan_features (plan_id, feature_id) VALUES
  ('11111111-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000001'),
  ('11111111-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000002'),
  ('11111111-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000003'),
  ('11111111-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000004'),
  ('11111111-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000005'),
  ('11111111-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000006'),
  ('11111111-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000007'),
  ('11111111-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000008');

-- Limits
INSERT INTO plan_limits (plan_id, limit_key, limit_value) VALUES
  ('11111111-0000-0000-0000-000000000001', 'max_users', 3),
  ('11111111-0000-0000-0000-000000000001', 'max_merchants', 100),
  ('11111111-0000-0000-0000-000000000001', 'max_residual_files_monthly', 5),
  ('11111111-0000-0000-0000-000000000002', 'max_users', 15),
  ('11111111-0000-0000-0000-000000000002', 'max_merchants', 2000),
  ('11111111-0000-0000-0000-000000000002', 'max_residual_files_monthly', -1),
  ('11111111-0000-0000-0000-000000000003', 'max_users', -1),
  ('11111111-0000-0000-0000-000000000003', 'max_merchants', -1),
  ('11111111-0000-0000-0000-000000000003', 'max_residual_files_monthly', -1);
```

---

## TOPIC 2: Team Invite Flow

### Text Flow Diagram

```
INVITE FLOW (Happy Path - New User)
====================================

Admin Dashboard                    Server/Edge Function               Database                    Email Service
     |                                    |                              |                              |
     |  POST /api/invite                  |                              |                              |
     |  {email, role, org_id}             |                              |                              |
     |----------------------------------->|                              |                              |
     |                                    |  1. Verify admin is          |                              |
     |                                    |     owner/admin of org       |                              |
     |                                    |----------------------------->|                              |
     |                                    |  <-- role confirmed ---------|                              |
     |                                    |                              |                              |
     |                                    |  2. Check: does user with    |                              |
     |                                    |     this email exist?        |                              |
     |                                    |----------------------------->|                              |
     |                                    |  <-- user_id or null --------|                              |
     |                                    |                              |                              |
     |                                    |  3. Check: already a member? |                              |
     |                                    |----------------------------->|                              |
     |                                    |  <-- false ------------------|                              |
     |                                    |                              |                              |
     |                                    |  4. Check: pending invite?   |                              |
     |                                    |----------------------------->|                              |
     |                                    |  <-- false ------------------|                              |
     |                                    |                              |                              |
     |                                    |  5. Check usage limit        |                              |
     |                                    |     (max_users)              |                              |
     |                                    |----------------------------->|                              |
     |                                    |  <-- within limit -----------|                              |
     |                                    |                              |                              |
     |                                    |  6. INSERT invitation        |                              |
     |                                    |     (token, email, org,      |                              |
     |                                    |      role, expires_at)       |                              |
     |                                    |----------------------------->|                              |
     |                                    |  <-- invite record ----------|                              |
     |                                    |                              |                              |
     |                                    |  7. Send invite email        |                              |
     |                                    |     with link containing     |                              |
     |                                    |     token                    |                              |
     |                                    |--------------------------------------------->               |
     |                                    |                              |          email sent           |
     |  <-- 200 OK ----------------------|                              |                              |
     |                                    |                              |                              |


ACCEPT FLOW - NEW USER (no account yet)
=========================================

Recipient Browser                  Server                             Database
     |                                |                                  |
     |  GET /invite/accept?token=abc  |                                  |
     |------------------------------->|                                  |
     |                                |  1. Look up invitation by token  |
     |                                |------------------------------------>
     |                                |  <-- invite record (check        |
     |                                |      status=pending,             |
     |                                |      expires_at > now) ---------|
     |                                |                                  |
     |                                |  2. No auth.users match          |
     |                                |     for this email               |
     |                                |------------------------------------>
     |                                |  <-- null ----------------------|
     |                                |                                  |
     |  <-- Redirect to /signup       |                                  |
     |      ?token=abc&email=x@y.com  |                                  |
     |                                |                                  |
     |  (User fills out signup form)  |                                  |
     |                                |                                  |
     |  POST /auth/signup             |                                  |
     |------------------------------->|                                  |
     |                                |  3. Create auth.users record     |
     |                                |------------------------------------>
     |                                |  <-- user_id -------------------|
     |                                |                                  |
     |                                |  4. INSERT organization_members  |
     |                                |     (org_id, user_id, role)      |
     |                                |------------------------------------>
     |                                |                                  |
     |                                |  5. UPDATE invitation            |
     |                                |     status = 'accepted'          |
     |                                |------------------------------------>
     |                                |                                  |
     |  <-- Redirect to /dashboard    |                                  |


ACCEPT FLOW - EXISTING USER (already has account)
===================================================

Recipient Browser                  Server                             Database
     |                                |                                  |
     |  GET /invite/accept?token=abc  |                                  |
     |------------------------------->|                                  |
     |                                |  1. Look up invitation           |
     |                                |------------------------------------>
     |                                |  <-- invite record --------------|
     |                                |                                  |
     |                                |  2. Find auth.users by email     |
     |                                |------------------------------------>
     |                                |  <-- user_id found! ------------|
     |                                |                                  |
     |  IF not logged in:             |                                  |
     |  <-- Redirect to /login        |                                  |
     |      ?token=abc&redirect=...   |                                  |
     |  (User logs in normally)       |                                  |
     |                                |                                  |
     |  IF logged in (or after login):|                                  |
     |                                |  3. INSERT organization_members  |
     |                                |------------------------------------>
     |                                |                                  |
     |                                |  4. UPDATE invitation            |
     |                                |     status = 'accepted'          |
     |                                |------------------------------------>
     |                                |                                  |
     |  <-- Redirect to /dashboard    |                                  |
```

### Complete SQL Schema

```sql
-- ============================================================
-- INVITATIONS
-- ============================================================

CREATE TABLE public.invitations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invited_by      uuid NOT NULL REFERENCES auth.users(id),
  email           text NOT NULL,
  role            text NOT NULL DEFAULT 'member'
                  CHECK (role IN ('admin','member','viewer')),
  token           uuid NOT NULL DEFAULT gen_random_uuid(),  -- the secret in the invite link
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','accepted','expired','revoked')),
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- Prevent duplicate pending invites for same email+org
  UNIQUE (organization_id, email, status)
);

-- Fast lookup by token (this is the primary access pattern)
CREATE UNIQUE INDEX idx_invitations_token ON public.invitations(token);

-- RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Org admins/owners can see and manage invites for their org
CREATE POLICY "Admins manage invitations" ON public.invitations
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Anyone can read their own invite by calling the RPC (see below)
-- We do NOT give anon SELECT access to the invitations table directly.
```

### Secure Invite Lookup (RPC Function)

The recipient clicking the link may not be logged in. Use a `SECURITY DEFINER` function so the token lookup works without RLS:

```sql
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token uuid)
RETURNS TABLE (
  id              uuid,
  organization_id uuid,
  org_name        text,
  email           text,
  role            text,
  status          text,
  expires_at      timestamptz,
  invited_by_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    i.id,
    i.organization_id,
    o.name AS org_name,
    i.email,
    i.role,
    i.status,
    i.expires_at,
    (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = i.invited_by) AS invited_by_name
  FROM invitations i
  JOIN organizations o ON o.id = i.organization_id
  WHERE i.token = p_token
    AND i.status = 'pending'
    AND i.expires_at > now();
$$;
```

### Accept Invitation (RPC Function)

```sql
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation record;
  v_user_id uuid;
  v_org_id uuid;
BEGIN
  -- Get the calling user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Must be logged in to accept an invitation');
  END IF;

  -- Look up the invitation
  SELECT * INTO v_invitation
  FROM invitations
  WHERE token = p_token
    AND status = 'pending'
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invitation not found, expired, or already used');
  END IF;

  -- Verify the email matches the logged-in user
  IF v_invitation.email != (SELECT email FROM auth.users WHERE id = v_user_id) THEN
    RETURN jsonb_build_object('error', 'This invitation was sent to a different email address');
  END IF;

  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = v_invitation.organization_id AND user_id = v_user_id
  ) THEN
    -- Mark invite as accepted anyway, return success
    UPDATE invitations SET status = 'accepted', accepted_at = now() WHERE id = v_invitation.id;
    RETURN jsonb_build_object('success', true, 'message', 'Already a member');
  END IF;

  -- Add to org
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (v_invitation.organization_id, v_user_id, v_invitation.role);

  -- Mark invite accepted
  UPDATE invitations SET status = 'accepted', accepted_at = now() WHERE id = v_invitation.id;

  -- Increment usage counter
  INSERT INTO usage_tracking (organization_id, usage_key, current_value, period_start, period_end)
  VALUES (
    v_invitation.organization_id,
    'users',
    1,
    date_trunc('month', CURRENT_DATE)::date,
    (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date
  )
  ON CONFLICT (organization_id, usage_key, period_start)
  DO UPDATE SET current_value = usage_tracking.current_value + 1, updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_invitation.organization_id
  );
END;
$$;
```

### Auto-Expire Old Invitations

```sql
-- Run via pg_cron or a scheduled Edge Function
CREATE OR REPLACE FUNCTION public.expire_old_invitations()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH expired AS (
    UPDATE invitations
    SET status = 'expired'
    WHERE status = 'pending' AND expires_at < now()
    RETURNING id
  )
  SELECT count(*)::integer FROM expired;
$$;
```

### Next.js API Route: Send Invitation

```typescript
// app/api/invite/route.ts
import { createClient } from '@/lib/supabase/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { email, role, organization_id } = await request.json();

  // 1. Verify caller is admin/owner of this org
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organization_id)
    .eq('user_id', user.id)
    .single();

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 2. Check user limit
  const { data: canAdd } = await supabase
    .rpc('check_usage_limit', { p_org_id: organization_id, p_limit_key: 'max_users' });

  if (!canAdd) {
    return Response.json({ error: 'User limit reached. Upgrade your plan.' }, { status: 403 });
  }

  // 3. Check for existing pending invite
  const { data: existing } = await supabase
    .from('invitations')
    .select('id')
    .eq('organization_id', organization_id)
    .eq('email', email)
    .eq('status', 'pending')
    .single();

  if (existing) {
    return Response.json({ error: 'An invitation is already pending for this email' }, { status: 409 });
  }

  // 4. Create the invitation
  const { data: invitation, error } = await supabase
    .from('invitations')
    .insert({
      organization_id,
      invited_by: user.id,
      email,
      role: role || 'member',
    })
    .select('id, token')
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // 5. Send invitation email
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/accept?token=${invitation.token}`;

  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', organization_id)
    .single();

  await resend.emails.send({
    from: 'ISOCRM <noreply@yourdomain.com>',
    to: email,
    subject: `You've been invited to join ${org?.name} on ISOCRM`,
    html: `
      <h2>You've been invited!</h2>
      <p>${user.user_metadata?.full_name || user.email} has invited you to join
         <strong>${org?.name}</strong> on ISOCRM as a ${role || 'member'}.</p>
      <a href="${inviteUrl}"
         style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;
                text-decoration:none;border-radius:6px;margin-top:16px;">
        Accept Invitation
      </a>
      <p style="margin-top:24px;color:#6b7280;font-size:14px;">
        This invitation expires in 7 days.
      </p>
    `,
  });

  return Response.json({ success: true, invitation_id: invitation.id });
}
```

### Next.js Page: Accept Invitation

```typescript
// app/invite/accept/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token;
  if (!token) redirect('/');

  const supabase = await createClient();

  // Look up the invitation (works without auth via SECURITY DEFINER)
  const { data: invitation } = await supabase
    .rpc('get_invitation_by_token', { p_token: token })
    .single();

  if (!invitation) {
    // Show expired/invalid page
    return <InviteExpired />;
  }

  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Not logged in -- check if they have an account
    // Redirect to signup or login with the token preserved
    redirect(`/signup?invite_token=${token}&email=${encodeURIComponent(invitation.email)}`);
  }

  // User is logged in -- accept the invitation
  const { data: result } = await supabase
    .rpc('accept_invitation', { p_token: token });

  if (result?.error) {
    return <InviteError message={result.error} />;
  }

  redirect(`/dashboard?org=${invitation.organization_id}`);
}
```

### Supabase Edge Function Alternative (Deno)

If you prefer Edge Functions over Next.js API routes for the invite send:

```typescript
// supabase/functions/invite/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req: Request) => {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Get the calling user from the Authorization header
  const authHeader = req.headers.get('Authorization')!;
  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const { email, role, organization_id } = await req.json();

  // Verify admin role
  const { data: membership } = await supabaseUser
    .from('organization_members')
    .select('role')
    .eq('organization_id', organization_id)
    .eq('user_id', user.id)
    .single();

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  // Create invitation using admin client (bypasses RLS)
  const { data: invitation, error } = await supabaseAdmin
    .from('invitations')
    .insert({
      organization_id,
      invited_by: user.id,
      email,
      role: role || 'member',
    })
    .select('id, token')
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  // Option A: Use supabase.auth.admin.inviteUserByEmail for new users
  // Option B: Send custom email via Resend/SendGrid (recommended for branded emails)

  return new Response(JSON.stringify({ success: true, invitation_id: invitation.id }));
});
```

### Token-Based vs Magic-Link: Decision Matrix

| Approach | Pros | Cons | When to Use |
|----------|------|------|-------------|
| **Custom token** (UUID in `invitations` table) | Full control over flow, works for existing + new users, custom email templates, tracks invite status | Must build email sending, must build accept flow | Multi-tenant apps with custom requirements (recommended for ISOCRM) |
| **`supabase.auth.admin.inviteUserByEmail`** | Built-in, sends email automatically, handles auth signup | Only works for NEW users, no org/role context, generic email template, no invite tracking | Simple apps with no team/org concept |
| **Magic link** (`signInWithOtp`) | No password needed, simple UX | No invite tracking, doesn't handle org membership, user must already exist or you lose context | Apps where you just need passwordless login |

**Recommendation for ISOCRM:** Use the **custom token approach**. You need to track which org and role the invite is for, handle both new and existing users, enforce plan limits, and send branded emails. The built-in Supabase invite method is too simple for multi-tenant SaaS.

---

## Summary: All Tables Needed

```
plans                    -- Subscription tiers (Starter, Pro, Enterprise)
features                 -- Master list of toggleable features
plan_features            -- Many-to-many: which features in which plan
plan_limits              -- Quantitative limits per plan
organizations            -- Tenants with copied limits + feature flags
organization_members     -- User <-> Org with role
usage_tracking           -- Current usage counters per org per period
invitations              -- Pending/accepted/expired invite records
```

These 8 tables (plus `auth.users` from Supabase) give you complete subscription management, feature gating, usage limits, and team invitations.

---

## Sources

- [Checkly: Building a Multi-Tenant SaaS Data Model](https://www.checklyhq.com/blog/building-a-multi-tenant-saas-data-model/)
- [Axel Larsson: Modeling SaaS Subscriptions in Postgres](https://axellarsson.com/blog/modeling-saas-subscriptions-in-postgres/)
- [Redgate: A SaaS Subscription Data Model](https://www.red-gate.com/blog/a-saas-subscription-data-model)
- [Boardshape: RLS for Team Invite System with Supabase](https://boardshape.com/engineering/how-to-implement-rls-for-a-team-invite-system-with-supabase)
- [Supabase Discussion #6055: Invite Team Member Implementation](https://github.com/orgs/supabase/discussions/6055)
- [Mansueli: Invite Users with Supabase Edge Functions](https://blog.mansueli.com/allowing-users-to-invite-others-with-supabase-edge-functions)
- [Supersaas: Invitation Flow](https://supersaas.dev/docs/teams/invite-flow)
- [System Design: Inviting Users to a Group](https://medium.com/@itayeylon/system-design-inviting-users-to-a-group-98b1e0967b06)
- [Supabase: inviteUserByEmail API Reference](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail)
