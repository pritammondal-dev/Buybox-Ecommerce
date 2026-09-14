/**
 * In-memory Access Token Manager
 *
 * Implements security best practice by keeping the short-lived access token
 * in memory rather than in localStorage.
 * The long-lived refresh token is managed by the browser via httpOnly cookies
 * scoped to `/api/v1/auth`.
 */

let accessToken = null;
const listeners = new Set();

export const tokenManager = {
  getAccessToken() {
    return accessToken;
  },

  setAccessToken(token) {
    accessToken = token || null;
    listeners.forEach((listener) => {
      try {
        listener(accessToken);
      } catch (err) {
        console.error("Error in token change listener:", err);
      }
    });
  },

  clearAccessToken() {
    this.setAccessToken(null);
  },

  hasAccessToken() {
    return Boolean(accessToken);
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export default tokenManager;
