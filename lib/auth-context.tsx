"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: [
    "view_all_leads", "manage_leads", "add_leads",
    "view_all_merchants", "manage_merchants",
    "view_all_residuals", "view_buy_rates",
    "manage_partners", "manage_settings",
    "manage_team", "invite_users",
    "submit_applications", "view_all_agents",
    "manage_agent_splits", "approve_payouts",
    "export_data", "view_reports",
  ],
  manager: [
    "view_all_leads", "manage_leads", "add_leads",
    "view_all_merchants", "manage_merchants",
    "view_all_residuals",
    "manage_partners", "manage_settings",
    "manage_team", "invite_users",
    "submit_applications", "view_all_agents",
    "export_data", "view_reports",
  ],
  master_agent: [
    "view_downline_leads", "manage_leads", "add_leads",
    "view_downline_merchants", "manage_own_merchants",
    "view_own_residuals",
    "submit_applications",
    "view_downline_agents",
    "export_data",
  ],
  agent: [
    "view_own_leads", "manage_own_leads", "add_leads",
    "view_own_merchants", "manage_own_merchants",
    "view_own_residuals",
    "submit_applications",
    "export_data",
  ],
  sub_agent: [
    "add_leads",
    "view_own_leads",
    "submit_applications",
  ],
  referral: [
    "add_leads",
    "view_own_leads",
  ],
};

interface AuthContextType {
  user: any | null;
  org: any | null;
  member: any | null;
  isPlatformAdmin: boolean;
  loading: boolean;
  hasPermission: (permission: string) => boolean;
  hasFeature: (feature: string) => boolean;
  isWithinLimit: (limitKey: string, currentCount: number) => boolean;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  org: null,
  member: null,
  isPlatformAdmin: false,
  loading: true,
  hasPermission: () => false,
  hasFeature: () => false,
  isWithinLimit: () => false,
  refreshAuth: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [org, setOrg] = useState<any | null>(null);
  const [member, setMember] = useState<any | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAuth = useCallback(async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      console.log("Auth user:", currentUser?.id, currentUser?.email);
      if (!currentUser) {
        setUser(null);
        setOrg(null);
        setMember(null);
        setIsPlatformAdmin(false);
        setLoading(false);
        return;
      }
      setUser(currentUser);

      // Check if platform admin
      const { data: adminRow } = await supabase
        .from("platform_admins")
        .select("id")
        .eq("user_id", currentUser.id)
        .maybeSingle();
      setIsPlatformAdmin(!!adminRow);

      // Find org membership
      const { data: memberRow, error: memberQueryError } = await supabase
        .from("org_members")
        .select("*")
        .eq("user_id", currentUser.id)
        .maybeSingle();
      console.log("Org member query result:", memberRow, memberQueryError);

      if (memberRow) {
        setMember(memberRow);

        // Fetch organization separately (avoids RLS issues with join)
        const { data: orgData, error: orgQueryError } = await supabase
          .from("organizations")
          .select("*")
          .eq("id", memberRow.org_id)
          .single();
        console.log("Org query result:", orgData, orgQueryError);

        setOrg(orgData || null);
        console.log("Auth context:", { userId: currentUser.id, orgId: memberRow.org_id, role: memberRow.role, isPlatformAdmin: !!adminRow });
      } else {
        // Check if there's a pending invitation for this user's email
        const userEmail = currentUser.email?.toLowerCase();
        let handledViaInvite = false;

        if (userEmail) {
          const { data: pendingInvite } = await supabase
            .from("org_invitations")
            .select("*")
            .eq("email", userEmail)
            .eq("status", "pending")
            .maybeSingle();

          if (pendingInvite) {
            // Accept invitation via RPC (SECURITY DEFINER — bypasses RLS)
            const { data: result, error: acceptErr } = await supabase
              .rpc("accept_org_invitation", { p_invite_email: userEmail });

            if (acceptErr || result?.error) {
              console.error("Failed to accept invitation:", acceptErr || result?.error);
            } else {
              setMember(result.member);
              setOrg(result.org);
              handledViaInvite = true;
            }
          }
        }

        if (!handledViaInvite) {
          // Auto-create organization via RPC (SECURITY DEFINER — bypasses
          // the RETURNING/SELECT policy conflict during org creation)
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("company_name")
            .eq("user_id", currentUser.id)
            .maybeSingle();

          const orgName = profile?.company_name || "My Organization";

          const { data: result, error: createErr } = await supabase
            .rpc("create_org_with_owner", {
              p_org_name: orgName,
              p_plan: "trial",
            });

          if (createErr || !result?.org) {
            console.error("Failed to auto-create organization:", createErr);
            setLoading(false);
            return;
          }

          setMember(result.member);
          setOrg(result.org);
        }
      }
    } catch (err) {
      console.error("Auth context error:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadAuth();
      } else {
        setUser(null);
        setOrg(null);
        setMember(null);
        setIsPlatformAdmin(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadAuth]);

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (isPlatformAdmin) return true;
      if (!member?.role) return false;
      // Check per-user permission overrides first
      if (member.permissions && permission in member.permissions) {
        return member.permissions[permission];
      }
      // Fall back to role defaults
      const perms = ROLE_PERMISSIONS[member.role];
      return perms ? perms.includes(permission) : false;
    },
    [member, isPlatformAdmin]
  );

  const hasFeature = useCallback(
    (feature: string): boolean => {
      if (!org?.plan_limits) return false;
      return org.plan_limits[feature] === true;
    },
    [org]
  );

  const isWithinLimit = useCallback(
    (limitKey: string, currentCount: number): boolean => {
      if (!org?.plan_limits) return true;
      const limit = org.plan_limits[limitKey];
      if (limit == null) return true;
      return currentCount < limit;
    },
    [org]
  );

  const refreshAuth = useCallback(async () => {
    setLoading(true);
    await loadAuth();
  }, [loadAuth]);

  return (
    <AuthContext.Provider
      value={{
        user,
        org,
        member,
        isPlatformAdmin,
        loading,
        hasPermission,
        hasFeature,
        isWithinLimit,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
