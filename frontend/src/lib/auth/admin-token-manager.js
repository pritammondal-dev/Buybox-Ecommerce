/**
 * Dedicated In-Memory Token Manager for Administrator Sessions
 *
 * Keeps the privileged staff short-lived access token in-memory only.
 * The long-lived refresh token is managed via httpOnly cookies
 * scoped to `/api/v1/administrator/auth`.
 */

let adminAccessToken = null;
const listeners = new Set();

export const adminTokenManager = {
  getAccessToken() {
    return adminAccessToken;
  },

  setAccessToken(token) {
    adminAccessToken = token || null;
    listeners.forEach((listener) => {
      try {
        listener(adminAccessToken);
      } catch (err) {
        console.error("Error in admin token change listener:", err);
      }
    });
  },

  clearAccessToken() {
    this.setAccessToken(null);
  },

  hasAccessToken() {
    return Boolean(adminAccessToken);
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export default adminTokenManager;
