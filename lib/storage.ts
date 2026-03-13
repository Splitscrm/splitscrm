import { supabase } from "@/lib/supabase";

const SIGNED_URL_EXPIRY = 3600; // 1 hour in seconds

/**
 * Get a signed URL for a file in the deal-documents bucket.
 * Handles both legacy public URLs (starts with http) and storage paths.
 * Returns the signed URL or null on failure.
 *
 * NOTE: The "deal-documents" bucket should be set to PRIVATE in Supabase Dashboard:
 * Storage → deal-documents → Settings → toggle off "Public bucket"
 */
export async function getSignedUrl(fileUrlOrPath: string): Promise<string | null> {
  if (!fileUrlOrPath) return null;

  // Extract storage path from legacy public URLs
  let path = fileUrlOrPath;
  if (fileUrlOrPath.startsWith("http")) {
    const parts = fileUrlOrPath.split("/deal-documents/");
    if (parts[1]) {
      path = decodeURIComponent(parts[1]);
    } else {
      return fileUrlOrPath; // Can't parse, return as-is
    }
  }

  const { data, error } = await supabase.storage
    .from("deal-documents")
    .createSignedUrl(path, SIGNED_URL_EXPIRY);

  if (error || !data?.signedUrl) {
    console.error("Failed to create signed URL:", error);
    return null;
  }

  return data.signedUrl;
}

/**
 * Get signed URLs for multiple files in parallel.
 */
export async function getSignedUrls(paths: string[]): Promise<Record<string, string | null>> {
  const results: Record<string, string | null> = {};
  await Promise.all(
    paths.map(async (p) => {
      results[p] = await getSignedUrl(p);
    })
  );
  return results;
}

/**
 * Extract the storage path from a file_url (handles both legacy URLs and paths).
 */
export function extractStoragePath(fileUrl: string): string {
  if (!fileUrl) return "";
  if (fileUrl.startsWith("http")) {
    const parts = fileUrl.split("/deal-documents/");
    return parts[1] ? decodeURIComponent(parts[1]) : "";
  }
  return fileUrl;
}
