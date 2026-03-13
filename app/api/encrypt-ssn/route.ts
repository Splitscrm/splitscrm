import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { encrypt } from "@/lib/encryption";

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

    const { ssn } = await req.json();
    if (!ssn || typeof ssn !== "string") {
      return NextResponse.json({ error: "SSN is required" }, { status: 400 });
    }

    const encrypted = encrypt(ssn);
    return NextResponse.json({ encrypted });
  } catch (err: any) {
    console.error("Encrypt SSN error:", err);
    return NextResponse.json({ error: "Encryption failed" }, { status: 500 });
  }
}
