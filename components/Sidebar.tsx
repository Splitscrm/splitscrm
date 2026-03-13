"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SplitsLogo from "@/components/SplitsLogo";
import { useAuth } from "@/lib/auth-context";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  master_agent: "Master Agent",
  agent: "Agent",
  sub_agent: "Sub-Agent",
  referral: "Referral",
};

const allNavItems = [
  {
    label: "Dashboard", href: "/dashboard", permission: null,
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1m-2 0h2" /></svg>,
  },
  {
    label: "Leads", href: "/dashboard/leads", permission: null,
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>,
  },
  {
    label: "Merchants", href: "/dashboard/merchants", permission: null,
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
  },
  {
    label: "Partners", href: "/dashboard/partners", permission: "manage_partners",
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
  {
    label: "Residuals", href: "/dashboard/residuals", permission: "view_own_residuals",
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  {
    label: "Statements", href: "/dashboard/statements", permission: null,
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  },
  {
    label: "Settings", href: "/dashboard/settings", permission: "manage_settings",
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
];

// Residuals permissions — show if user has any residual-level permission
const RESIDUAL_PERMISSIONS = ["view_own_residuals", "view_all_residuals", "view_downline_residuals"];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { org, member, hasPermission, loading: authLoading } = useAuth();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Filter nav items based on permissions
  // Show ALL items by default — only hide when we have a confirmed role that lacks the permission
  const visibleNavItems = useMemo(() => {
    if (authLoading || !member?.role) return allNavItems;
    return allNavItems.filter((item) => {
      if (!item.permission) return true;
      // Special case: residuals — show if user has any residual permission
      if (item.permission === "view_own_residuals") {
        return RESIDUAL_PERMISSIONS.some((p) => hasPermission(p));
      }
      return hasPermission(item.permission);
    });
  }, [authLoading, member, hasPermission]);

  // Close sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const roleLabel = member?.role ? ROLE_LABELS[member.role] || member.role : null;

  const navContent = (
    <>
      <div className="mb-10">
        <SplitsLogo size="md" variant="light" />
        {org?.name && (
          <p className="text-xs text-slate-400 mt-2 truncate">{org.name}</p>
        )}
        {roleLabel && (
          <span className="inline-block text-xs text-slate-500 mt-1">{roleLabel}</span>
        )}
      </div>
      <nav className="space-y-1 flex-1">
        {visibleNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-base transition-colors duration-150 ${
              isActive(item.href)
                ? "text-white bg-white/10 font-medium"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>
      <button
        onClick={handleSignOut}
        className="text-slate-500 hover:text-white text-sm transition-colors duration-150"
      >
        Sign Out
      </button>
    </>
  );

  return (
    <>
      {/* Mobile header bar */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-200 z-40 flex items-center px-4 lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="w-6 h-5 flex flex-col justify-between"
          aria-label="Open menu"
        >
          <span className="block w-full h-0.5 bg-slate-700 rounded" />
          <span className="block w-full h-0.5 bg-slate-700 rounded" />
          <span className="block w-full h-0.5 bg-slate-700 rounded" />
        </button>
        <div className="flex-1 flex justify-center">
          <SplitsLogo size="sm" />
        </div>
        <div className="w-6" />
      </div>

      {/* Desktop sidebar — always visible on lg+ */}
      <div className="hidden lg:flex fixed left-0 top-0 h-full w-64 bg-[#0F172A] p-6 flex-col z-10">
        {navContent}
      </div>

      {/* Mobile sidebar — slide-out drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          {/* Panel */}
          <div className="absolute left-0 top-0 h-full w-72 bg-[#0F172A] p-6 flex flex-col transform transition-transform duration-300 translate-x-0">
            {/* Close button */}
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
              aria-label="Close menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
