import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/encryption";

const ALLOWED_ROLES = ["owner", "manager"];

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { encrypted, deal_owner_id } = await req.json();
    if (!encrypted || typeof encrypted !== "string") {
      return NextResponse.json({ error: "Encrypted value is required" }, { status: 400 });
    }

    // Permission check: must be owner/manager or have explicit decrypt_ssn permission
    const { data: memberData } = await supabase
      .from("org_members")
      .select("role, permissions")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!memberData) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const hasExplicitPerm = memberData.permissions?.decrypt_ssn === true;
    if (!ALLOWED_ROLES.includes(memberData.role) && !hasExplicitPerm) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    const plaintext = decrypt(encrypted);

    // Audit log
    await supabase.from("activity_log").insert({
      user_id: user.id,
      action_type: "ssn_revealed",
      field_name: "ssn",
      description: `SSN revealed for deal owner ${deal_owner_id || "unknown"}`,
    });

    return NextResponse.json({ ssn: plaintext });
  } catch (err: any) {
    console.error("Decrypt SSN error:", err);
    return NextResponse.json({ error: "Decryption failed" }, { status: 500 });
  }
}
