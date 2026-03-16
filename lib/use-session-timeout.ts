"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const IDLE_WARNING_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const THROTTLE_MS = 30 * 1000; // throttle activity checks to every 30s

export function useSessionTimeout() {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(300);

  const warningTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const countdownRef = useRef<ReturnType<typeof setInterval>>();
  const lastThrottleRef = useRef(0);
  const isWarningRef = useRef(false);

  const clearAllTimers = useCallback(() => {
    clearTimeout(warningTimerRef.current);
    clearTimeout(logoutTimerRef.current);
    clearInterval(countdownRef.current);
  }, []);

  const doSignOut = useCallback(async () => {
    clearAllTimers();
    isWarningRef.current = false;
    setShowWarning(false);
    await supabase.auth.signOut();
    router.push("/");
  }, [clearAllTimers, router]);

  const resetTimers = useCallback(() => {
    clearAllTimers();
    isWarningRef.current = false;
    setShowWarning(false);

    warningTimerRef.current = setTimeout(() => {
      isWarningRef.current = true;
      setShowWarning(true);
      setSecondsLeft(WARNING_DURATION_MS / 1000);

      countdownRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            doSignOut();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      logoutTimerRef.current = setTimeout(doSignOut, WARNING_DURATION_MS);
    }, IDLE_WARNING_MS);
  }, [clearAllTimers, doSignOut]);

  // Stable ref so the event handler always calls the latest resetTimers
  const resetTimersRef = useRef(resetTimers);
  resetTimersRef.current = resetTimers;

  useEffect(() => {
    resetTimersRef.current();

    const handleActivity = () => {
      // Don't reset during warning — user must click Continue
      if (isWarningRef.current) return;

      const now = Date.now();
      if (now - lastThrottleRef.current < THROTTLE_MS) return;
      lastThrottleRef.current = now;

      resetTimersRef.current();
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));

    return () => {
      clearAllTimers();
      events.forEach((e) => window.removeEventListener(e, handleActivity));
    };
  }, [clearAllTimers]);

  const continueSession = useCallback(() => {
    resetTimers();
  }, [resetTimers]);

  return { showWarning, secondsLeft, continueSession, signOut: doSignOut };
}
