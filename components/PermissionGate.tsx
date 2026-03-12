"use client";

import { type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";

interface PermissionGateProps {
  permission?: string;
  feature?: string;
  fallback?: ReactNode;
  children: ReactNode;
}

export default function PermissionGate({ permission, feature, fallback = null, children }: PermissionGateProps) {
  const { hasPermission, hasFeature, loading } = useAuth();

  if (loading) return null;

  if (permission && !hasPermission(permission)) return <>{fallback}</>;
  if (feature && !hasFeature(feature)) return <>{fallback}</>;

  return <>{children}</>;
}
