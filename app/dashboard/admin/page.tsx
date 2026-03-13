"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/lib/auth-context";
import LoadingScreen from "@/components/LoadingScreen";

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

const PERMISSION_GROUPS = [
  {
    label: "Leads",
    permissions: [
      { key: "view_all_leads", label: "View all leads", desc: "See leads across the entire organization" },
      { key: "view_own_leads", label: "View own leads", desc: "See only self-assigned leads" },
      { key: "view_downline_leads", label: "View downline leads", desc: "See leads from agents below in hierarchy" },
      { key: "manage_leads", label: "Manage leads", desc: "Edit, update stage, and delete leads" },
      { key: "add_leads", label: "Add leads", desc: "Create new leads" },
    ],
  },
  {
    label: "Merchants",
    permissions: [
      { key: "view_all_merchants", label: "View all merchants", desc: "See all merchants in the organization" },
      { key: "view_own_merchants", label: "View own merchants", desc: "See only self-assigned merchants" },
      { key: "view_downline_merchants", label: "View downline merchants", desc: "See merchants from agents below" },
      { key: "manage_merchants", label: "Manage merchants", desc: "Edit and manage all merchants" },
      { key: "manage_own_merchants", label: "Manage own merchants", desc: "Edit only self-assigned merchants" },
    ],
  },
  {
    label: "Residuals",
    permissions: [
      { key: "view_all_residuals", label: "View all residuals", desc: "See residual data for all merchants" },
      { key: "view_own_residuals", label: "View own residuals", desc: "See only own residual data" },
      { key: "view_buy_rates", label: "View buy rates", desc: "See processor buy rates and cost basis" },
    ],
  },
  {
    label: "Partners",
    permissions: [
      { key: "manage_partners", label: "Manage partners", desc: "Add, edit, and remove partners" },
    ],
  },
  {
    label: "Team",
    permissions: [
      { key: "manage_team", label: "Manage team", desc: "Edit team members and roles" },
      { key: "invite_users", label: "Invite users", desc: "Send invitations to new users" },
      { key: "view_all_agents", label: "View all agents", desc: "See all agents in the organization" },
      { key: "view_downline_agents", label: "View downline agents", desc: "See agents below in hierarchy" },
      { key: "manage_agent_splits", label: "Manage agent splits", desc: "Configure agent compensation splits" },
      { key: "approve_payouts", label: "Approve payouts", desc: "Approve residual payouts to agents" },
    ],
  },
  {
    label: "General",
    permissions: [
      { key: "manage_settings", label: "Manage settings", desc: "Access and modify organization settings" },
      { key: "submit_applications", label: "Submit applications", desc: "Submit merchant applications to processors" },
      { key: "export_data", label: "Export data", desc: "Export CSVs and reports" },
      { key: "view_reports", label: "View reports", desc: "Access analytics and reporting dashboards" },
    ],
  },
];

const ROLES = ["owner", "manager", "master_agent", "agent", "sub_agent", "referral"];

const roleColors: Record<string, string> = {
  owner: "bg-purple-50 text-purple-700",
  manager: "bg-blue-50 text-blue-700",
  master_agent: "bg-emerald-50 text-emerald-700",
  agent: "bg-sky-50 text-sky-700",
  sub_agent: "bg-amber-50 text-amber-700",
  referral: "bg-slate-100 text-slate-600",
};

const roleLabels: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  master_agent: "Master Agent",
  agent: "Agent",
  sub_agent: "Sub-Agent",
  referral: "Referral",
};

const planColors: Record<string, string> = {
  trial: "bg-amber-50 text-amber-700",
  starter: "bg-blue-50 text-blue-700",
  growth: "bg-emerald-50 text-emerald-700",
  enterprise: "bg-purple-50 text-purple-700",
};

const statusColors: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  invited: "bg-amber-50 text-amber-700",
  suspended: "bg-red-50 text-red-700",
  pending: "bg-amber-50 text-amber-700",
  accepted: "bg-emerald-50 text-emerald-700",
  expired: "bg-red-50 text-red-700",
  revoked: "bg-slate-100 text-slate-600",
};

export default function AdminPage() {
  const router = useRouter();
  const { user, isPlatformAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("organizations");
  const [msg, setMsg] = useState("");

  // Organizations state
  const [orgs, setOrgs] = useState<any[]>([]);
  const [orgMembers, setOrgMembers] = useState<Record<string, any[]>>({});
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [allProfiles, setAllProfiles] = useState<Record<string, any>>({});
  const [addUserOrg, setAddUserOrg] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("agent");
  const [inviteLink, setInviteLink] = useState("");

  // All Users state
  const [allMembers, setAllMembers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [usersFetched, setUsersFetched] = useState(false);

  // Invitations state
  const [invitations, setInvitations] = useState<any[]>([]);
  const [invitationsFetched, setInvitationsFetched] = useState(false);

  // Add Org modal state
  const [showAddOrg, setShowAddOrg] = useState(false);
  const [newOrg, setNewOrg] = useState({ name: "", slug: "", plan: "starter", plan_limits: { max_users: 3, max_leads: 100, max_merchants: 50 } });
  const [addOrgError, setAddOrgError] = useState("");
  const [addOrgSaving, setAddOrgSaving] = useState(false);
  const [slugError, setSlugError] = useState("");
  const slugCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Permission modal state
  const [permModal, setPermModal] = useState<any | null>(null);
  const [permOverrides, setPermOverrides] = useState<Record<string, boolean>>({});
  const [permSaving, setPermSaving] = useState(false);

  const showMsg = (text: string) => { setMsg(text); setTimeout(() => setMsg(""), 3000); };

  useEffect(() => {
    if (authLoading) return;
    if (!isPlatformAdmin) {
      router.push("/dashboard");
      return;
    }
    fetchOrganizations();
  }, [authLoading, isPlatformAdmin]);

  const fetchOrganizations = async () => {
    setLoading(true);
    const { data: orgData } = await supabase.from("organizations").select("*").order("created_at", { ascending: false });
    if (orgData) {
      setOrgs(orgData);
      // Fetch all members for all orgs
      const { data: members } = await supabase.from("org_members").select("*").order("joined_at", { ascending: false });
      if (members) {
        const grouped: Record<string, any[]> = {};
        for (const m of members) {
          if (!grouped[m.org_id]) grouped[m.org_id] = [];
          grouped[m.org_id].push(m);
        }
        setOrgMembers(grouped);
        // Fetch profiles for all user_ids
        const userIds = members.filter((m: any) => m.user_id).map((m: any) => m.user_id);
        if (userIds.length > 0) {
          const { data: profiles } = await supabase.from("user_profiles").select("user_id, full_name, email").in("user_id", userIds);
          if (profiles) {
            const profileMap: Record<string, any> = {};
            for (const p of profiles) profileMap[p.user_id] = p;
            setAllProfiles(profileMap);
          }
        }
      }
    }
    setLoading(false);
  };

  const fetchAllUsers = async () => {
    if (usersFetched) return;
    const { data: members } = await supabase.from("org_members").select("*").order("joined_at", { ascending: false });
    if (members) {
      // Enrich with org names
      const { data: orgData } = await supabase.from("organizations").select("id, name");
      const orgMap: Record<string, string> = {};
      for (const o of orgData || []) orgMap[o.id] = o.name;
      const enriched = members.map((m: any) => ({ ...m, org_name: orgMap[m.org_id] || "Unknown" }));
      setAllMembers(enriched);
      // Fetch profiles
      const userIds = members.filter((m: any) => m.user_id).map((m: any) => m.user_id);
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("user_profiles").select("user_id, full_name, email").in("user_id", userIds);
        if (profiles) {
          const profileMap: Record<string, any> = { ...allProfiles };
          for (const p of profiles) profileMap[p.user_id] = p;
          setAllProfiles(profileMap);
        }
      }
    }
    setUsersFetched(true);
  };

  const fetchInvitations = async () => {
    if (invitationsFetched) return;
    const { data } = await supabase.from("org_invitations").select("*").order("created_at", { ascending: false });
    if (data) {
      const { data: orgData } = await supabase.from("organizations").select("id, name");
      const orgMap: Record<string, string> = {};
      for (const o of orgData || []) orgMap[o.id] = o.name;
      setInvitations(data.map((inv: any) => ({ ...inv, org_name: orgMap[inv.org_id] || "Unknown" })));
    }
    setInvitationsFetched(true);
  };

  const updateOrgPlan = async (orgId: string, plan: string) => {
    await supabase.from("organizations").update({ plan }).eq("id", orgId);
    setOrgs((prev) => prev.map((o) => o.id === orgId ? { ...o, plan } : o));
    showMsg("Plan updated!");
  };

  const updateOrgLimit = async (orgId: string, field: string, value: number) => {
    const org = orgs.find((o) => o.id === orgId);
    if (!org) return;
    const limits = { ...(org.plan_limits || {}), [field]: value };
    await supabase.from("organizations").update({ plan_limits: limits }).eq("id", orgId);
    setOrgs((prev) => prev.map((o) => o.id === orgId ? { ...o, plan_limits: limits } : o));
  };

  const updateMemberRole = async (memberId: string, orgId: string, role: string) => {
    await supabase.from("org_members").update({ role }).eq("id", memberId);
    setOrgMembers((prev) => {
      const updated = { ...prev };
      if (updated[orgId]) {
        updated[orgId] = updated[orgId].map((m) => m.id === memberId ? { ...m, role } : m);
      }
      return updated;
    });
    showMsg("Role updated!");
  };

  const updateMemberStatus = async (memberId: string, orgId: string, status: string) => {
    await supabase.from("org_members").update({ status }).eq("id", memberId);
    setOrgMembers((prev) => {
      const updated = { ...prev };
      if (updated[orgId]) {
        updated[orgId] = updated[orgId].map((m) => m.id === memberId ? { ...m, status } : m);
      }
      return updated;
    });
    showMsg("Status updated!");
  };

  const removeMember = async (memberId: string, orgId: string) => {
    if (!confirm("Remove this user from the organization?")) return;
    await supabase.from("org_members").delete().eq("id", memberId);
    setOrgMembers((prev) => {
      const updated = { ...prev };
      if (updated[orgId]) {
        updated[orgId] = updated[orgId].filter((m) => m.id !== memberId);
      }
      return updated;
    });
    showMsg("Member removed.");
  };

  const sendInvite = async (orgId: string) => {
    if (!inviteEmail) return;
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("org_invitations").insert({
      org_id: orgId,
      email: inviteEmail.toLowerCase(),
      role: inviteRole,
      token,
      status: "pending",
      invited_by: user?.id,
      expires_at: expiresAt,
    });
    // Create placeholder org_member
    await supabase.from("org_members").insert({
      org_id: orgId,
      invited_email: inviteEmail.toLowerCase(),
      role: inviteRole,
      status: "invited",
    });
    const link = `${window.location.origin}/invite/${token}`;
    setInviteLink(link);
    // Refresh members for this org
    const { data: members } = await supabase.from("org_members").select("*").eq("org_id", orgId).order("joined_at", { ascending: false });
    if (members) setOrgMembers((prev) => ({ ...prev, [orgId]: members }));
    showMsg("Invitation sent!");
  };

  const revokeInvitation = async (invId: string) => {
    await supabase.from("org_invitations").update({ status: "revoked" }).eq("id", invId);
    setInvitations((prev) => prev.map((inv) => inv.id === invId ? { ...inv, status: "revoked" } : inv));
    showMsg("Invitation revoked.");
  };

  const resendInvitation = async (inv: any) => {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("org_invitations").insert({
      org_id: inv.org_id,
      email: inv.email,
      role: inv.role,
      token,
      status: "pending",
      invited_by: user?.id,
      expires_at: expiresAt,
    });
    setInvitationsFetched(false);
    fetchInvitations();
    showMsg("Invitation resent!");
  };

  const openPermModal = (member: any, orgName: string) => {
    const overrides = member.permissions || {};
    setPermOverrides({ ...overrides });
    setPermModal({ ...member, org_name: orgName });
  };

  const getPermValue = (key: string, role: string): boolean => {
    if (key in permOverrides) return permOverrides[key];
    const rolePerms = ROLE_PERMISSIONS[role] || [];
    return rolePerms.includes(key);
  };

  const togglePerm = (key: string, role: string) => {
    const roleDefault = (ROLE_PERMISSIONS[role] || []).includes(key);
    const current = key in permOverrides ? permOverrides[key] : roleDefault;
    const newVal = !current;
    if (newVal === roleDefault) {
      // Remove override if matches default
      const next = { ...permOverrides };
      delete next[key];
      setPermOverrides(next);
    } else {
      setPermOverrides({ ...permOverrides, [key]: newVal });
    }
  };

  const savePermissions = async () => {
    if (!permModal) return;
    setPermSaving(true);
    const permsToSave = Object.keys(permOverrides).length > 0 ? permOverrides : null;
    await supabase.from("org_members").update({ permissions: permsToSave }).eq("id", permModal.id);
    // Update local state
    if (permModal.org_id) {
      setOrgMembers((prev) => {
        const updated = { ...prev };
        if (updated[permModal.org_id]) {
          updated[permModal.org_id] = updated[permModal.org_id].map((m) =>
            m.id === permModal.id ? { ...m, permissions: permsToSave } : m
          );
        }
        return updated;
      });
    }
    setPermSaving(false);
    setPermModal(null);
    showMsg("Permissions saved!");
  };

  const PLAN_DEFAULTS: Record<string, any> = {
    starter: { max_users: 3, max_leads: 100, max_merchants: 50 },
    growth: { max_users: 10, max_leads: 500, max_merchants: 250 },
    enterprise: { max_users: 50, max_leads: 9999, max_merchants: 9999 },
  };

  const SLUG_REGEX = /^[a-z][a-z0-9-]{1,46}[a-z0-9]$/;
  const RESERVED_SLUGS = new Set([
    "admin", "api", "app", "dashboard", "settings", "login", "signup", "auth",
    "billing", "support", "help", "docs", "blog", "status", "www", "mail",
    "ftp", "staging", "dev", "test", "demo", "splits", "platform", "system",
    "root", "null", "undefined",
  ]);

  const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const validateSlugFormat = (slug: string): string => {
    if (!slug) return "";
    if (slug.length < 3) return "Slug must be at least 3 characters.";
    if (slug.length > 48) return "Slug must be 48 characters or less.";
    if (!SLUG_REGEX.test(slug)) return "Must start with a letter, end with a letter or number, and contain only lowercase letters, numbers, and hyphens.";
    if (RESERVED_SLUGS.has(slug)) return "Slug not available.";
    return "";
  };

  const checkSlugAvailability = useCallback(async (slug: string) => {
    const formatErr = validateSlugFormat(slug);
    if (formatErr) { setSlugError(formatErr); return; }
    const { data: existing } = await supabase.from("organizations").select("id").eq("slug", slug).maybeSingle();
    if (existing) { setSlugError("Slug not available."); return; }
    setSlugError("");
  }, []);

  const handleSlugChange = (slug: string) => {
    setNewOrg((prev) => ({ ...prev, slug }));
    if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current);
    const formatErr = validateSlugFormat(slug);
    if (formatErr || !slug) { setSlugError(formatErr); return; }
    slugCheckTimer.current = setTimeout(() => checkSlugAvailability(slug), 400);
  };

  const openAddOrg = () => {
    setNewOrg({ name: "", slug: "", plan: "starter", plan_limits: { ...PLAN_DEFAULTS.starter } });
    setAddOrgError("");
    setSlugError("");
    setInviteLink("");
    setShowAddOrg(true);
  };

  const createOrganization = async () => {
    if (!newOrg.name.trim()) { setAddOrgError("Organization name is required."); return; }
    const slug = newOrg.slug.trim() || slugify(newOrg.name);
    if (!slug) { setAddOrgError("Slug is required."); return; }
    const formatErr = validateSlugFormat(slug);
    if (formatErr) { setSlugError(formatErr); return; }
    setAddOrgSaving(true);
    setAddOrgError("");

    // Check slug availability (reserved + uniqueness)
    const { data: existing } = await supabase.from("organizations").select("id").eq("slug", slug).maybeSingle();
    if (existing) { setSlugError("Slug not available."); setAddOrgSaving(false); return; }

    const { data: inserted, error } = await supabase.from("organizations").insert({
      name: newOrg.name.trim(),
      slug,
      plan: newOrg.plan,
      plan_limits: newOrg.plan_limits,
    }).select().single();

    if (error || !inserted) {
      setAddOrgError(error?.message || "Failed to create organization.");
      setAddOrgSaving(false);
      return;
    }

    setShowAddOrg(false);
    setAddOrgSaving(false);
    await fetchOrganizations();
    setExpandedOrg(inserted.id);
    showMsg("Organization created!");
  };

  const resetPermissions = () => {
    setPermOverrides({});
  };

  const totalUsers = Object.values(orgMembers).reduce((sum, members) => sum + members.length, 0);
  const planBreakdown = orgs.reduce((acc: Record<string, number>, o) => {
    const plan = o.plan || "trial";
    acc[plan] = (acc[plan] || 0) + 1;
    return acc;
  }, {});

  const inputClass = "w-full bg-white text-slate-900 px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm";

  if (authLoading || loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <Sidebar />

      <div className="lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8 animate-fadeIn">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Platform Admin</h2>
            <p className="text-sm text-slate-500">Manage all organizations and users</p>
          </div>
          <div className="flex items-center gap-3">
            {msg && <span className="text-emerald-600 text-sm">{msg}</span>}
            <span className="text-sm text-slate-600">{user?.email}</span>
            <span className="bg-red-50 text-red-600 text-xs px-2 py-1 rounded-full font-medium">Platform Admin</span>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-2 mb-6 border-b border-slate-200 pb-2">
          {[
            { key: "organizations", label: "Organizations" },
            { key: "users", label: "All Users" },
            { key: "invitations", label: "Invitations" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setActiveTab(t.key);
                if (t.key === "users") fetchAllUsers();
                if (t.key === "invitations") fetchInvitations();
              }}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium transition whitespace-nowrap ${
                activeTab === t.key
                  ? "bg-white text-slate-900 border-b-2 border-emerald-500"
                  : "text-slate-400 hover:text-slate-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ORGANIZATIONS TAB */}
        {activeTab === "organizations" && (
          <div>
            <div className="flex justify-end mb-4">
              <button onClick={openAddOrg} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">+ Add Organization</button>
            </div>

            {/* Add Organization Modal */}
            {showAddOrg && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                  <h3 className="font-semibold text-slate-900 mb-4">Create Organization</h3>

                  {addOrgError && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg text-sm mb-4">{addOrgError}</div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Organization Name *</label>
                      <input
                        type="text"
                        value={newOrg.name}
                        onChange={(e) => {
                          const name = e.target.value;
                          const slug = slugify(name);
                          setNewOrg((prev) => ({ ...prev, name, slug }));
                          handleSlugChange(slug);
                        }}
                        className={inputClass}
                        placeholder="e.g. Acme Payments"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Slug</label>
                      <input
                        type="text"
                        value={newOrg.slug}
                        onChange={(e) => handleSlugChange(e.target.value)}
                        className={inputClass}
                        placeholder="acme-payments"
                      />
                      {slugError && <p className="text-xs text-red-500 mt-1">{slugError}</p>}
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Plan</label>
                      <select
                        value={newOrg.plan}
                        onChange={(e) => {
                          const plan = e.target.value;
                          setNewOrg((prev) => ({ ...prev, plan, plan_limits: { ...(PLAN_DEFAULTS[plan] || PLAN_DEFAULTS.starter) } }));
                        }}
                        className={inputClass}
                      >
                        <option value="starter">Starter</option>
                        <option value="growth">Growth</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Plan Limits</label>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs text-slate-400 block mb-0.5">Members</label>
                          <input type="number" value={newOrg.plan_limits.max_users} onChange={(e) => setNewOrg((prev) => ({ ...prev, plan_limits: { ...prev.plan_limits, max_users: parseInt(e.target.value) || 0 } }))} className={inputClass} />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 block mb-0.5">Leads</label>
                          <input type="number" value={newOrg.plan_limits.max_leads} onChange={(e) => setNewOrg((prev) => ({ ...prev, plan_limits: { ...prev.plan_limits, max_leads: parseInt(e.target.value) || 0 } }))} className={inputClass} />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 block mb-0.5">Merchants</label>
                          <input type="number" value={newOrg.plan_limits.max_merchants} onChange={(e) => setNewOrg((prev) => ({ ...prev, plan_limits: { ...prev.plan_limits, max_merchants: parseInt(e.target.value) || 0 } }))} className={inputClass} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <button onClick={() => setShowAddOrg(false)} className="text-slate-500 hover:text-slate-700 px-4 py-2 text-sm">Cancel</button>
                    <button onClick={createOrganization} disabled={addOrgSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
                      {addOrgSaving ? "Creating..." : "Create Organization"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <p className="text-xs text-slate-500 mb-1">Total Organizations</p>
                <p className="text-2xl font-bold text-slate-900">{orgs.length}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <p className="text-xs text-slate-500 mb-1">Total Users</p>
                <p className="text-2xl font-bold text-slate-900">{totalUsers}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <p className="text-xs text-slate-500 mb-1">Active Plans</p>
                <p className="text-sm text-slate-700 mt-1">
                  {Object.entries(planBreakdown).map(([plan, count]) => (
                    <span key={plan} className="mr-2">{count} {plan.charAt(0).toUpperCase() + plan.slice(1)}</span>
                  ))}
                </p>
              </div>
            </div>

            {orgs.map((o) => {
              const members = orgMembers[o.id] || [];
              const isExpanded = expandedOrg === o.id;
              return (
                <div key={o.id} className="bg-white rounded-xl border border-slate-200 shadow-sm mb-3">
                  <div
                    className="p-4 flex justify-between items-center cursor-pointer"
                    onClick={() => setExpandedOrg(isExpanded ? null : o.id)}
                  >
                    <div>
                      <span className="text-base font-semibold text-slate-900">{o.name}</span>
                      {o.slug && <span className="text-xs text-slate-400 ml-2">{o.slug}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${planColors[o.plan] || "bg-slate-100 text-slate-600"}`}>
                        {o.plan || "trial"}
                      </span>
                      <span className="text-sm text-slate-500">{members.length} user{members.length !== 1 ? "s" : ""}</span>
                      <span className={`text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>▼</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 pt-0 border-t border-slate-100">
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4 mt-4">
                        <div>
                          <label className="text-xs text-slate-500 block mb-1">Plan</label>
                          <select
                            value={o.plan || "trial"}
                            onChange={(e) => updateOrgPlan(o.id, e.target.value)}
                            className={inputClass}
                          >
                            <option value="trial">Trial</option>
                            <option value="starter">Starter</option>
                            <option value="growth">Growth</option>
                            <option value="enterprise">Enterprise</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 block mb-1">Max Users</label>
                          <input
                            type="number"
                            value={o.plan_limits?.max_users ?? ""}
                            onChange={(e) => updateOrgLimit(o.id, "max_users", parseInt(e.target.value) || 0)}
                            className={inputClass}
                            placeholder="Unlimited"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 block mb-1">Max Merchants</label>
                          <input
                            type="number"
                            value={o.plan_limits?.max_merchants ?? ""}
                            onChange={(e) => updateOrgLimit(o.id, "max_merchants", parseInt(e.target.value) || 0)}
                            className={inputClass}
                            placeholder="Unlimited"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 block mb-1">Created</label>
                          <p className="text-sm text-slate-700 mt-1">
                            {new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                      </div>

                      <h5 className="text-sm font-semibold text-slate-700 mb-2">Members</h5>
                      {members.length === 0 ? (
                        <p className="text-xs text-slate-400">No members.</p>
                      ) : (
                        members.map((m) => {
                          const profile = m.user_id ? allProfiles[m.user_id] : null;
                          const displayName = profile?.full_name || m.invited_email || profile?.email || "Unknown";
                          return (
                            <div key={m.id} className="flex items-center justify-between py-2 border-b border-slate-50">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-700">{displayName}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${roleColors[m.role] || "bg-slate-100 text-slate-600"}`}>
                                  {roleLabels[m.role] || m.role}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[m.status] || "bg-slate-100 text-slate-600"}`}>
                                  {m.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <select
                                  value={m.role}
                                  onChange={(e) => updateMemberRole(m.id, o.id, e.target.value)}
                                  className="text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-700 focus:outline-none focus:border-emerald-500"
                                >
                                  {ROLES.map((r) => (
                                    <option key={r} value={r}>{roleLabels[r]}</option>
                                  ))}
                                </select>
                                <select
                                  value={m.status}
                                  onChange={(e) => updateMemberStatus(m.id, o.id, e.target.value)}
                                  className="text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-700 focus:outline-none focus:border-emerald-500"
                                >
                                  <option value="active">Active</option>
                                  <option value="suspended">Suspended</option>
                                </select>
                                <button onClick={() => openPermModal(m, o.name)} className="text-xs text-emerald-600 hover:text-emerald-700">Permissions</button>
                                <button onClick={() => removeMember(m.id, o.id)} className="text-xs text-red-400 hover:text-red-500">Remove</button>
                              </div>
                            </div>
                          );
                        })
                      )}

                      {/* Add User */}
                      {addUserOrg === o.id ? (
                        <div className="mt-3 bg-slate-50 rounded-lg p-3 border border-slate-200">
                          <div className="flex gap-2 items-end">
                            <div className="flex-1">
                              <label className="text-xs text-slate-500 block mb-1">Email</label>
                              <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className={inputClass} placeholder="user@example.com" />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500 block mb-1">Role</label>
                              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className={inputClass}>
                                {ROLES.map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}
                              </select>
                            </div>
                            <button onClick={() => sendInvite(o.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-medium transition">Send Invite</button>
                            <button onClick={() => { setAddUserOrg(null); setInviteLink(""); }} className="text-slate-400 hover:text-slate-600 text-xs px-2 py-2">Cancel</button>
                          </div>
                          {inviteLink && (
                            <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                              <p className="text-xs text-emerald-700 mb-1">Invite link:</p>
                              <div className="flex gap-2 items-center">
                                <input type="text" readOnly value={inviteLink} className="text-xs bg-white border border-slate-200 rounded px-2 py-1 flex-1 text-slate-600" />
                                <button onClick={() => { navigator.clipboard.writeText(inviteLink); showMsg("Link copied!"); }} className="text-xs text-emerald-600 hover:text-emerald-700">Copy</button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <button onClick={() => { setAddUserOrg(o.id); setInviteEmail(""); setInviteRole("agent"); setInviteLink(""); }} className="text-emerald-600 hover:text-emerald-700 text-xs font-medium mt-3">
                          + Add User to Org
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ALL USERS TAB */}
        {activeTab === "users" && (
          <div>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-900 w-full sm:w-96"
              />
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Name</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Email</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Organization</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Role</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Joined</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allMembers
                      .filter((m) => {
                        if (!userSearch) return true;
                        const q = userSearch.toLowerCase();
                        const profile = m.user_id ? allProfiles[m.user_id] : null;
                        const name = profile?.full_name || "";
                        const email = m.invited_email || profile?.email || "";
                        return name.toLowerCase().includes(q) || email.toLowerCase().includes(q);
                      })
                      .map((m) => {
                        const profile = m.user_id ? allProfiles[m.user_id] : null;
                        return (
                          <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-700">{profile?.full_name || "—"}</td>
                            <td className="px-4 py-3 text-slate-600">{m.invited_email || profile?.email || "—"}</td>
                            <td className="px-4 py-3 text-slate-600">{m.org_name}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${roleColors[m.role] || "bg-slate-100 text-slate-600"}`}>
                                {roleLabels[m.role] || m.role}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[m.status] || "bg-slate-100 text-slate-600"}`}>
                                {m.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-500 text-xs">
                              {m.joined_at ? new Date(m.joined_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Pending"}
                            </td>
                            <td className="px-4 py-3">
                              <button onClick={() => openPermModal(m, m.org_name)} className="text-xs text-emerald-600 hover:text-emerald-700">Edit</button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* INVITATIONS TAB */}
        {activeTab === "invitations" && (
          <div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Email</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Organization</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Role</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Created</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Expires</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.map((inv) => (
                      <tr key={inv.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-700">{inv.email}</td>
                        <td className="px-4 py-3 text-slate-600">{inv.org_name}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${roleColors[inv.role] || "bg-slate-100 text-slate-600"}`}>
                            {roleLabels[inv.role] || inv.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[inv.status] || "bg-slate-100 text-slate-600"}`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {new Date(inv.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {inv.status === "pending" && (
                              <>
                                <button onClick={() => revokeInvitation(inv.id)} className="text-xs text-red-400 hover:text-red-500">Revoke</button>
                                <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/invite/${inv.token}`); showMsg("Link copied!"); }} className="text-xs text-emerald-600 hover:text-emerald-700">Copy Link</button>
                              </>
                            )}
                            {inv.status === "expired" && (
                              <button onClick={() => resendInvitation(inv)} className="text-xs text-emerald-600 hover:text-emerald-700">Resend</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {invitations.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-sm">No invitations found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PERMISSION MODAL */}
        {permModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-200">
                <h3 className="font-semibold text-slate-900">
                  Manage Permissions for {allProfiles[permModal.user_id]?.full_name || permModal.invited_email || "User"}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Role: {roleLabels[permModal.role] || permModal.role} — Organization: {permModal.org_name || "Unknown"}
                </p>
              </div>

              <div className="overflow-auto flex-1 p-4">
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.label} className="mb-4">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{group.label}</h4>
                    {group.permissions.map((perm) => {
                      const isOn = getPermValue(perm.key, permModal.role);
                      const isOverride = perm.key in permOverrides;
                      return (
                        <div key={perm.key} className="flex justify-between items-center py-2 border-b border-slate-50">
                          <div>
                            <p className="text-sm text-slate-700">{perm.label}</p>
                            <p className="text-xs text-slate-400">{perm.desc}</p>
                          </div>
                          <button
                            onClick={() => togglePerm(perm.key, permModal.role)}
                            className={`relative w-10 h-5 rounded-full transition-colors ${isOn ? "bg-emerald-500" : "bg-slate-300"} ${isOverride ? "ring-2 ring-amber-300" : ""}`}
                          >
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow ${isOn ? "translate-x-5" : "translate-x-0"}`} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-slate-200 flex justify-between items-center">
                <button onClick={resetPermissions} className="text-xs text-slate-400 hover:text-slate-600">Reset to Role Defaults</button>
                <div className="flex gap-3">
                  <button onClick={() => setPermModal(null)} className="text-slate-500 hover:text-slate-700 px-4 py-2 text-sm">Cancel</button>
                  <button onClick={savePermissions} disabled={permSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
                    {permSaving ? "Saving..." : "Save Permissions"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
