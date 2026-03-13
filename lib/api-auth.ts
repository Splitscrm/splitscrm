import { NextRequest } from "next/server";
import { createClient, SupabaseClient, User } from "@supabase/supabase-js";

export type AuthResult = {
  user: User;
  supabase: SupabaseClient;
};

/**
 * Authenticate a request using the Supabase session from the Authorization header.
 * Returns the authenticated user and a Supabase client scoped to that user.
 * Throws an object with { status, message } on failure.
 */
export async function getAuthenticatedUser(req: NextRequest): Promise<AuthResult> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    throw { status: 401, message: "Missing authorization header" };
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw { status: 401, message: "Invalid or expired session" };
  }

  return { user, supabase };
}

/**
 * Check that the user has one of the allowed roles in their org membership.
 * Also passes if the user has an explicit permission override matching any allowed role.
 * Throws an object with { status, message } on failure.
 */
export async function requireRole(
  supabase: SupabaseClient,
  userId: string,
  allowedRoles: string[]
): Promise<{ role: string; permissions: Record<string, boolean> | null }> {
  const { data: memberData } = await supabase
    .from("org_members")
    .select("role, permissions")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (!memberData) {
    throw { status: 403, message: "No active organization membership" };
  }

  if (!allowedRoles.includes(memberData.role)) {
    throw { status: 403, message: "Insufficient permissions" };
  }

  return { role: memberData.role, permissions: memberData.permissions };
}
