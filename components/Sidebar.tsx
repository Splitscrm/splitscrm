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
  { label: "\ud83d\udcca Dashboard", href: "/dashboard", permission: null },
  { label: "\ud83c\udfaf Leads", href: "/dashboard/leads", permission: null },
  { label: "\ud83c\udfea Merchants", href: "/dashboard/merchants", permission: null },
  { label: "\ud83e\udd1d Partners", href: "/dashboard/partners", permission: "manage_partners" },
  { label: "\ud83d\udcb0 Residuals", href: "/dashboard/residuals", permission: "view_own_residuals" },
  { label: "\ud83d\udcc4 Statements", href: "/dashboard/statements", permission: null },
  { label: "\u2699\ufe0f Settings", href: "/dashboard/settings", permission: "manage_settings" },
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
            className={`block px-4 py-2.5 rounded-lg text-[15px] transition-colors duration-150 ${
              isActive(item.href)
                ? "text-white bg-white/10 font-medium"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
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
