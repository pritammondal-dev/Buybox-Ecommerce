import apiClient from "../../lib/api/admin-axios.js";

/**
 * Safely unwrap customer entity from response data structures
 */
const unwrapData = (response) => {
  if (!response) return {};
  let payload = response.data !== undefined ? response.data : response;
  if (payload?.data !== undefined) {
    payload = payload.data;
  }
  return payload || {};
};

const unwrapCustomer = (response) => {
  if (!response) return null;
  let payload = response.data !== undefined ? response.data : response;
  if (payload?.data !== undefined) {
    payload = payload.data;
  }
  if (payload?.customer !== undefined) {
    return payload.customer;
  }
  return payload;
};

/**
 * Superadmin Customer Management Service
 *
 * Dedicated service for administrative customer lifecycle management:
 * inspection, allowlisted profile edits, suspension, reactivation,
 * secure password resets, and soft-deactivation.
 */
export const adminCustomerService = {
  /**
   * List registered customers with pagination, search, and status filtering
   */
  async list(params = {}) {
    const res = await apiClient.get("/admin/customers", { params });
    return unwrapData(res);
  },

  /**
   * Fetch customer profile, KPIs, order history, addresses, and redemptions
   */
  async get(id) {
    const res = await apiClient.get(`/admin/customers/${encodeURIComponent(id)}`);
    return unwrapData(res);
  },

  /**
   * Update permitted customer profile information with mandatory reason
   */
  async update(id, payload) {
    const res = await apiClient.patch(`/admin/customers/${encodeURIComponent(id)}`, payload);
    return unwrapCustomer(res);
  },

  /**
   * Legacy status toggle with mandatory administrative reason
   */
  async updateStatus(id, isActive, reason) {
    const res = await apiClient.patch(`/admin/customers/${encodeURIComponent(id)}/status`, {
      isActive,
      reason,
    });
    return unwrapData(res);
  },

  /**
   * Suspend customer account and invalidate active sessions
   */
  async suspend(id, reason) {
    const res = await apiClient.post(`/admin/customers/${encodeURIComponent(id)}/suspend`, {
      reason,
    });
    return unwrapData(res);
  },

  /**
   * Reactivate customer account and restore shopping access
   */
  async reactivate(id, reason) {
    const res = await apiClient.post(`/admin/customers/${encodeURIComponent(id)}/reactivate`, {
      reason,
    });
    return unwrapData(res);
  },

  /**
   * Reset customer password securely with mandatory administrative reason
   */
  async resetPassword(id, newPassword, reason) {
    const res = await apiClient.post(
      `/admin/customers/${encodeURIComponent(id)}/reset-password`,
      { newPassword, reason }
    );
    return unwrapData(res);
  },

  /**
   * Permanently delete customer account and session records while preserving historical orders and transactions
   */
  async delete(id, reason) {
    const res = await apiClient.delete(`/admin/customers/${encodeURIComponent(id)}`, {
      data: { reason },
    });
    return unwrapData(res);
  },

  /**
   * Delete alias
   */
  async deactivate(id, reason) {
    return this.delete(id, reason);
  },

  /**
   * Issue promotional or service recovery gift card
   */
  async issueGiftCard(id, payload) {
    const res = await apiClient.post(
      `/admin/customers/${encodeURIComponent(id)}/gift-card`,
      payload
    );
    return unwrapData(res);
  },
};

export default adminCustomerService;
