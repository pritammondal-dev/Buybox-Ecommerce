/**
 * Central Administrator Session Inactivity Security Constants
 *
 * Enforces a strict 30-minute inactivity auto-logout policy for all
 * authenticated administrator interfaces (SUPERADMIN, ADMIN, EDITOR).
 */

export const ADMIN_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const ADMIN_INACTIVITY_WARNING_MS = 28 * 60 * 1000; // 28 minutes
export const ADMIN_WARNING_DURATION_MS = ADMIN_INACTIVITY_TIMEOUT_MS - ADMIN_INACTIVITY_WARNING_MS; // 2 minutes (120,000 ms)

export const ADMIN_ACTIVITY_THROTTLE_MS = 1000; // Throttle local activity events to 1s
export const ADMIN_SESSION_STORAGE_KEY = "buybox_admin_last_activity";
export const ADMIN_SESSION_LOGOUT_KEY = "buybox_admin_logout_signal";
export const ADMIN_SESSION_CHANNEL_NAME = "buybox_admin_session_channel";
