import { supabase } from "@/lib/supabase";

/**
 * Returns the Authorization header value for API calls.
 */
export async function getAuthHeader(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? `Bearer ${session.access_token}` : "";
}

/**
 * Wrapper around fetch that automatically adds the Supabase auth header.
 */
export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = await getAuthHeader();
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", token);
  }
  return fetch(url, { ...init, headers });
}
