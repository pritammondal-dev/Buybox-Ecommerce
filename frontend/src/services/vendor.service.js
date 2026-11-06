import apiClient from "../lib/api/axios.js";

// Explicit vendor context API client wrapper ensuring all requests declare vendor context
const vendorApiClient = {
  get: (url, config = {}) => apiClient.get(url, { authContext: "vendor", ...config }),
  post: (url, data, config = {}) => apiClient.post(url, data, { authContext: "vendor", ...config }),
  patch: (url, data, config = {}) => apiClient.patch(url, data, { authContext: "vendor", ...config }),
  put: (url, data, config = {}) => apiClient.put(url, data, { authContext: "vendor", ...config }),
  delete: (url, config = {}) => apiClient.delete(url, { authContext: "vendor", ...config }),
};

/**
 * Comprehensive Vendor Service for Buybox Merchant Console
 *
 * Interacts with production backend APIs for merchant operations:
 * - Vendor identity, profile, and settings
 * - Real-time dashboard KPIs and sales trends
 * - Catalog products and variant lifecycle
 * - Warehouse-level stock and inventory allocations
 * - Scoped orders and fulfillment actions
 * - Courier shipments and delivery tracking
 * - Customer returns and RMA inspections
 * - Settlements and payout history
 * - Product reviews and customer Q&A
 * - Operational notifications and support tickets
 */
export const vendorService = {
  async login({ email, password }) {
    return vendorApiClient.post("/vendor/auth/login", { email, password });
  },

  async refresh() {
    return vendorApiClient.post("/vendor/auth/refresh");
  },

  async logout() {
    return vendorApiClient.post("/vendor/auth/logout");
  },

  async registerVendor(data) {
    return vendorApiClient.post("/vendors/register", data);
  },

  async getMyProfile() {
    return vendorApiClient.get("/vendors/me");
  },

  async createMyProfile(data) {
    return vendorApiClient.post("/vendors/me", data);
  },

  async updateMyProfile(data) {
    return vendorApiClient.patch("/vendors/me", data);
  },

  async resubmitApplication() {
    return vendorApiClient.post("/vendors/me/resubmit");
  },

  // 2. Real Dashboard Analytics & Activity
  async getDashboardAnalytics(params = {}) {
    return vendorApiClient.get("/vendors/me/dashboard", { params });
  },

  async getActivityLogs() {
    return vendorApiClient.get("/vendors/me/activity");
  },

  // 3. Catalog Products & Variants
  async getMyProducts(params = {}) {
    return vendorApiClient.get("/products/vendor/my", { params });
  },

  async getProductById(id) {
    return vendorApiClient.get(`/products/${id}`);
  },

  async createProduct(data) {
    return vendorApiClient.post("/products", data);
  },

  async updateProduct(id, data) {
    return vendorApiClient.patch(`/products/${id}`, data);
  },

  async deleteProduct(id) {
    return vendorApiClient.delete(`/products/${id}`);
  },

  async submitProductForApproval(id) {
    return vendorApiClient.post(`/products/${id}/submit`);
  },

  async getProductVariants(productId) {
    return vendorApiClient.get(`/product-variants/product/${productId}`);
  },

  async createProductVariant(productId, data) {
    return vendorApiClient.post(`/product-variants/product/${productId}`, data);
  },

  async updateProductVariant(id, data) {
    return vendorApiClient.patch(`/product-variants/${id}`, data);
  },

  async deleteProductVariant(id) {
    return vendorApiClient.delete(`/product-variants/${id}`);
  },

  async createBulkProductVariants(productId, data) {
    return vendorApiClient.post(`/product-variants/product/${productId}/bulk`, data);
  },

  async updateBulkProductVariants(productId, data) {
    return vendorApiClient.patch(`/product-variants/product/${productId}/bulk`, data);
  },

  async getVariantAvailability(variantId) {
    return vendorApiClient.get(`/products/variants/${variantId}/availability`);
  },

  async uploadDigitalAsset(file, metadata = {}) {
    const formData = new FormData();
    formData.append("file", file);
    if (metadata.version) {
      formData.append("version", metadata.version);
    }
    return vendorApiClient.post("/products/digital-assets/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  async uploadProductImage(formData) {
    return vendorApiClient.post("/products/images/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  // Bulk Product Import & Export
  async downloadImportTemplate(format = "csv") {
    return vendorApiClient.get(`/products/vendor/import/template?format=${format}`, {
      responseType: "blob",
    });
  },

  async validateBulkImport(formData) {
    return vendorApiClient.post("/products/vendor/import/validate", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  async commitBulkImport(rows, stagingId = null) {
    const payload = Array.isArray(rows)
      ? stagingId
        ? { rows, stagingId }
        : { rows }
      : rows;
    return vendorApiClient.post("/products/vendor/import/commit", payload);
  },

  async exportProducts(params = {}) {
    return vendorApiClient.get("/products/vendor/export", {
      params,
      responseType: "blob",
    });
  },

  // 4. Inventory & Warehouse Management
  async getMyInventory(params = {}) {
    return vendorApiClient.get("/inventory/vendor/my", { params });
  },

  async adjustInventory(id, { quantity, notes = null }) {
    return vendorApiClient.patch(`/inventory/${id}/adjust`, { quantity, notes });
  },

  async getMyWarehouses() {
    return vendorApiClient.get("/warehouses/vendor/my");
  },

  async getMyWarehouseById(id) {
    return vendorApiClient.get(`/warehouses/vendor/my/${id}`);
  },

  // 5. Orders & Fulfillment
  async getMyOrders(params = {}) {
    return vendorApiClient.get("/vendors/me/orders", { params });
  },

  async getMyOrderById(id) {
    return vendorApiClient.get(`/vendors/me/orders/${id}`);
  },

  // Phase VD-05: Unified Order Management & Fulfillment
  async getShipmentPartners() {
    const res = await vendorApiClient.get("/vendors/me/orders/shipment-partners");
    return res?.data?.data || res?.data || res;
  },

  async acceptOrder(orderId, data = {}) {
    const res = await vendorApiClient.post(`/vendors/me/orders/${orderId}/accept`, data);
    return res?.data?.data || res?.data || res;
  },

  async rejectOrder(orderId, data = {}) {
    const res = await vendorApiClient.post(`/vendors/me/orders/${orderId}/reject`, data);
    return res?.data?.data || res?.data || res;
  },

  async updateFulfillmentDetails(orderId, data = {}) {
    const res = await vendorApiClient.patch(`/vendors/me/orders/${orderId}/fulfillment-details`, data);
    return res?.data?.data || res?.data || res;
  },

  async confirmFulfillment(orderId, data = {}) {
    const res = await vendorApiClient.post(`/vendors/me/orders/${orderId}/confirm-fulfillment`, data);
    return res?.data?.data || res?.data || res;
  },

  async processOrder(orderId, notes = null) {
    return vendorApiClient.post(`/vendors/me/orders/${orderId}/process`, { notes });
  },

  async markOrderReadyToShip(orderId, notes = null) {
    return vendorApiClient.post(`/vendors/me/orders/${orderId}/ready-to-ship`, { notes });
  },

  async createOrderShipment(orderId, data, idempotencyKey = null) {
    const key = idempotencyKey || data?.idempotencyKey || `idemp-shp-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    const payload = { ...data, idempotencyKey: key };
    return vendorApiClient.post(`/vendors/me/orders/${orderId}/shipments`, payload, {
      headers: {
        "Idempotency-Key": key,
      },
    });
  },

  async retryShipmentBooking(shipmentId) {
    return vendorApiClient.post(`/shipments/vendor/my/${shipmentId}/book`);
  },

  async getOrderPackingSlip(orderId, params = {}) {
    const res = await vendorApiClient.get(`/vendors/me/orders/${orderId}/packing-slip`, { params });
    return res?.data?.data || res?.data || res;
  },

  async exportMyOrders(params = {}, format = "csv") {
    return vendorApiClient.get("/orders/vendor/export", {
      params: { ...params, format },
      responseType: "blob",
    });
  },

  async exportMyOrderItems(params = {}, format = "csv") {
    return vendorApiClient.get("/orders/vendor/export/items", {
      params: { ...params, format },
      responseType: "blob",
    });
  },

  // 6. Shipments & Courier Tracking
  async getMyShipments(params = {}) {
    return vendorApiClient.get("/shipments/vendor/my", { params });
  },

  async getMyShipmentById(id) {
    return vendorApiClient.get(`/shipments/vendor/my/${id}`);
  },

  async getShipmentPackingSlip(id) {
    const res = await vendorApiClient.get(`/shipments/vendor/${id}/packing-slip`);
    return res?.data?.data || res?.data || res;
  },

  async exportMyShipments(params = {}, format = "csv") {
    return vendorApiClient.get("/shipments/vendor/export", {
      params: { ...params, format },
      responseType: "blob",
    });
  },

  async createShipment(data) {
    return vendorApiClient.post("/shipments/vendor", data);
  },

  async updateShipmentStatus(id, data) {
    return vendorApiClient.patch(`/shipments/vendor/${id}/status`, data);
  },

  async scheduleShipmentPickup(id, data = {}) {
    return vendorApiClient.post(`/shipments/vendor/${id}/pickup`, data);
  },

  async getShipmentLabel(id) {
    return vendorApiClient.get(`/shipments/vendor/${id}/label`);
  },

  async cancelShipment(id, data = {}) {
    return vendorApiClient.post(`/shipments/vendor/${id}/cancel`, data);
  },

  async checkServiceability(params = {}) {
    return vendorApiClient.get("/shipments/serviceability", { params });
  },

  // 7. Returns & RMA
  async getMyReturns(params = {}) {
    return vendorApiClient.get("/vendors/me/returns", { params });
  },

  async getMyReturnById(id) {
    return vendorApiClient.get(`/vendors/me/returns/${id}`);
  },

  async approveReturn(returnId, notes = null) {
    return vendorApiClient.post(`/vendors/me/returns/${returnId}/approve`, { notes });
  },

  async rejectReturn(returnId, reason) {
    return vendorApiClient.post(`/vendors/me/returns/${returnId}/reject`, { reason });
  },

  async receiveReturnAndRestock(returnId, data = {}) {
    return vendorApiClient.post(`/vendors/me/returns/${returnId}/receive`, data);
  },

  async refundReturn(returnId, notes = null) {
    return vendorApiClient.post(`/vendors/me/returns/${returnId}/refund`, { notes });
  },

  async inspectReturn(returnId, data = {}) {
    return vendorApiClient.post(`/vendors/me/returns/${returnId}/inspect`, data);
  },

  async scheduleReturnPickup(returnId, data = {}) {
    return vendorApiClient.post(`/vendors/me/returns/${returnId}/schedule-pickup`, data);
  },

  async confirmReturnPickup(returnId, data = {}) {
    return vendorApiClient.post(`/vendors/me/returns/${returnId}/confirm-pickup`, data);
  },

  async fulfillExchange(returnId, data = {}) {
    return vendorApiClient.post(`/vendors/me/returns/${returnId}/exchange`, data);
  },

  async cancelReturn(returnId, data = {}) {
    return vendorApiClient.post(`/vendors/me/returns/${returnId}/cancel`, data);
  },

  // 8. Finance & Settlements
  async getFinanceSummary() {
    return vendorApiClient.get("/vendors/me/finance");
  },

  async getMySettlements(params = {}) {
    return vendorApiClient.get("/vendors/me/settlements", { params });
  },

  async getSettlementById(settlementId) {
    return vendorApiClient.get(`/vendors/me/settlements/${settlementId}`);
  },

  // 9. Customer Reviews & Q&A
  async getMyReviews(params = {}) {
    return vendorApiClient.get("/reviews/vendor/my", { params });
  },

  async respondToReview(reviewId, comment) {
    return vendorApiClient.patch(`/reviews/${reviewId}/vendor-response`, {
      response: comment,
    });
  },

  async getMyQuestions(params = {}) {
    return vendorApiClient.get("/questions/vendor/my", { params });
  },

  async answerQuestion(questionId, content) {
    const text = typeof content === "object" ? content.answer || content.content : content;
    return vendorApiClient.post(`/questions/${questionId}/answers`, {
      answer: text,
      content: text,
    });
  },

  // 10. Notifications & Support Tickets
  async getMyNotifications() {
    return vendorApiClient.get("/notifications");
  },

  async markNotificationRead(id) {
    return vendorApiClient.patch(`/notifications/${id}/read`);
  },

  async markAllNotificationsRead() {
    return vendorApiClient.post("/notifications/mark-all-read");
  },

  async getMySupportTickets() {
    return vendorApiClient.get("/support-tickets/my");
  },

  async createSupportTicket(data) {
    return vendorApiClient.post("/support-tickets", data);
  },

  // 11. Fulfillment Exceptions
  async submitFulfillmentException(data) {
    const res = await vendorApiClient.post("/fulfillment-exceptions/vendor", data);
    return res?.data?.data || res?.data || res;
  },

  async getMyFulfillmentExceptions(params = {}) {
    const res = await vendorApiClient.get("/fulfillment-exceptions/vendor", { params });
    return res?.data?.data || res?.data || res;
  },

  async getMyFulfillmentExceptionById(id) {
    const res = await vendorApiClient.get(`/fulfillment-exceptions/vendor/${id}`);
    return res?.data?.data || res?.data || res;
  },

  async clarifyFulfillmentException(id, data) {
    const res = await vendorApiClient.post(`/fulfillment-exceptions/vendor/${id}/clarify`, data);
    return res?.data?.data || res?.data || res;
  },

  async withdrawFulfillmentException(id, data = {}) {
    const res = await vendorApiClient.post(`/fulfillment-exceptions/vendor/${id}/withdraw`, data);
    return res?.data?.data || res?.data || res;
  },

  // 12. Vendor Bank Accounts (Max 3, AES-256-GCM Encrypted, HMAC Blind Indexed)
  async getMyBankAccounts() {
    return vendorApiClient.get("/vendors/me/bank-accounts");
  },

  async submitBankAccount(data) {
    return vendorApiClient.post("/vendors/me/bank-accounts", data);
  },

  async switchActiveBankAccount(id, data = {}) {
    return vendorApiClient.patch(`/vendors/me/bank-accounts/${id}/active`, data);
  },

  async resubmitBankAccount(id, data) {
    return vendorApiClient.post(`/vendors/me/bank-accounts/${id}/resubmit`, data);
  },

  // 13. Vendor Wallet & Withdrawals (Double-Entry Authoritative Ledger)
  async getMyWallet() {
    return vendorApiClient.get("/vendors/me/wallet");
  },

  async getMyWalletTransactions(params = {}) {
    return vendorApiClient.get("/vendors/me/wallet/transactions", { params });
  },

  async getMyClearanceTimeline() {
    return vendorApiClient.get("/vendors/me/wallet/clearance-timeline");
  },

  async getMyWithdrawals(params = {}) {
    return vendorApiClient.get("/vendors/me/withdrawals", { params });
  },

  async submitWithdrawalRequest(data, idempotencyKey = null) {
    const headers = {};
    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }
    return vendorApiClient.post("/vendors/me/withdrawals", data, { headers });
  },

  async getMyWithdrawalById(id) {
    return vendorApiClient.get(`/vendors/me/withdrawals/${id}`);
  },

  // 14. Modern Vendor Analytics & Reporting (VD-03)
  async getAnalyticsOverview(params = {}) {
    return vendorApiClient.get("/analytics/vendor/overview", { params });
  },

  async getAnalyticsSalesTrend(params = {}) {
    return vendorApiClient.get("/analytics/vendor/sales-trend", { params });
  },

  async getAnalyticsTopProducts(params = {}) {
    return vendorApiClient.get("/analytics/vendor/top-products", { params });
  },

  async getProductPerformance(params = {}) {
    return vendorApiClient.get("/analytics/vendor/product-performance", { params });
  },

  async exportAnalytics(params = {}) {
    return vendorApiClient.get("/analytics/vendor/export", {
      params,
      responseType: "blob",
    });
  },

  // 15. Storefront Branding & Public Store (VD-04)
  async getMyBranding() {
    return vendorApiClient.get("/vendors/me/branding");
  },

  async updateMyBranding(data) {
    return vendorApiClient.patch("/vendors/me/branding", data);
  },

  async uploadBrandingAsset(formData) {
    return vendorApiClient.post("/vendors/me/branding/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  async getPublicStore(slug) {
    return vendorApiClient.get(`/vendors/store/${encodeURIComponent(slug)}`);
  },

  // 16. Vendor KYC & Compliance Management (VD-04)
  async getMyKycStatus() {
    return vendorApiClient.get("/vendors/me/kyc");
  },

  async uploadKycDocument(formData) {
    return vendorApiClient.post("/vendors/me/kyc/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  async downloadMyKycDocument(documentId) {
    return vendorApiClient.get(`/vendors/me/kyc/documents/${encodeURIComponent(documentId)}/download`, {
      responseType: "blob",
    });
  },
};

export default vendorService;
