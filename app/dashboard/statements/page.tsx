'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default function StatementsPage() {
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) router.push('/login')
    }
    checkUser()
  }, [])

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <Sidebar />

      <div className="lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-screen">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 max-w-2xl w-full text-center">
          <h2 className="text-xl lg:text-2xl font-bold mb-4">Statements</h2>
          <p className="text-slate-500">
            Statement analysis coming soon. Upload merchant processing statements for AI-powered fee comparison and savings analysis.
          </p>
        </div>
      </div>
    </div>
  )
}
