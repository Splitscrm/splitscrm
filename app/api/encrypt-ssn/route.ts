import { NextRequest, NextResponse } from "next/server";
import { encrypt } from "@/lib/encryption";
import { getAuthenticatedUser } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  try {
    await getAuthenticatedUser(req);

    const { ssn } = await req.json();
    if (!ssn || typeof ssn !== "string") {
      return NextResponse.json({ error: "SSN is required" }, { status: 400 });
    }

    const encrypted = encrypt(ssn);
    return NextResponse.json({ encrypted });
  } catch (err: any) {
    if (err?.status === 401 || err?.status === 403) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Encrypt SSN error:", err);
    return NextResponse.json({ error: "Encryption failed" }, { status: 500 });
  }
}
