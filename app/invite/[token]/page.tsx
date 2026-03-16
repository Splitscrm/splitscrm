"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import SplitsLogo from "@/components/SplitsLogo";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  master_agent: "Master Agent",
  agent: "Agent",
  sub_agent: "Sub-Agent",
  referral: "Referral",
};

export default function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<any>(null);
  const [orgName, setOrgName] = useState("");
  const [inviterName, setInviterName] = useState("");
  const [user, setUser] = useState<any>(null);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const load = async () => {
      // Check if user is logged in
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      // Fetch invitation
      const { data: inv } = await supabase
        .from("org_invitations")
        .select("id, org_id, email, role, invited_by")
        .eq("token", token)
        .eq("status", "pending")
        .maybeSingle();

      if (!inv) {
        setLoading(false);
        return;
      }
      setInvite(inv);

      // Fetch org name
      const { data: orgData } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", inv.org_id)
        .single();
      if (orgData) setOrgName(orgData.name);

      // Fetch inviter name
      if (inv.invited_by) {
        const { data: inviterProfile } = await supabase
          .from("user_profiles")
          .select("full_name")
          .eq("user_id", inv.invited_by)
          .maybeSingle();
        if (inviterProfile?.full_name) {
          setInviterName(inviterProfile.full_name);
        }
      }

      setLoading(false);
    };
    load();
  }, [token]);

  const acceptInvite = async () => {
    if (!user || !invite) return;
    setAccepting(true);
    setError("");

    // Update org_members: find the invited record and assign user_id
    const { error: memberError } = await supabase
      .from("org_members")
      .update({
        user_id: user.id,
        status: "active",
        joined_at: new Date().toISOString(),
      })
      .eq("org_id", invite.org_id)
      .eq("invited_email", invite.email)
      .eq("status", "invited");

    if (memberError) {
      // Maybe no invited record exists — create one
      await supabase.from("org_members").insert({
        org_id: invite.org_id,
        user_id: user.id,
        role: invite.role,
        status: "active",
        joined_at: new Date().toISOString(),
      });
    }

    // Mark invitation as accepted
    await supabase
      .from("org_invitations")
      .update({ status: "accepted" })
      .eq("id", invite.id);

    setSuccess(true);
    setAccepting(false);
    setTimeout(() => router.push("/dashboard"), 1500);
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Loading invitation...</p>
      </main>
    );
  }

  if (!invite) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-full max-w-md text-center">
          <div className="flex justify-center mb-8">
            <SplitsLogo size="lg" variant="dark" />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
            <h1 className="text-xl font-semibold text-slate-900 mb-3">Invalid Invitation</h1>
            <p className="text-slate-500 text-sm mb-6">This invite link is invalid or has expired.</p>
            <Link href="/login" className="text-emerald-600 hover:text-emerald-700 text-sm font-medium">
              Go to login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <SplitsLogo size="lg" variant="dark" />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          {success ? (
            <div className="text-center">
              <p className="text-4xl mb-4">&#10003;</p>
              <h1 className="text-xl font-semibold text-slate-900 mb-2">Welcome aboard!</h1>
              <p className="text-slate-500 text-sm">Redirecting to dashboard...</p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-slate-900 text-center mb-2">
                You've been invited
              </h1>
              <p className="text-slate-500 text-sm text-center mb-6">
                Join <span className="font-medium text-slate-700">{orgName || "an organization"}</span> as a <span className="font-medium text-slate-700">{ROLE_LABELS[invite.role] || invite.role}</span>
              </p>

              {inviterName && (
                <p className="text-xs text-slate-400 text-center mb-6">
                  Invited by {inviterName}
                </p>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
                  {error}
                </div>
              )}

              {user ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-500 text-center">
                    Signed in as <span className="font-medium text-slate-700">{user.email}</span>
                  </p>
                  <button
                    onClick={acceptInvite}
                    disabled={accepting}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-medium transition-colors duration-150 disabled:opacity-50"
                  >
                    {accepting ? "Accepting..." : "Accept Invitation"}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Link
                    href={`/signup?invite=${token}`}
                    className="block w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-medium transition-colors duration-150 text-center"
                  >
                    Sign up to accept
                  </Link>
                  <p className="text-center text-sm text-slate-500">
                    Already have an account?{" "}
                    <Link href={`/login?invite=${token}`} className="text-emerald-600 hover:text-emerald-700 font-medium">
                      Log in
                    </Link>
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <p className="text-center text-slate-400 text-xs mt-8">&copy; 2026 Splits CRM</p>
      </div>
    </main>
  );
}
