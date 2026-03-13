/**
 * One-time migration script: encrypt plaintext SSNs in deal_owners.
 *
 * Usage:
 *   npx tsx scripts/migrate-ssns.ts
 *
 * Prerequisites:
 *   - ENCRYPTION_KEY must be set in .env.local
 *   - NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { encrypt } from "../lib/encryption";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: owners, error } = await supabase
    .from("deal_owners")
    .select("id, ssn")
    .not("ssn", "is", null)
    .neq("ssn", "");

  if (error) {
    console.error("Failed to fetch deal_owners:", error.message);
    process.exit(1);
  }

  if (!owners || owners.length === 0) {
    console.log("No plaintext SSNs to migrate.");
    return;
  }

  console.log(`Found ${owners.length} deal_owners with plaintext SSNs.`);

  let migrated = 0;
  let errors = 0;

  for (const owner of owners) {
    try {
      const encrypted = encrypt(owner.ssn);
      const { error: updateErr } = await supabase
        .from("deal_owners")
        .update({ ssn_encrypted: encrypted, ssn: null })
        .eq("id", owner.id);

      if (updateErr) {
        console.error(`Failed to update owner ${owner.id}:`, updateErr.message);
        errors++;
      } else {
        migrated++;
      }
    } catch (err: any) {
      console.error(`Encryption failed for owner ${owner.id}:`, err.message);
      errors++;
    }
  }

  console.log(`Migration complete: ${migrated} migrated, ${errors} errors.`);
}

main();
