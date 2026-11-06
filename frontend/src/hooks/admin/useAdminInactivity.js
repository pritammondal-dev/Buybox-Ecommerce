"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ADMIN_INACTIVITY_TIMEOUT_MS,
  ADMIN_INACTIVITY_WARNING_MS,
  ADMIN_ACTIVITY_THROTTLE_MS,
  ADMIN_SESSION_STORAGE_KEY,
  ADMIN_SESSION_LOGOUT_KEY,
  ADMIN_SESSION_CHANNEL_NAME,
} from "../../constants/admin-session.constants.js";
import { adminAuthService } from "../../services/admin/admin-auth.service.js";
import { useAdminAuthStore } from "../../stores/admin-auth.store.js";

/**
 * Custom Hook for Administrator 30-Minute Inactivity Auto-Logout
 *
 * Enforces session security across all administrator interfaces:
 * - 30-minute inactivity auto-logout
 * - Warning dialog displayed after 28 minutes of inactivity
 * - Throttled activity detection (pointerdown, keydown, scroll, touchstart)
 * - Heartbeat session validation on "Continue Session"
 * - Cross-tab synchronization via BroadcastChannel and localStorage events
 * - Background tab protection via visibilitychange checks
 */
export function useAdminInactivity() {
  const router = useRouter();
  const isAuthenticated = useAdminAuthStore((state) => state.isAuthenticated);
  const logout = useAdminAuthStore((state) => state.logout);

  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(120);
  const [isContinuing, setIsContinuing] = useState(false);

  const lastActivityRef = useRef(Date.now());
  const lastThrottleRef = useRef(0);
  const isWarningOpenRef = useRef(false);
  const isLoggingOutRef = useRef(false);
  const channelRef = useRef(null);

  // Keep ref in sync with state for access in callbacks without stale closures
  useEffect(() => {
    isWarningOpenRef.current = isWarningOpen;
  }, [isWarningOpen]);

  /**
   * Safe cross-tab message dispatcher
   */
  const postChannelMessage = useCallback((message) => {
    try {
      if (channelRef.current) {
        channelRef.current.postMessage(message);
      }
    } catch {
      // Ignore broadcast errors
    }
  }, []);

  /**
   * Perform administrator logout and redirect
   */
  const performLogout = useCallback(
    async (broadcast = true) => {
      if (isLoggingOutRef.current) return;
      isLoggingOutRef.current = true;

      setIsWarningOpen(false);

      if (broadcast) {
        postChannelMessage({ type: "ADMIN_LOGOUT", timestamp: Date.now() });
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(ADMIN_SESSION_LOGOUT_KEY, Date.now().toString());
          } catch {
            // Ignore storage errors
          }
        }
      }

      try {
        await logout();
      } finally {
        if (typeof window !== "undefined") {
          try {
            window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
          } catch {
            // Ignore storage errors
          }
        }
        router.push("/administrator/login");
      }
    },
    [logout, postChannelMessage, router]
  );

  /**
   * Handle "Continue Session" action
   * Verifies existing server-side session validity via heartbeat endpoint.
   * If server rejects (e.g. expired or revoked), logout is triggered immediately.
   */
  const handleContinueSession = useCallback(async () => {
    if (isContinuing) return;
    setIsContinuing(true);

    try {
      await adminAuthService.heartbeat();

      const now = Date.now();
      lastActivityRef.current = now;
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, now.toString());
        } catch {
          // Ignore storage errors
        }
      }

      setIsWarningOpen(false);
      setSecondsRemaining(120);

      postChannelMessage({
        type: "ADMIN_SESSION_CONTINUED",
        timestamp: now,
      });
    } catch {
      // If server session invalid, expired, or rejected, logout immediately
      await performLogout(true);
    } finally {
      setIsContinuing(false);
    }
  }, [isContinuing, performLogout, postChannelMessage]);

  /**
   * Register activity and update timestamp
   */
  const handleUserActivity = useCallback(() => {
    // If warning modal is open, user must explicitly click "Continue Session"
    if (isWarningOpenRef.current || !isAuthenticated) return;

    const now = Date.now();
    if (now - lastThrottleRef.current < ADMIN_ACTIVITY_THROTTLE_MS) {
      return;
    }
    lastThrottleRef.current = now;
    lastActivityRef.current = now;

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, now.toString());
      } catch {
        // Ignore storage errors
      }
    }

    postChannelMessage({
      type: "ADMIN_ACTIVITY",
      timestamp: now,
    });
  }, [isAuthenticated, postChannelMessage]);

  useEffect(() => {
    if (!isAuthenticated || typeof window === "undefined") {
      setIsWarningOpen(false);
      return;
    }

    isLoggingOutRef.current = false;
    const initialNow = Date.now();
    lastActivityRef.current = initialNow;
    try {
      window.localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, initialNow.toString());
    } catch {
      // Ignore storage errors
    }

    // Set up BroadcastChannel for multi-tab synchronization
    if (typeof BroadcastChannel !== "undefined") {
      try {
        channelRef.current = new BroadcastChannel(ADMIN_SESSION_CHANNEL_NAME);
        channelRef.current.onmessage = (event) => {
          const data = event?.data;
          if (!data || typeof data !== "object") return;

          if (data.type === "ADMIN_LOGOUT") {
            performLogout(false);
          } else if (data.type === "ADMIN_SESSION_CONTINUED") {
            const timestamp = Number(data.timestamp) || Date.now();
            lastActivityRef.current = timestamp;
            setIsWarningOpen(false);
            setSecondsRemaining(120);
          } else if (data.type === "ADMIN_ACTIVITY") {
            const timestamp = Number(data.timestamp) || Date.now();
            lastActivityRef.current = Math.max(lastActivityRef.current, timestamp);
            if (!isWarningOpenRef.current) {
              setIsWarningOpen(false);
            }
          }
        };
      } catch {
        channelRef.current = null;
      }
    }

    // Fallback cross-tab synchronization via localStorage storage event
    const handleStorageEvent = (event) => {
      if (event.key === ADMIN_SESSION_LOGOUT_KEY) {
        performLogout(false);
      } else if (event.key === ADMIN_SESSION_STORAGE_KEY && event.newValue) {
        const timestamp = Number(event.newValue);
        if (!Number.isNaN(timestamp)) {
          lastActivityRef.current = Math.max(lastActivityRef.current, timestamp);
          if (isWarningOpenRef.current) {
            // If another tab continued session, dismiss local warning
            const elapsed = Date.now() - timestamp;
            if (elapsed < ADMIN_INACTIVITY_WARNING_MS) {
              setIsWarningOpen(false);
              setSecondsRemaining(120);
            }
          }
        }
      }
    };
    window.addEventListener("storage", handleStorageEvent);

    // Activity event listeners
    const activityEvents = ["pointerdown", "keydown", "scroll", "touchstart"];
    const handleActivityEvent = () => handleUserActivity();

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleActivityEvent, { passive: true });
    });

    // Check timer loop (every 1000ms)
    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastActivityRef.current;

      if (elapsed >= ADMIN_INACTIVITY_TIMEOUT_MS) {
        performLogout(true);
      } else if (elapsed >= ADMIN_INACTIVITY_WARNING_MS) {
        const remainingMs = ADMIN_INACTIVITY_TIMEOUT_MS - elapsed;
        const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
        setIsWarningOpen(true);
        setSecondsRemaining(remainingSec);
      } else {
        if (isWarningOpenRef.current) {
          setIsWarningOpen(false);
          setSecondsRemaining(120);
        }
      }
    }, 1000);

    // Stale background tab detection on tab focus / visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Read latest timestamp from storage in case other tabs were active
        try {
          const stored = window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
          if (stored) {
            const parsed = Number(stored);
            if (!Number.isNaN(parsed)) {
              lastActivityRef.current = Math.max(lastActivityRef.current, parsed);
            }
          }
        } catch {
          // Ignore storage errors
        }

        const now = Date.now();
        const elapsed = now - lastActivityRef.current;

        if (elapsed >= ADMIN_INACTIVITY_TIMEOUT_MS) {
          performLogout(true);
        } else if (elapsed >= ADMIN_INACTIVITY_WARNING_MS) {
          const remainingMs = ADMIN_INACTIVITY_TIMEOUT_MS - elapsed;
          const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
          setIsWarningOpen(true);
          setSecondsRemaining(remainingSec);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      // Clean up all resources
      window.clearInterval(intervalId);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivityEvent);
      });
      window.removeEventListener("storage", handleStorageEvent);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (channelRef.current) {
        try {
          channelRef.current.close();
        } catch {
          // Ignore
        }
        channelRef.current = null;
      }
    };
  }, [isAuthenticated, handleUserActivity, performLogout]);

  return {
    isWarningOpen,
    secondsRemaining,
    isContinuing,
    handleContinueSession,
    handleLogoutNow: () => performLogout(true),
  };
}

export default useAdminInactivity;
