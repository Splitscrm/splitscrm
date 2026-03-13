"use client";
import SplitsLogo from "./SplitsLogo";

export default function LoadingScreen({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
      <SplitsLogo size="lg" />
      <div className="flex gap-1.5 mt-6">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "0s" }} />
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "0.15s" }} />
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "0.3s" }} />
      </div>
      <p className="text-sm text-slate-400 mt-4">{message}</p>
    </div>
  );
}
