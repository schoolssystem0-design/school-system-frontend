"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { logout } from "@/lib/api/auth";

const IDLE_MINUTES = Number(process.env.NEXT_PUBLIC_SESSION_IDLE_MINUTES) || 10;

const IDLE_MS = IDLE_MINUTES * 60 * 1000;

const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "pointerdown"] as const;

/** Signs the user out after 10 minutes (configurable) without pointer or keyboard activity; matches API session idle. */
export function useIdleLogout(options: { enabled: boolean; signInPath: string }) {
  const { enabled, signInPath } = options;
  const router = useRouter();
  const queryClient = useQueryClient();
  const deadline = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signingOut = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const signOut = async () => {
      if (signingOut.current) {
        return;
      }
      signingOut.current = true;
      try {
        await logout();
      } finally {
        queryClient.clear();
        router.replace(signInPath);
      }
    };

    const schedule = () => {
      if (signingOut.current) {
        return;
      }
      if (timer.current) {
        clearTimeout(timer.current);
      }
      deadline.current = Date.now() + IDLE_MS;
      timer.current = setTimeout(() => {
        void signOut();
      }, IDLE_MS);
    };

    const onActivity = () => {
      if (signingOut.current || document.visibilityState === "hidden") {
        return;
      }
      schedule();
    };

    const onVisibility = () => {
      if (signingOut.current) {
        return;
      }
      if (document.visibilityState === "visible" && Date.now() >= deadline.current) {
        void signOut();
        return;
      }
      if (document.visibilityState === "visible") {
        schedule();
      }
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);
    schedule();

    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, signInPath, router, queryClient]);
}
