"use client";

import { useSessionTimeout } from "@/lib/use-session-timeout";

function SessionTimeoutModal() {
  const { showWarning, secondsLeft, continueSession, signOut } =
    useSessionTimeout();

  if (!showWarning) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const display = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-1 flex items-center gap-2 text-amber-600">
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
          <h2 className="text-lg font-semibold">Session Expiring</h2>
        </div>
        <p className="mb-4 text-sm text-gray-600">
          Your session will expire in{" "}
          <span className="font-mono font-semibold text-gray-900">
            {display}
          </span>{" "}
          due to inactivity. Click Continue to stay logged in.
        </p>
        <div className="flex gap-3">
          <button
            onClick={continueSession}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            Continue Session
          </button>
          <button
            onClick={signOut}
            className="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SessionTimeoutModal />
      {children}
    </>
  );
}
