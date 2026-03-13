import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Validate that a redirect path is safe (same-origin, no open redirect).
 * Only allows relative paths starting with / that don't redirect externally.
 */
function getSafeRedirectPath(next: string | null): string {
  if (!next) return '/dashboard'

  // Must start with a single forward slash (not // which would be protocol-relative)
  if (!next.startsWith('/') || next.startsWith('//')) return '/dashboard'

  // Block encoded slashes, backslashes, and other bypass attempts
  if (next.includes('\\') || next.includes('%2f') || next.includes('%2F') || next.includes('%5c') || next.includes('%5C')) {
    return '/dashboard'
  }

  // Only allow paths under known app routes
  const allowedPrefixes = ['/dashboard', '/invite/', '/login', '/signup']
  if (!allowedPrefixes.some(prefix => next.startsWith(prefix))) {
    return '/dashboard'
  }

  return next
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = getSafeRedirectPath(searchParams.get('next'))

  console.log('[auth/callback] Received callback:', {
    hasCode: !!code,
    next,
    allParams: Object.fromEntries(searchParams.entries()),
  })

  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    console.log('[auth/callback] Code exchange result:', { error: error?.message, redirectTo: `${origin}${next}` })
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  console.log('[auth/callback] Falling through to login error redirect')
  return NextResponse.redirect(`${origin}/login?error=auth`)
}
