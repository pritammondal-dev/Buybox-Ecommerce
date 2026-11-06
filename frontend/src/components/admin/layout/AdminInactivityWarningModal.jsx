"use client";

import React from "react";
import { AlertTriangle, Clock, LogOut, RefreshCw } from "lucide-react";

/**
 * Format remaining seconds into MM:SS display
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatTimeRemaining(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * AdminInactivityWarningModal
 *
 * Rendered when administrator has been inactive for 28 minutes.
 * Alerts user that automatic logout will occur in 2 minutes unless session is continued.
 */
export function AdminInactivityWarningModal({
  isOpen,
  secondsRemaining,
  isContinuing,
  onContinueSession,
  onLogoutNow,
}) {
  if (!isOpen) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="admin-inactivity-title"
      aria-describedby="admin-inactivity-description"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-amber-200 text-slate-800 dark:bg-slate-900 dark:border-amber-500/30 dark:text-slate-100">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
            <AlertTriangle className="h-6 w-6" />
          </div>

          <div className="flex-1 min-w-0">
            <h3
              id="admin-inactivity-title"
              className="text-lg font-bold text-slate-900 dark:text-white"
            >
              Session Expiring Soon
            </h3>
            <p
              id="admin-inactivity-description"
              className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed"
            >
              You have been inactive for 28 minutes. You will be automatically logged out after two more minutes for security reasons unless you continue your session.
            </p>

            {/* Countdown Display */}
            <div className="mt-4 flex items-center gap-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 px-4 py-3 border border-amber-200/60 dark:border-amber-900/50">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
              <div className="flex items-baseline gap-2">
                <span className="text-xs uppercase font-semibold tracking-wider text-amber-800 dark:text-amber-300">
                  Time Remaining:
                </span>
                <span
                  id="admin-inactivity-countdown"
                  className="font-mono text-xl font-extrabold text-amber-700 dark:text-amber-400 tabular-nums"
                >
                  {formatTimeRemaining(secondsRemaining)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button
            type="button"
            id="admin-logout-now-btn"
            onClick={onLogoutNow}
            disabled={isContinuing}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <LogOut className="h-4 w-4" />
            Log Out Now
          </button>

          <button
            type="button"
            id="admin-continue-session-btn"
            onClick={onContinueSession}
            disabled={isContinuing}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 disabled:opacity-50"
          >
            {isContinuing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Verifying Session...
              </>
            ) : (
              "Continue Session"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminInactivityWarningModal;
