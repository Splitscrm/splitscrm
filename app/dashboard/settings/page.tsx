'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'

interface Profile {
  id: string
  user_id: string
  full_name: string
  company_name: string
  phone: string
  timezone: string
  notification_lead_assigned: boolean
  notification_stage_changes: boolean
  notification_chargeback_alerts: boolean
  notification_residual_ready: boolean
  notification_weekly_summary: boolean
}

interface Template {
  id: string
  user_id: string
  name: string
  category: string
  subject: string
  body: string
  created_at: string
}

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (HT)' },
]

const CATEGORY_BADGES: Record<string, string> = {
  prospecting: 'bg-blue-50 text-blue-700',
  follow_up: 'bg-amber-50 text-amber-700',
  onboarding: 'bg-emerald-50 text-emerald-700',
  general: 'bg-slate-100 text-slate-600',
}

const CATEGORY_LABELS: Record<string, string> = {
  prospecting: 'Prospecting',
  follow_up: 'Follow Up',
  onboarding: 'Onboarding',
  general: 'General',
}

const DEFAULT_TEMPLATES = [
  {
    name: 'Initial Outreach',
    category: 'prospecting',
    subject: 'Saving {{business_name}} money on payment processing',
    body: 'Hi {{contact_name}},\n\nI came across {{business_name}} and wanted to reach out. Many businesses in your industry are overpaying on processing fees without realizing it.\n\nI\'d love to do a free, no-obligation analysis of your current processing statement to see if we can save you money.\n\nWould you have 15 minutes this week for a quick call?\n\nBest,\n{{agent_name}}',
  },
  {
    name: 'Follow Up',
    category: 'follow_up',
    subject: 'Following up — {{business_name}} processing review',
    body: 'Hi {{contact_name}},\n\nI wanted to follow up on my previous message about reviewing {{business_name}}\'s payment processing costs.\n\nEven a quick look at your most recent statement can reveal savings opportunities. Happy to work around your schedule.\n\nBest,\n{{agent_name}}',
  },
  {
    name: 'Welcome / Onboarding',
    category: 'onboarding',
    subject: 'Welcome to {{business_name}} — next steps',
    body: 'Hi {{contact_name}},\n\nWelcome aboard! We\'re excited to have {{business_name}} as a new merchant.\n\nHere are your next steps:\n1. Your new terminal/gateway will be set up within 2-3 business days\n2. Your first statement will arrive at the end of the month\n3. If you have any questions, don\'t hesitate to reach out\n\nBest,\n{{agent_name}}',
  },
]

function Toggle({ checked, onChange }: { checked: boolean; onChange: (val: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-150 cursor-pointer ${checked ? 'bg-emerald-600' : 'bg-slate-200'}`}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform duration-150 mt-0.5 ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  )
}

const ROLE_BADGE_STYLES: Record<string, string> = {
  owner: 'bg-emerald-50 text-emerald-700',
  manager: 'bg-blue-50 text-blue-700',
  master_agent: 'bg-purple-50 text-purple-700',
  agent: 'bg-slate-100 text-slate-600',
  sub_agent: 'bg-slate-100 text-slate-500',
  referral: 'bg-slate-50 text-slate-400',
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  master_agent: 'Master Agent',
  agent: 'Agent',
  sub_agent: 'Sub-Agent',
  referral: 'Referral',
}

const INVITABLE_ROLES = ['manager', 'master_agent', 'agent', 'sub_agent', 'referral'] as const

interface TeamMember {
  id: string
  org_id: string
  user_id: string | null
  role: string
  status: string
  invited_email: string | null
  profile_name: string | null
  profile_email: string | null
}

const ALL_TABS = ['Profile', 'Notifications', 'Security', 'Templates', 'Team'] as const
type Tab = typeof ALL_TABS[number]

export default function SettingsPage() {
  const router = useRouter()
  const { org, member, hasPermission, user: authUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('Profile')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')
  const [profileMsg, setProfileMsg] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [toggleSaved, setToggleSaved] = useState<string | null>(null)
  const [userId, setUserId] = useState('')

  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)

  // Template state
  const [templates, setTemplates] = useState<Template[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [tplEditing, setTplEditing] = useState<Template | null>(null)
  const [tplIsNew, setTplIsNew] = useState(false)
  const [edName, setEdName] = useState('')
  const [edCategory, setEdCategory] = useState('general')
  const [edSubject, setEdSubject] = useState('')
  const [edBody, setEdBody] = useState('')
  const [tplSaving, setTplSaving] = useState(false)
  const [tplMsg, setTplMsg] = useState('')

  // Team state
  const [teamOrgData, setTeamOrgData] = useState<any>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [teamLoading, setTeamLoading] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<string>('agent')
  const [inviteParent, setInviteParent] = useState('')
  const [inviteSaving, setInviteSaving] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [teamMsg, setTeamMsg] = useState('')

  const settingsRole = member?.role || ''

  // Determine visible tabs based on permissions
  const TABS = ALL_TABS.filter((tab) => {
    if (tab === 'Team') return hasPermission('manage_team')
    if (tab === 'Templates') return settingsRole === 'owner' || settingsRole === 'manager' || settingsRole === 'agent' || settingsRole === 'master_agent'
    return true
  })

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      setEmail(user.email || '')
      setUserId(user.id)

      // Try to fetch existing profile
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (data) {
        setProfile(data)
      } else {
        // Insert blank profile, seeding from auth metadata
        const meta = user.user_metadata || {}
        const { data: created } = await supabase
          .from('user_profiles')
          .insert({
            user_id: user.id,
            full_name: meta.full_name || '',
            company_name: meta.company_name || '',
          })
          .select()
          .single()
        if (created) setProfile(created)
      }

      // Fetch templates
      const { data: tplData } = await supabase
        .from('email_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at')

      let cleanedTemplates = tplData || []

      // Deduplicate: group by name, keep oldest, delete rest
      if (cleanedTemplates.length > 0) {
        const byName: Record<string, Template[]> = {}
        for (const t of cleanedTemplates) {
          if (!byName[t.name]) byName[t.name] = []
          byName[t.name].push(t)
        }
        const idsToDelete: string[] = []
        for (const dupes of Object.values(byName)) {
          if (dupes.length > 1) {
            // Keep the first (oldest by created_at since query is ordered), delete the rest
            for (let i = 1; i < dupes.length; i++) {
              idsToDelete.push(dupes[i].id)
            }
          }
        }
        if (idsToDelete.length > 0) {
          await supabase.from('email_templates').delete().in('id', idsToDelete)
          cleanedTemplates = cleanedTemplates.filter((t) => !idsToDelete.includes(t.id))
        }
      }

      // Seed defaults only if none of the default template names exist
      const defaultNames = DEFAULT_TEMPLATES.map((t) => t.name)
      const hasAnyDefault = cleanedTemplates.some((t) => defaultNames.includes(t.name))

      if (cleanedTemplates.length === 0 || !hasAnyDefault) {
        // Only insert defaults that don't already exist by name
        const existingNames = new Set(cleanedTemplates.map((t) => t.name))
        const toSeed = DEFAULT_TEMPLATES.filter((t) => !existingNames.has(t.name))
        if (toSeed.length > 0) {
          const seeds = toSeed.map((t) => ({ ...t, user_id: user.id }))
          const { data: seeded } = await supabase
            .from('email_templates')
            .insert(seeds)
            .select()
          cleanedTemplates = [...cleanedTemplates, ...(seeded || [])]
        }
      }

      setTemplates(cleanedTemplates)

      setTemplatesLoading(false)
      setLoading(false)
    }
    init()
  }, [])

  const updateField = (field: string, value: any) => {
    if (!profile) return
    setProfile({ ...profile, [field]: value })
  }

  const saveProfile = async () => {
    if (!profile) return
    setProfileSaving(true)
    setProfileMsg('')
    const { id, user_id, ...rest } = profile
    const { error } = await supabase
      .from('user_profiles')
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq('id', profile.id)

    if (!error && userId) {
      supabase.from('user_onboarding').update({ profile_completed: true, updated_at: new Date().toISOString() }).eq('user_id', userId)
    }
    setProfileMsg(error ? 'Error: ' + error.message : 'Profile saved!')
    setTimeout(() => setProfileMsg(''), 3000)
    setProfileSaving(false)
  }

  const toggleNotification = useCallback(async (field: string, value: boolean) => {
    if (!profile) return
    setProfile(prev => prev ? { ...prev, [field]: value } : prev)
    const { error } = await supabase
      .from('user_profiles')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', profile.id)

    if (!error) {
      setToggleSaved(field)
      setTimeout(() => setToggleSaved(null), 1000)
    }
  }, [profile])

  const handlePasswordChange = async () => {
    setPasswordError('')
    setPasswordMsg('')

    if (!newPassword) { setPasswordError('Enter a new password'); return }
    if (newPassword.length < 6) { setPasswordError('Password must be at least 6 characters'); return }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match'); return }

    setPasswordSaving(true)

    // Re-authenticate with current password first
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    })

    if (signInError) {
      setPasswordError('Current password is incorrect')
      setPasswordSaving(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setPasswordError(error.message)
    } else {
      setPasswordMsg('Password updated!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordMsg(''), 3000)
    }
    setPasswordSaving(false)
  }

  const handleGlobalSignOut = async () => {
    await supabase.auth.signOut({ scope: 'global' })
    router.push('/login')
  }

  // Template handlers
  const fetchTemplates = async () => {
    const { data } = await supabase
      .from('email_templates')
      .select('*')
      .eq('user_id', userId)
      .order('created_at')
    setTemplates(data || [])
  }

  const startNewTemplate = () => {
    setTplEditing(null)
    setTplIsNew(true)
    setEdName('')
    setEdCategory('general')
    setEdSubject('')
    setEdBody('')
    setTplMsg('')
  }

  const startEditTemplate = (t: Template) => {
    setTplEditing(t)
    setTplIsNew(true)
    setEdName(t.name)
    setEdCategory(t.category)
    setEdSubject(t.subject)
    setEdBody(t.body)
    setTplMsg('')
  }

  const cancelTemplateEdit = () => {
    setTplIsNew(false)
    setTplEditing(null)
    setTplMsg('')
  }

  const handleTemplateSave = async () => {
    if (!edName.trim()) { setTplMsg('Template name is required'); return }
    setTplSaving(true)
    setTplMsg('')

    if (tplEditing) {
      const { error } = await supabase
        .from('email_templates')
        .update({ name: edName, category: edCategory, subject: edSubject, body: edBody })
        .eq('id', tplEditing.id)
      if (error) { setTplMsg('Error: ' + error.message); setTplSaving(false); return }
    } else {
      const { error } = await supabase
        .from('email_templates')
        .insert({ user_id: userId, name: edName, category: edCategory, subject: edSubject, body: edBody })
      if (error) { setTplMsg('Error: ' + error.message); setTplSaving(false); return }
    }

    await fetchTemplates()
    setTplIsNew(false)
    setTplEditing(null)
    setTplSaving(false)
  }

  const handleTemplateDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return
    await supabase.from('email_templates').delete().eq('id', id)
    await fetchTemplates()
  }

  // Team handlers
  const fetchTeamMembers = useCallback(async () => {
    if (!member?.org_id) return
    setTeamLoading(true)

    // Fetch org data for plan limits
    const { data: fetchedOrg } = await supabase
      .from('organizations')
      .select('id, name, plan, plan_limits')
      .eq('id', member.org_id)
      .single()
    setTeamOrgData(fetchedOrg || null)

    const { data: members } = await supabase
      .from('org_members')
      .select('id, org_id, user_id, role, status, invited_email')
      .eq('org_id', member.org_id)
      .order('created_at', { ascending: true })

    if (!members) { setTeamLoading(false); return }

    // Fetch profiles for members with user_id
    const userIds = members.filter(m => m.user_id).map(m => m.user_id!)
    let profileMap: Record<string, { full_name: string; email?: string }> = {}
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id, full_name')
        .in('user_id', userIds)
      if (profiles) {
        for (const p of profiles) {
          profileMap[p.user_id] = { full_name: p.full_name }
        }
      }
    }

    const enriched: TeamMember[] = members.map(m => ({
      id: m.id,
      org_id: m.org_id,
      user_id: m.user_id,
      role: m.role,
      status: m.status,
      invited_email: m.invited_email,
      profile_name: m.user_id && profileMap[m.user_id] ? profileMap[m.user_id].full_name : null,
      profile_email: m.invited_email || (m.user_id === authUser?.id ? email : null),
    }))

    setTeamMembers(enriched)
    setTeamLoading(false)
  }, [member?.org_id, authUser?.id, email])

  useEffect(() => {
    if (activeTab === 'Team' && member?.org_id) {
      fetchTeamMembers()
    }
  }, [activeTab, member?.org_id, fetchTeamMembers])

  const handleRoleChange = async (memberId: string, newRole: string) => {
    await supabase.from('org_members').update({ role: newRole }).eq('id', memberId)
    setTeamMsg('Role updated')
    setTimeout(() => setTeamMsg(''), 2000)
    fetchTeamMembers()
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Remove this team member? They will lose access to the organization.')) return
    await supabase.from('org_members').delete().eq('id', memberId)
    setTeamMsg('Member removed')
    setTimeout(() => setTeamMsg(''), 2000)
    fetchTeamMembers()
  }

  const generateToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let token = ''
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return token
  }

  const handleInvite = async () => {
    setInviteError('')
    setInviteMsg('')
    setInviteLink('')

    if (!inviteEmail.trim()) { setInviteError('Email is required'); return }
    if (!member?.org_id) { setInviteError('Organization not found'); return }

    // Check plan limit
    const { data: orgData } = await supabase
      .from('organizations')
      .select('plan_limits')
      .eq('id', member.org_id)
      .single()
    const inviteMaxUsers = orgData?.plan_limits?.max_users
    if (inviteMaxUsers && teamMembers.length >= inviteMaxUsers) {
      setInviteError('You\'ve reached your plan limit. Upgrade to add more team members.')
      return
    }

    setInviteSaving(true)
    const token = generateToken()

    const { error: inviteErr } = await supabase
      .from('org_invitations')
      .insert({
        org_id: member.org_id,
        invited_by: authUser?.id,
        email: inviteEmail.toLowerCase().trim(),
        role: inviteRole,
        parent_member_id: inviteParent || null,
        token,
        status: 'pending',
      })

    if (inviteErr) {
      setInviteError('Failed to create invitation: ' + inviteErr.message)
      setInviteSaving(false)
      return
    }

    // Create org_members record with status 'invited'
    const orgMemberInsert = {
      org_id: member.org_id,
      user_id: null,
      role: inviteRole,
      status: 'invited',
      invited_email: inviteEmail.toLowerCase().trim(),
      parent_member_id: inviteParent || null,
    }
    console.log("Inserting org_member:", orgMemberInsert)
    const { data: memberInsertData, error: memberInsertError } = await supabase
      .from('org_members')
      .insert(orgMemberInsert)
      .select()
    console.log("Org member insert result:", memberInsertData, memberInsertError)

    const link = `${window.location.origin}/invite/${token}`
    setInviteLink(link)
    setInviteMsg(`Invitation created for ${inviteEmail}`)
    setInviteSaving(false)
    fetchTeamMembers()
  }

  const closeInviteModal = () => {
    setShowInviteModal(false)
    setInviteEmail('')
    setInviteRole('agent')
    setInviteParent('')
    setInviteMsg('')
    setInviteError('')
    setInviteLink('')
  }

  const parentCandidates = teamMembers.filter(m =>
    m.role === 'master_agent' || m.role === 'agent'
  )

  const currentMemberCount = teamMembers.length
  const maxUsers = teamOrgData?.plan_limits?.max_users
  const atLimit = maxUsers ? currentMemberCount >= maxUsers : false

  const inputClass = 'w-full bg-white text-slate-900 px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-base'
  const labelClass = 'text-base text-slate-600 font-medium block mb-1.5'
  const cardClass = 'bg-white rounded-xl border border-slate-200 shadow-sm p-6'

  if (loading) return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <Sidebar />
      <div className="lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8"><p className="text-slate-500">Loading...</p></div>
    </div>
  )

  const notifications = [
    { field: 'notification_lead_assigned', label: 'New lead assigned', desc: 'Get notified when a lead is assigned to you' },
    { field: 'notification_stage_changes', label: 'Stage changes', desc: 'Get notified when a lead changes pipeline stage' },
    { field: 'notification_chargeback_alerts', label: 'Chargeback alerts', desc: 'Get notified when a merchant approaches chargeback thresholds' },
    { field: 'notification_residual_ready', label: 'Residual reports ready', desc: 'Get notified when new residual data is imported' },
    { field: 'notification_weekly_summary', label: 'Weekly summary', desc: 'Receive a weekly email summary of your portfolio' },
  ]

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <Sidebar />

      <div className="lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-6">
          <h2 className="text-xl lg:text-2xl font-bold text-slate-900">Settings</h2>
          <p className="text-slate-500 mt-1">Manage your account preferences</p>
        </div>

        {/* TAB BAR */}
        <div className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors duration-150 cursor-pointer border-b-2 ${
                activeTab === tab
                  ? 'text-emerald-600 border-emerald-600'
                  : 'text-slate-500 hover:text-slate-700 border-transparent'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="max-w-3xl">
          {/* PROFILE TAB */}
          {activeTab === 'Profile' && (
            <div className={cardClass}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4">
                <h3 className="text-lg font-semibold">Profile</h3>
                <div className="flex flex-wrap items-center gap-3">
                  {profileMsg && (
                    <span className={`text-sm ${profileMsg.startsWith('Error') ? 'text-red-600' : 'text-emerald-600'}`}>{profileMsg}</span>
                  )}
                  <button
                    onClick={saveProfile}
                    disabled={profileSaving}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors duration-150 disabled:opacity-50"
                  >
                    {profileSaving ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Full Name</label>
                    <input
                      type="text"
                      value={profile?.full_name || ''}
                      onChange={(e) => updateField('full_name', e.target.value)}
                      className={inputClass}
                      placeholder="John Smith"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Company Name</label>
                    <input
                      type="text"
                      value={profile?.company_name || ''}
                      onChange={(e) => updateField('company_name', e.target.value)}
                      className={inputClass}
                      placeholder="ABC Payments LLC"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Email</label>
                    <input
                      type="email"
                      value={email}
                      disabled
                      className="w-full bg-slate-100 text-slate-500 px-4 py-2.5 rounded-lg border border-slate-200 text-sm cursor-not-allowed"
                    />
                    <p className="text-xs text-slate-400 mt-1">Email is managed through your account</p>
                  </div>
                  <div>
                    <label className={labelClass}>Phone</label>
                    <input
                      type="tel"
                      value={profile?.phone || ''}
                      onChange={(e) => updateField('phone', e.target.value)}
                      className={inputClass}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Timezone</label>
                  <select
                    value={profile?.timezone || 'America/New_York'}
                    onChange={(e) => updateField('timezone', e.target.value)}
                    className={inputClass}
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'Notifications' && (
            <div className={cardClass}>
              <h3 className="text-lg font-semibold mb-4">Notifications</h3>

              <div>
                {notifications.map((item, idx) => (
                  <div
                    key={item.field}
                    className={`flex items-start justify-between gap-4 py-3 ${idx < notifications.length - 1 ? 'border-b border-slate-100' : ''}`}
                  >
                    <div>
                      <p className="text-sm text-slate-900 font-medium">{item.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {toggleSaved === item.field && (
                        <span className="text-xs text-emerald-600 animate-pulse">Saved</span>
                      )}
                      <Toggle
                        checked={profile?.[item.field as keyof Profile] as boolean ?? true}
                        onChange={(val) => toggleNotification(item.field, val)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECURITY TAB */}
          {activeTab === 'Security' && (
            <div className={cardClass}>
              <h3 className="text-lg font-semibold mb-4">Security</h3>

              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={inputClass}
                    placeholder="••••••••"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={inputClass}
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={inputClass}
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {passwordError && (
                  <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2.5 rounded-lg text-sm">{passwordError}</div>
                )}
                {passwordMsg && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2.5 rounded-lg text-sm">{passwordMsg}</div>
                )}

                <button
                  onClick={handlePasswordChange}
                  disabled={passwordSaving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors duration-150 disabled:opacity-50"
                >
                  {passwordSaving ? 'Updating...' : 'Update Password'}
                </button>
              </div>

              {/* Danger Zone */}
              <div className="mt-8">
                <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                  <h4 className="text-red-700 font-semibold mb-1">Danger Zone</h4>
                  <p className="text-sm text-red-600/70 mb-4">These actions affect your account security across all devices.</p>
                  <button
                    onClick={handleGlobalSignOut}
                    className="bg-white border border-red-300 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150"
                  >
                    Sign out of all devices
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TEMPLATES TAB */}
          {activeTab === 'Templates' && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <p className="text-slate-500 text-sm">Create reusable templates for common emails</p>
                {!tplIsNew && (
                  <button onClick={startNewTemplate} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150">
                    + New Template
                  </button>
                )}
              </div>

              {/* EDITOR */}
              {tplIsNew && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
                  <h3 className="text-lg font-semibold mb-4">{tplEditing ? 'Edit Template' : 'New Template'}</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Template Name</label>
                        <input type="text" value={edName} onChange={(e) => setEdName(e.target.value)} className={inputClass} placeholder="e.g. Initial Outreach" />
                      </div>
                      <div>
                        <label className={labelClass}>Category</label>
                        <select value={edCategory} onChange={(e) => setEdCategory(e.target.value)} className={inputClass}>
                          <option value="prospecting">Prospecting</option>
                          <option value="follow_up">Follow Up</option>
                          <option value="onboarding">Onboarding</option>
                          <option value="general">General</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Subject</label>
                      <input type="text" value={edSubject} onChange={(e) => setEdSubject(e.target.value)} className={inputClass} placeholder="Email subject line" />
                      <p className="text-xs text-slate-400 mt-1">Merge tags: {'{{business_name}}'}, {'{{contact_name}}'}, {'{{agent_name}}'}</p>
                    </div>
                    <div>
                      <label className={labelClass}>Body</label>
                      <textarea value={edBody} onChange={(e) => setEdBody(e.target.value)} className={`${inputClass} resize-none`} rows={10} placeholder="Email body..." />
                      <p className="text-xs text-slate-400 mt-1">Merge tags: {'{{business_name}}'}, {'{{contact_name}}'}, {'{{agent_name}}'}</p>
                    </div>

                    {tplMsg && (
                      <p className={`text-sm ${tplMsg.startsWith('Error') ? 'text-red-600' : 'text-emerald-600'}`}>{tplMsg}</p>
                    )}

                    <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
                      <button onClick={cancelTemplateEdit} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150">
                        Cancel
                      </button>
                      <button onClick={handleTemplateSave} disabled={tplSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 disabled:opacity-50">
                        {tplSaving ? 'Saving...' : 'Save Template'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TEMPLATE LIST */}
              {templatesLoading ? (
                <p className="text-slate-500">Loading templates...</p>
              ) : templates.length === 0 && !tplIsNew ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
                  <p className="text-slate-500 text-lg mb-4">No templates yet</p>
                  <button onClick={startNewTemplate} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-150">
                    Create Your First Template
                  </button>
                </div>
              ) : (
                <div>
                  {templates.map((t) => (
                    <div key={t.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-3">
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold text-slate-900">{t.name}</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${CATEGORY_BADGES[t.category] || CATEGORY_BADGES.general}`}>
                            {CATEGORY_LABELS[t.category] || t.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <button onClick={() => startEditTemplate(t)} className="text-emerald-600 hover:text-emerald-700 text-sm font-medium">Edit</button>
                          <button onClick={() => handleTemplateDelete(t.id)} className="text-red-500 hover:text-red-600 text-sm font-medium">Delete</button>
                        </div>
                      </div>
                      {t.subject && <p className="text-sm text-slate-500">{t.subject}</p>}
                      {t.body && <p className="text-sm text-slate-400 mt-1 line-clamp-2">{t.body}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TEAM TAB */}
          {activeTab === 'Team' && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Team Members</h3>
                  <p className="text-sm text-slate-500 mt-0.5">Manage who has access to your organization</p>
                </div>
                <div className="flex items-center gap-3">
                  {teamMsg && <span className="text-sm text-emerald-600">{teamMsg}</span>}
                  {hasPermission('invite_users') && (
                    <button
                      onClick={() => setShowInviteModal(true)}
                      disabled={atLimit}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      + Invite Member
                    </button>
                  )}
                </div>
              </div>

              {/* Plan limit notice */}
              {maxUsers && (
                <div className="mb-4">
                  <p className="text-sm text-slate-500 mb-2">{currentMemberCount} of {maxUsers} users</p>
                  {atLimit && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm p-3 rounded-lg">
                      You've reached your plan limit. Upgrade to add more team members.
                    </div>
                  )}
                </div>
              )}

              {teamLoading ? (
                <p className="text-slate-500">Loading team members...</p>
              ) : teamMembers.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
                  <p className="text-slate-500 text-lg mb-4">No team members yet</p>
                  {hasPermission('invite_users') && (
                    <button onClick={() => setShowInviteModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-150">
                      Invite Your First Team Member
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  {teamMembers.map((tm) => {
                    const isMe = tm.user_id === authUser?.id
                    const displayName = tm.profile_name || tm.invited_email || 'Unknown'
                    const displayEmail = tm.profile_email || tm.invited_email || ''
                    const canManage = hasPermission('manage_team') && !isMe && tm.role !== 'owner'

                    return (
                      <div key={tm.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base font-semibold text-slate-900 truncate">{displayName}</span>
                            {isMe && <span className="text-xs text-slate-400">(you)</span>}
                            {tm.status === 'invited' && (
                              <span className="bg-amber-50 text-amber-700 text-xs px-2 py-0.5 rounded-full font-medium">Pending invite</span>
                            )}
                          </div>
                          {displayEmail && <p className="text-xs text-slate-500 truncate mt-0.5">{displayEmail}</p>}
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                          {canManage ? (
                            <select
                              value={tm.role}
                              onChange={(e) => handleRoleChange(tm.id, e.target.value)}
                              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-emerald-500"
                            >
                              {INVITABLE_ROLES.map((r) => (
                                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                              ))}
                            </select>
                          ) : (
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${ROLE_BADGE_STYLES[tm.role] || 'bg-slate-100 text-slate-600'}`}>
                              {ROLE_LABELS[tm.role] || tm.role}
                            </span>
                          )}

                          {canManage && (
                            <button
                              onClick={() => handleRemoveMember(tm.id)}
                              className="text-red-500 hover:text-red-600 text-xs font-medium"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* INVITE MODAL */}
              {showInviteModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md mx-4">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-slate-900">Invite Team Member</h3>
                        <button onClick={closeInviteModal} className="text-slate-400 hover:text-slate-600">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {inviteLink ? (
                        <div>
                          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-lg text-sm mb-4">
                            {inviteMsg}
                          </div>
                          <div className="mb-4">
                            <p className="text-sm text-slate-500 mb-2">Email invitations coming soon. Share this link with your team member:</p>
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-2">
                              <input
                                type="text"
                                value={inviteLink}
                                readOnly
                                className="flex-1 bg-transparent text-sm text-slate-700 outline-none min-w-0"
                              />
                              <button
                                onClick={() => { navigator.clipboard.writeText(inviteLink) }}
                                className="text-emerald-600 hover:text-emerald-700 text-sm font-medium shrink-0"
                              >
                                Copy
                              </button>
                            </div>
                          </div>
                          <button
                            onClick={closeInviteModal}
                            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg text-sm font-medium transition-colors duration-150"
                          >
                            Done
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div>
                            <label className={labelClass}>Email Address</label>
                            <input
                              type="email"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                              className={inputClass}
                              placeholder="agent@example.com"
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Role</label>
                            <select
                              value={inviteRole}
                              onChange={(e) => setInviteRole(e.target.value)}
                              className={inputClass}
                            >
                              {INVITABLE_ROLES.map((r) => (
                                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                              ))}
                            </select>
                          </div>
                          {parentCandidates.length > 0 && (
                            <div>
                              <label className={labelClass}>Reports to (optional)</label>
                              <select
                                value={inviteParent}
                                onChange={(e) => setInviteParent(e.target.value)}
                                className={inputClass}
                              >
                                <option value="">None</option>
                                {parentCandidates.map((pc) => (
                                  <option key={pc.id} value={pc.id}>
                                    {pc.profile_name || pc.invited_email || 'Unknown'} ({ROLE_LABELS[pc.role]})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {inviteError && (
                            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2.5 rounded-lg text-sm">{inviteError}</div>
                          )}

                          <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-2">
                            <button onClick={closeInviteModal} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150">
                              Cancel
                            </button>
                            <button
                              onClick={handleInvite}
                              disabled={inviteSaving}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 disabled:opacity-50"
                            >
                              {inviteSaving ? 'Sending...' : 'Send Invite'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
