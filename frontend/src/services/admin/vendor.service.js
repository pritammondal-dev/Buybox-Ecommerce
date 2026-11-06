import apiClient from "../../lib/api/admin-axios.js";

/**
 * Safely unwrap vendor entity from response data structures
 */
const unwrapVendor = (response) => {
  if (!response) return null;
  let payload = response.data !== undefined ? response.data : response;
  if (payload?.data !== undefined) {
    payload = payload.data;
  }
  if (payload?.vendor !== undefined) {
    return payload.vendor;
  }
  return payload;
};

const unwrapData = (response) => {
  if (!response) return {};
  let payload = response.data !== undefined ? response.data : response;
  if (payload?.data !== undefined) {
    payload = payload.data;
  }
  return payload || {};
};

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
    return unwrapData(response);
  },

  /**
   * Fetch vendor application details by secure ID
   */
  async getVendorById(id) {
    const response = await apiClient.get(`/admin/vendors/${encodeURIComponent(id)}`);
    return unwrapVendor(response);
  },

  /**
   * Approve a merchant application
   */
  async approveVendor(id) {
    const response = await apiClient.post(`/admin/vendors/${encodeURIComponent(id)}/approve`);
    return unwrapVendor(response);
  },

  /**
   * Reject a merchant application with a mandatory reason
   */
  async rejectVendor(id, reason) {
    const response = await apiClient.post(`/admin/vendors/${encodeURIComponent(id)}/reject`, { reason });
    return unwrapVendor(response);
  },

  /**
   * Request changes with mandatory feedback instructions
   */
  async requestChanges(id, reason) {
    const response = await apiClient.post(`/admin/vendors/${encodeURIComponent(id)}/request-changes`, { reason });
    return unwrapVendor(response);
  },

  /**
   * Update vendor status (administrative override)
   */
  async updateStatus(id, onboardingStatus, extraData = {}) {
    const response = await apiClient.patch(`/admin/vendors/${encodeURIComponent(id)}/status`, {
      onboardingStatus,
      ...extraData,
    });
    return unwrapVendor(response);
  },

  /**
   * Fetch approved vendor overview with all 12 operational KPIs
   */
  async getVendorOverview(id) {
    const response = await apiClient.get(`/admin/vendors/${encodeURIComponent(id)}/overview`);
    return unwrapData(response);
  },

  /**
   * Superadmin edit vendor profile & operational settings
   */
  async updateVendor(id, payload) {
    const response = await apiClient.patch(`/admin/vendors/${encodeURIComponent(id)}`, payload);
    return unwrapVendor(response);
  },

  /**
   * Superadmin reset vendor password securely with mandatory reason
   */
  async resetVendorPassword(id, newPassword, reason) {
    const response = await apiClient.post(
      `/admin/vendors/${encodeURIComponent(id)}/reset-password`,
      { newPassword, reason }
    );
    return unwrapData(response);
  },

  /**
   * Suspend vendor account and delist active products with mandatory reason
   */
  async suspendVendor(id, reason) {
    const response = await apiClient.post(
      `/admin/vendors/${encodeURIComponent(id)}/suspend`,
      { reason }
    );
    return unwrapVendor(response);
  },

  /**
   * Reactivate suspended vendor account and restore active catalog visibility
   */
  async reactivateVendor(id, reason) {
    const response = await apiClient.post(
      `/admin/vendors/${encodeURIComponent(id)}/reactivate`,
      { reason }
    );
    return unwrapVendor(response);
  },

  /**
   * Safely soft-deactivate vendor account with mandatory administrative reason
   */
  async deleteVendor(id, reason) {
    const response = await apiClient.delete(
      `/admin/vendors/${encodeURIComponent(id)}`,
      { data: { reason } }
    );
    return unwrapData(response);
  },

  /**
   * Explicitly verify vendor email address (authorized administrative waiver)
   */
  async verifyVendorEmail(id) {
    const response = await apiClient.post(`/admin/vendors/${encodeURIComponent(id)}/verify-email`);
    return unwrapVendor(response);
  },

  /**
   * Canonical Aliases for uniform account lifecycle integration
   */
  async resetPassword(id, newPassword, reason) {
    return this.resetVendorPassword(id, newPassword, reason);
  },

  async delete(id, reason) {
    return this.deleteVendor(id, reason);
  },

  async suspend(id, reason) {
    return this.suspendVendor(id, reason);
  },

  async reactivate(id, reason) {
    return this.reactivateVendor(id, reason);
  },

  /**
   * Bank Account Management
   */
  async getBankAccounts(id) {
    const response = await apiClient.get(`/admin/vendors/${encodeURIComponent(id)}/bank-accounts`);
    return unwrapData(response);
  },

  async addBankAccount(id, data) {
    const response = await apiClient.post(`/admin/vendors/${encodeURIComponent(id)}/bank-accounts`, data);
    return unwrapData(response);
  },

  async updateBankAccount(id, accountId, data) {
    const response = await apiClient.patch(`/admin/vendors/${encodeURIComponent(id)}/bank-accounts/${encodeURIComponent(accountId)}`, data);
    return unwrapData(response);
  },

  async setBankAccountStatus(id, accountId, isActive, reason) {
    const response = await apiClient.patch(`/admin/vendors/${encodeURIComponent(id)}/bank-accounts/${encodeURIComponent(accountId)}/status`, { isActive, reason });
    return unwrapData(response);
  },

  async deleteBankAccount(id, accountId, reason) {
    const response = await apiClient.delete(`/admin/vendors/${encodeURIComponent(id)}/bank-accounts/${encodeURIComponent(accountId)}`, { data: { reason } });
    return unwrapData(response);
  },

  async unmaskBankAccount(id, accountId, reason) {
    const response = await apiClient.post(`/admin/vendors/${encodeURIComponent(id)}/bank-accounts/${encodeURIComponent(accountId)}/unmask`, { reason });
    return unwrapData(response);
  },

  /**
   * KYC Document Management & Review Queue (VD-04)
   */
  async listKycQueue(params = {}) {
    const response = await apiClient.get("/admin/vendors/kyc/queue", { params });
    return unwrapData(response);
  },

  async reviewKycDocument(vendorId, documentId, { status, rejectionReason }) {
    const response = await apiClient.post(
      `/admin/vendors/${encodeURIComponent(vendorId)}/kyc/documents/${encodeURIComponent(documentId)}/review`,
      { status, rejectionReason }
    );
    return unwrapData(response);
  },

  async downloadKycDocument(vendorId, documentId) {
    const response = await apiClient.get(
      `/admin/vendors/${encodeURIComponent(vendorId)}/kyc/documents/${encodeURIComponent(documentId)}/download`,
      { responseType: "blob" }
    );
    return response.data;
  },
};

export default adminVendorService;
