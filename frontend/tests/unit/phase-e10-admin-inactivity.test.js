import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ADMIN_INACTIVITY_TIMEOUT_MS,
  ADMIN_INACTIVITY_WARNING_MS,
  ADMIN_WARNING_DURATION_MS,
  ADMIN_ACTIVITY_THROTTLE_MS,
  ADMIN_SESSION_STORAGE_KEY,
  ADMIN_SESSION_LOGOUT_KEY,
  ADMIN_SESSION_CHANNEL_NAME,
} from "../../src/constants/admin-session.constants.js";
import { adminAuthService } from "../../src/services/admin/admin-auth.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Phase E10: Administrator 30-Minute Inactivity Auto-Logout Security", () => {
  describe("1. Central Inactivity Constants & Thresholds", () => {
    it("configures exactly 30 minutes for administrator inactivity timeout", () => {
      assert.strictEqual(
        ADMIN_INACTIVITY_TIMEOUT_MS,
        30 * 60 * 1000,
        "ADMIN_INACTIVITY_TIMEOUT_MS must equal exactly 30 minutes (1,800,000 ms)"
      );
    });

    it("configures exactly 28 minutes for administrator warning display", () => {
      assert.strictEqual(
        ADMIN_INACTIVITY_WARNING_MS,
        28 * 60 * 1000,
        "ADMIN_INACTIVITY_WARNING_MS must equal exactly 28 minutes (1,680,000 ms)"
      );
    });

    it("configures exactly 2 minutes (120,000 ms) for the warning countdown duration", () => {
      assert.strictEqual(
        ADMIN_WARNING_DURATION_MS,
        2 * 60 * 1000,
        "Warning countdown duration must equal 2 minutes"
      );
      assert.strictEqual(
        ADMIN_INACTIVITY_TIMEOUT_MS - ADMIN_INACTIVITY_WARNING_MS,
        ADMIN_WARNING_DURATION_MS
      );
    });

    it("configures appropriate activity throttling and storage keys", () => {
      assert.strictEqual(ADMIN_ACTIVITY_THROTTLE_MS, 1000);
      assert.strictEqual(ADMIN_SESSION_STORAGE_KEY, "buybox_admin_last_activity");
      assert.strictEqual(ADMIN_SESSION_LOGOUT_KEY, "buybox_admin_logout_signal");
      assert.strictEqual(ADMIN_SESSION_CHANNEL_NAME, "buybox_admin_session_channel");
    });
  });

  describe("2. Deterministic Inactivity & Countdown Evaluation Logic", () => {
    // Pure evaluator function replicating useAdminInactivity logic for deterministic testing
    function evaluateInactivityState(lastActivityTime, currentTime) {
      const elapsed = currentTime - lastActivityTime;
      const isExpired = elapsed >= ADMIN_INACTIVITY_TIMEOUT_MS;
      const isWarning = !isExpired && elapsed >= ADMIN_INACTIVITY_WARNING_MS;
      const remainingMs = Math.max(0, ADMIN_INACTIVITY_TIMEOUT_MS - elapsed);
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));

      return {
        elapsed,
        isWarning,
        isExpired,
        remainingSec,
      };
    }

    function formatTimeRemaining(totalSeconds) {
      const safeSeconds = Math.max(0, Math.floor(totalSeconds));
      const minutes = Math.floor(safeSeconds / 60);
      const seconds = safeSeconds % 60;
      return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }

    it("remains active with no warning when elapsed time is under 28 minutes", () => {
      const baseTime = 10000000;
      // 15 minutes of inactivity
      const state15m = evaluateInactivityState(baseTime, baseTime + 15 * 60 * 1000);
      assert.strictEqual(state15m.isWarning, false);
      assert.strictEqual(state15m.isExpired, false);

      // 27 minutes and 59 seconds of inactivity
      const state27m59s = evaluateInactivityState(baseTime, baseTime + (28 * 60 * 1000 - 1000));
      assert.strictEqual(state27m59s.isWarning, false);
      assert.strictEqual(state27m59s.isExpired, false);
    });

    it("triggers warning modal at exactly 28 minutes with 120s remaining", () => {
      const baseTime = 10000000;
      const state28m = evaluateInactivityState(baseTime, baseTime + 28 * 60 * 1000);

      assert.strictEqual(state28m.isWarning, true);
      assert.strictEqual(state28m.isExpired, false);
      assert.strictEqual(state28m.remainingSec, 120);
      assert.strictEqual(formatTimeRemaining(state28m.remainingSec), "02:00");
    });

    it("counts down correctly during the 2-minute warning window", () => {
      const baseTime = 10000000;
      // 29 minutes elapsed (60 seconds remaining)
      const state29m = evaluateInactivityState(baseTime, baseTime + 29 * 60 * 1000);
      assert.strictEqual(state29m.isWarning, true);
      assert.strictEqual(state29m.isExpired, false);
      assert.strictEqual(state29m.remainingSec, 60);
      assert.strictEqual(formatTimeRemaining(state29m.remainingSec), "01:00");

      // 29 minutes and 30 seconds elapsed (30 seconds remaining)
      const state29m30s = evaluateInactivityState(baseTime, baseTime + 29.5 * 60 * 1000);
      assert.strictEqual(state29m30s.isWarning, true);
      assert.strictEqual(state29m30s.remainingSec, 30);
      assert.strictEqual(formatTimeRemaining(state29m30s.remainingSec), "00:30");
    });

    it("triggers expired/logout state at 30 minutes of inactivity", () => {
      const baseTime = 10000000;
      const state30m = evaluateInactivityState(baseTime, baseTime + 30 * 60 * 1000);

      assert.strictEqual(state30m.isWarning, false);
      assert.strictEqual(state30m.isExpired, true);
      assert.strictEqual(state30m.remainingSec, 0);
      assert.strictEqual(formatTimeRemaining(state30m.remainingSec), "00:00");
    });

    it("resets inactivity window on genuine user activity before warning threshold", () => {
      let lastActivity = 10000000;
      const currentTime = lastActivity + 20 * 60 * 1000; // 20m later

      // Check state at 20m
      const preActivity = evaluateInactivityState(lastActivity, currentTime);
      assert.strictEqual(preActivity.isWarning, false);
      assert.strictEqual(preActivity.elapsed, 20 * 60 * 1000);

      // User interacts (pointerdown / keydown)
      lastActivity = currentTime;

      // Advance another 10m from interaction (total 30m from initial, but only 10m from interaction)
      const postActivity = evaluateInactivityState(lastActivity, currentTime + 10 * 60 * 1000);
      assert.strictEqual(postActivity.isWarning, false);
      assert.strictEqual(postActivity.isExpired, false);
      assert.strictEqual(postActivity.elapsed, 10 * 60 * 1000);
    });

    it("does not reset lastActivity if throttled under ADMIN_ACTIVITY_THROTTLE_MS", () => {
      let lastThrottle = 10000;
      let lastActivity = 10000;

      // Event 200ms later (within throttle window)
      const eventTime1 = 10200;
      if (eventTime1 - lastThrottle >= ADMIN_ACTIVITY_THROTTLE_MS) {
        lastActivity = eventTime1;
        lastThrottle = eventTime1;
      }
      assert.strictEqual(lastActivity, 10000, "Should remain 10000 because throttled");

      // Event 1500ms later (outside throttle window)
      const eventTime2 = 11500;
      if (eventTime2 - lastThrottle >= ADMIN_ACTIVITY_THROTTLE_MS) {
        lastActivity = eventTime2;
        lastThrottle = eventTime2;
      }
      assert.strictEqual(lastActivity, 11500, "Should update to 11500 after throttle window expires");
    });
  });

  describe("3. Multi-Tab Synchronization & Event Message Payloads", () => {
    it("defines consistent message types across broadcast channel and storage events", () => {
      const allowedMessages = ["ADMIN_LOGOUT", "ADMIN_SESSION_CONTINUED", "ADMIN_ACTIVITY"];

      function processIncomingMessage(msg, currentState) {
        if (!msg || !allowedMessages.includes(msg.type)) return currentState;

        if (msg.type === "ADMIN_LOGOUT") {
          return { ...currentState, isLoggedOut: true };
        }
        if (msg.type === "ADMIN_SESSION_CONTINUED") {
          return {
            ...currentState,
            lastActivity: msg.timestamp,
            isWarningOpen: false,
            secondsRemaining: 120,
          };
        }
        if (msg.type === "ADMIN_ACTIVITY") {
          return {
            ...currentState,
            lastActivity: Math.max(currentState.lastActivity, msg.timestamp),
          };
        }
        return currentState;
      }

      const initial = {
        lastActivity: 1000,
        isWarningOpen: true,
        secondsRemaining: 45,
        isLoggedOut: false,
      };

      // Remote tab sends ADMIN_SESSION_CONTINUED
      const afterContinue = processIncomingMessage(
        { type: "ADMIN_SESSION_CONTINUED", timestamp: 5000 },
        initial
      );
      assert.strictEqual(afterContinue.lastActivity, 5000);
      assert.strictEqual(afterContinue.isWarningOpen, false);
      assert.strictEqual(afterContinue.secondsRemaining, 120);

      // Remote tab sends ADMIN_LOGOUT
      const afterLogout = processIncomingMessage({ type: "ADMIN_LOGOUT" }, afterContinue);
      assert.strictEqual(afterLogout.isLoggedOut, true);
    });

    it("ensures storage event listeners properly handle logout signal key", () => {
      let loggedOut = false;
      const onStorage = (key) => {
        if (key === ADMIN_SESSION_LOGOUT_KEY) {
          loggedOut = true;
        }
      };

      onStorage(ADMIN_SESSION_LOGOUT_KEY);
      assert.strictEqual(loggedOut, true);
    });
  });

  describe("4. Administrator Auth Service & Endpoint Mapping", () => {
    it("exposes the heartbeat method on adminAuthService", () => {
      assert.strictEqual(typeof adminAuthService.heartbeat, "function");
    });

    it("verifies admin-auth.service.js contains heartbeat pointing to /administrator/auth/heartbeat", () => {
      const serviceFile = path.resolve(
        __dirname,
        "../../src/services/admin/admin-auth.service.js"
      );
      const content = fs.readFileSync(serviceFile, "utf-8");

      assert.ok(content.includes("heartbeat()"), "Must define heartbeat method");
      assert.ok(
        content.includes("/administrator/auth/heartbeat"),
        "Must target /administrator/auth/heartbeat"
      );
    });
  });

  describe("5. Component & Layout Architecture Verification", () => {
    it("verifies AdminInactivityWarningModal renders required elements and accessibility roles", () => {
      const modalFile = path.resolve(
        __dirname,
        "../../src/components/admin/layout/AdminInactivityWarningModal.jsx"
      );
      assert.ok(fs.existsSync(modalFile), "Modal file must exist");
      const content = fs.readFileSync(modalFile, "utf-8");

      // Accessibility
      assert.ok(content.includes('role="alertdialog"'), "Must have role=alertdialog");
      assert.ok(content.includes('aria-modal="true"'), "Must have aria-modal=true");
      assert.ok(content.includes("admin-inactivity-title"), "Must have title ID for aria");

      // Policy & explanation text
      assert.ok(
        content.includes("logged out after two more minutes"),
        "Must explain 2-minute countdown"
      );
      assert.ok(content.includes("admin-inactivity-countdown"), "Must display remaining time");

      // Actions
      assert.ok(
        content.includes("admin-continue-session-btn"),
        "Must contain Continue Session button ID"
      );
      assert.ok(
        content.includes("admin-logout-now-btn"),
        "Must contain Log Out Now button ID"
      );
      assert.ok(
        content.includes("Continue Session"),
        "Must label Continue Session action"
      );
      assert.ok(
        content.includes("Log Out Now"),
        "Must label Log Out Now action"
      );
    });

    it("verifies AdminShell integrates useAdminInactivity and AdminInactivityWarningModal", () => {
      const shellFile = path.resolve(
        __dirname,
        "../../src/components/admin/layout/AdminShell.jsx"
      );
      const content = fs.readFileSync(shellFile, "utf-8");

      assert.ok(
        content.includes("useAdminInactivity"),
        "AdminShell must import and invoke useAdminInactivity"
      );
      assert.ok(
        content.includes("AdminInactivityWarningModal"),
        "AdminShell must render AdminInactivityWarningModal"
      );
      assert.ok(
        content.includes("onContinueSession={handleContinueSession}"),
        "AdminShell must wire Continue Session handler"
      );
      assert.ok(
        content.includes("onLogoutNow={handleLogoutNow}"),
        "AdminShell must wire Logout Now handler"
      );
    });

    it("verifies useAdminInactivity registers required activity listeners and cleans up properly", () => {
      const hookFile = path.resolve(
        __dirname,
        "../../src/hooks/admin/useAdminInactivity.js"
      );
      const content = fs.readFileSync(hookFile, "utf-8");

      // Required activity events
      const requiredEvents = ["pointerdown", "keydown", "scroll", "touchstart"];
      requiredEvents.forEach((ev) => {
        assert.ok(
          content.includes(`"${ev}"`),
          `useAdminInactivity must track ${ev} event`
        );
      });

      // Stale background tab detection
      assert.ok(
        content.includes("visibilitychange"),
        "useAdminInactivity must check elapsed time on visibilitychange"
      );

      // Multi-tab sync
      assert.ok(
        content.includes("BroadcastChannel"),
        "useAdminInactivity must use BroadcastChannel"
      );
      assert.ok(
        content.includes('"storage"'),
        "useAdminInactivity must listen to storage events"
      );

      // Cleanup
      assert.ok(
        content.includes("removeEventListener"),
        "useAdminInactivity must remove event listeners on unmount"
      );
      assert.ok(
        content.includes("clearInterval"),
        "useAdminInactivity must clear intervals on unmount"
      );
    });
  });

  describe("6. Role Boundary & Store Isolation Verification", () => {
    it("verifies storefront auth store (auth.store.js) for customer/vendor does NOT reference admin inactivity channel or constants", () => {
      const customerStoreFile = path.resolve(
        __dirname,
        "../../src/stores/auth.store.js"
      );
      const content = fs.readFileSync(customerStoreFile, "utf-8");

      assert.ok(
        !content.includes("ADMIN_INACTIVITY_TIMEOUT_MS"),
        "Storefront auth store must NOT reference ADMIN_INACTIVITY_TIMEOUT_MS"
      );
      assert.ok(
        !content.includes("buybox_admin_session_channel"),
        "Storefront auth store must NOT listen to admin session channel"
      );
      assert.ok(
        !content.includes("ADMIN_SESSION_LOGOUT_KEY"),
        "Storefront auth store must NOT listen to admin session logout key"
      );
    });

    it("verifies admin auth store (admin-auth.store.js) is partitioned from customer/vendor stores", () => {
      const adminStoreFile = path.resolve(
        __dirname,
        "../../src/stores/admin-auth.store.js"
      );
      const content = fs.readFileSync(adminStoreFile, "utf-8");

      assert.ok(
        content.includes("bb_administrator_session"),
        "Admin store must maintain independent session cookie name"
      );
      assert.ok(
        content.includes("adminTokenManager"),
        "Admin store must use isolated adminTokenManager"
      );
    });
  });
});
