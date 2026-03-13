'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Suspense } from 'react'

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState('')

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code')
      const next = searchParams.get('next') || '/dashboard'

      // PKCE flow: exchange code for session
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          console.error('Code exchange failed:', error.message)
          setError(error.message)
          setTimeout(() => router.replace('/login?error=auth'), 2000)
          return
        }
        router.replace(next.startsWith('/dashboard') || next.startsWith('/invite/') ? next : '/dashboard')
        return
      }

      // Implicit flow: tokens are in the hash fragment.
      // The Supabase client automatically detects and processes them.
      // Wait for the auth state to change.
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.replace(next.startsWith('/dashboard') || next.startsWith('/invite/') ? next : '/dashboard')
        return
      }

      // If no code and no session yet, listen for auth state change
      // (Supabase JS client processes hash fragments asynchronously)
      const timeout = setTimeout(() => {
        setError('Authentication timed out')
        router.replace('/login?error=auth')
      }, 5000)

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          clearTimeout(timeout)
          router.replace(next.startsWith('/dashboard') || next.startsWith('/invite/') ? next : '/dashboard')
        }
      })

      return () => {
        clearTimeout(timeout)
        subscription.unsubscribe()
      }
    }

    handleCallback()
  }, [router, searchParams])

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        {error ? (
          <div>
            <p className="text-red-500 text-sm mb-2">{error}</p>
            <p className="text-slate-400 text-sm">Redirecting to login...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <svg className="w-6 h-6 animate-spin text-emerald-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-slate-500 text-sm">Completing sign in...</p>
          </div>
        )}
      </div>
    </main>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center bg-slate-50"><p className="text-slate-400 text-sm">Loading...</p></main>}>
      <CallbackContent />
    </Suspense>
  )
}
