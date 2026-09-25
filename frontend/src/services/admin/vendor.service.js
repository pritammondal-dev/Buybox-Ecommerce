import apiClient from "../../lib/api/admin-axios.js";

/**
 * Admin Vendor Management Service
 *
 * Dedicated service for Marketplace Operations to review, approve,
 * reject, request changes, and monitor all merchant partner applications.
 */
export const adminVendorService = {
  /**
   * List vendor applications with pagination, search, and status filters
   */
  async listVendors(params = {}) {
    const response = await apiClient.get("/admin/vendors", { params });
    return response.data?.data || response.data || {};
  },

  /**
   * Fetch vendor application details by secure ID
   */
  async getVendorById(id) {
    const response = await apiClient.get(`/admin/vendors/${encodeURIComponent(id)}`);
    return response.data?.data?.vendor || response.data?.data || response.data;
  },

  /**
   * Approve a merchant application
   */
  async approveVendor(id) {
    const response = await apiClient.post(`/admin/vendors/${encodeURIComponent(id)}/approve`);
    return response.data?.data || response.data;
  },

  /**
   * Reject a merchant application with a mandatory reason
   */
  async rejectVendor(id, reason) {
    const response = await apiClient.post(`/admin/vendors/${encodeURIComponent(id)}/reject`, { reason });
    return response.data?.data || response.data;
  },

  /**
   * Request changes with mandatory feedback instructions
   */
  async requestChanges(id, reason) {
    const response = await apiClient.post(`/admin/vendors/${encodeURIComponent(id)}/request-changes`, { reason });
    return response.data?.data || response.data;
  },

  /**
   * Update vendor status (administrative override)
   */
  async updateStatus(id, onboardingStatus, extraData = {}) {
    const response = await apiClient.patch(`/admin/vendors/${encodeURIComponent(id)}/status`, {
      onboardingStatus,
      ...extraData,
    });
    return response.data?.data || response.data;
  },
};

export default adminVendorService;
