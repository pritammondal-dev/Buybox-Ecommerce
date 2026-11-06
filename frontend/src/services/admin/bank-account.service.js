import apiClient from "../../lib/api/admin-axios.js";

const unwrapData = (response) => {
  if (!response) return {};
  let payload = response.data !== undefined ? response.data : response;
  if (payload?.data !== undefined) {
    payload = payload.data;
  }
  return payload || {};
};

/**
 * Defensive normalizer to safely extract string reason whether passed as a
 * raw string or an object { reason: string } from confirmation modals.
 */
const normalizeReason = (reason) => {
  if (typeof reason === "object" && reason !== null) {
    return typeof reason.reason === "string" ? reason.reason.trim() : "";
  }
  if (typeof reason === "string") {
    return reason.trim();
  }
  return "";
};

/**
 * Superadmin & Compliance Reviewer Service for Vendor Bank Accounts
 */
export const adminBankAccountService = {
  /**
   * List bank account applications across all vendors in reviewer queue
   */
  async listApplications(params = {}) {
    const response = await apiClient.get("/admin/vendors/bank-accounts/applications", { params });
    return unwrapData(response);
  },

  /**
   * Approve a bank account application
   */
  async approveApplication(accountId, reason = null) {
    const reasonStr = normalizeReason(reason);
    const payload = reasonStr ? { reason: reasonStr } : {};
    const response = await apiClient.post(
      `/admin/vendors/bank-accounts/${encodeURIComponent(accountId)}/approve`,
      payload
    );
    return unwrapData(response);
  },

  /**
   * Reject a bank account application with mandatory justification
   */
  async rejectApplication(accountId, reason) {
    const reasonStr = normalizeReason(reason);
    const response = await apiClient.post(
      `/admin/vendors/bank-accounts/${encodeURIComponent(accountId)}/reject`,
      { reason: reasonStr }
    );
    return unwrapData(response);
  },

  /**
   * Mark application as under review
   */
  async markUnderReview(accountId, reason = null) {
    const reasonStr = normalizeReason(reason);
    const payload = reasonStr ? { reason: reasonStr } : {};
    const response = await apiClient.post(
      `/admin/vendors/bank-accounts/${encodeURIComponent(accountId)}/under-review`,
      payload
    );
    return unwrapData(response);
  },

  /**
   * Privileged account unmasking with mandatory reason & audit logging
   */
  async unmaskAccountNumber(accountId, reason, vendorId = null) {
    const reasonStr = normalizeReason(reason);
    const url = vendorId
      ? `/admin/vendors/${encodeURIComponent(vendorId)}/bank-accounts/${encodeURIComponent(accountId)}/unmask`
      : `/admin/vendors/bank-accounts/${encodeURIComponent(accountId)}/unmask`;
    const response = await apiClient.post(url, { reason: reasonStr });
    return unwrapData(response);
  },

  /**
   * List all bank accounts registered for a specific vendor
   */
  async getVendorBankAccounts(vendorId) {
    const response = await apiClient.get(
      `/admin/vendors/${encodeURIComponent(vendorId)}/bank-accounts`
    );
    return unwrapData(response);
  },

  /**
   * Fetch single bank account details
   */
  async getVendorBankAccountById(vendorId, accountId) {
    const response = await apiClient.get(
      `/admin/vendors/${encodeURIComponent(vendorId)}/bank-accounts/${encodeURIComponent(accountId)}`
    );
    return unwrapData(response);
  },

  /**
   * Superadmin add bank account for a vendor
   */
  async addVendorBankAccount(vendorId, data) {
    const response = await apiClient.post(
      `/admin/vendors/${encodeURIComponent(vendorId)}/bank-accounts`,
      data
    );
    return unwrapData(response);
  },

  /**
   * Superadmin edit bank account details for a vendor
   */
  async updateVendorBankAccount(vendorId, accountId, data) {
    const response = await apiClient.patch(
      `/admin/vendors/${encodeURIComponent(vendorId)}/bank-accounts/${encodeURIComponent(accountId)}`,
      data
    );
    return unwrapData(response);
  },

  /**
   * Superadmin activate/deactivate payout status
   */
  async setStatusVendorBankAccount(vendorId, accountId, isActive, reason) {
    const reasonStr = normalizeReason(reason);
    const response = await apiClient.patch(
      `/admin/vendors/${encodeURIComponent(vendorId)}/bank-accounts/${encodeURIComponent(accountId)}/status`,
      { isActive, reason: reasonStr }
    );
    return unwrapData(response);
  },

  /**
   * Superadmin soft-delete an eligible bank account
   */
  async deleteVendorBankAccount(vendorId, accountId, reason) {
    const reasonStr = normalizeReason(reason);
    const response = await apiClient.delete(
      `/admin/vendors/${encodeURIComponent(vendorId)}/bank-accounts/${encodeURIComponent(accountId)}`,
      { data: { reason: reasonStr } }
    );
    return unwrapData(response);
  },
};

export default adminBankAccountService;
