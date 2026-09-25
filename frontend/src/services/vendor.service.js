import apiClient from "../lib/api/axios.js";

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
    return apiClient.post("/vendor/auth/login", { email, password });
  },

  async refresh() {
    return apiClient.post("/vendor/auth/refresh");
  },

  async logout() {
    return apiClient.post("/vendor/auth/logout");
  },

  async registerVendor(data) {
    return apiClient.post("/vendors/register", data);
  },

  async getMyProfile() {
    return apiClient.get("/vendors/me");
  },

  async createMyProfile(data) {
    return apiClient.post("/vendors/me", data);
  },

  async updateMyProfile(data) {
    return apiClient.patch("/vendors/me", data);
  },

  async resubmitApplication() {
    return apiClient.post("/vendors/me/resubmit");
  },

  // 2. Real Dashboard Analytics & Activity
  async getDashboardAnalytics(params = {}) {
    return apiClient.get("/vendors/me/dashboard", { params });
  },

  async getActivityLogs() {
    return apiClient.get("/vendors/me/activity");
  },

  // 3. Catalog Products & Variants
  async getMyProducts(params = {}) {
    return apiClient.get("/products/vendor/my", { params });
  },

  async getProductById(id) {
    return apiClient.get(`/products/${id}`);
  },

  async createProduct(data) {
    return apiClient.post("/products", data);
  },

  async updateProduct(id, data) {
    return apiClient.patch(`/products/${id}`, data);
  },

  async deleteProduct(id) {
    return apiClient.delete(`/products/${id}`);
  },

  async submitProductForApproval(id) {
    return apiClient.post(`/products/${id}/submit`);
  },

  async getProductVariants(productId) {
    return apiClient.get(`/variants/product/${productId}`);
  },

  async createProductVariant(productId, data) {
    return apiClient.post(`/variants/product/${productId}`, data);
  },

  async updateProductVariant(id, data) {
    return apiClient.patch(`/variants/${id}`, data);
  },

  async deleteProductVariant(id) {
    return apiClient.delete(`/variants/${id}`);
  },

  // Bulk Product Import & Export
  async downloadImportTemplate(format = "csv") {
    return apiClient.get(`/products/vendor/import/template?format=${format}`, {
      responseType: "blob",
    });
  },

  async validateBulkImport(formData) {
    return apiClient.post("/products/vendor/import/validate", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  async commitBulkImport(rows) {
    return apiClient.post("/products/vendor/import/commit", { rows });
  },

  async exportProducts(params = {}) {
    return apiClient.get("/products/vendor/export", {
      params,
      responseType: "blob",
    });
  },

  // 4. Inventory & Warehouse Management
  async getMyInventory(params = {}) {
    return apiClient.get("/inventory/vendor/my", { params });
  },

  async adjustInventory(id, { quantity, notes = null }) {
    return apiClient.patch(`/inventory/${id}/adjust`, { quantity, notes });
  },

  async getMyWarehouses() {
    return apiClient.get("/warehouses/vendor/my");
  },

  async getMyWarehouseById(id) {
    return apiClient.get(`/warehouses/vendor/my/${id}`);
  },

  // 5. Orders & Fulfillment
  async getMyOrders(params = {}) {
    return apiClient.get("/vendors/me/orders", { params });
  },

  async getMyOrderById(id) {
    return apiClient.get(`/vendors/me/orders/${id}`);
  },

  async processOrder(orderId, notes = null) {
    return apiClient.post(`/vendors/me/orders/${orderId}/process`, { notes });
  },

  async markOrderReadyToShip(orderId, notes = null) {
    return apiClient.post(`/vendors/me/orders/${orderId}/ready-to-ship`, { notes });
  },

  async createOrderShipment(orderId, data) {
    return apiClient.post(`/vendors/me/orders/${orderId}/shipments`, data);
  },

  // 6. Shipments & Courier Tracking
  async getMyShipments(params = {}) {
    return apiClient.get("/shipments/vendor/my", { params });
  },

  async getMyShipmentById(id) {
    return apiClient.get(`/shipments/vendor/my/${id}`);
  },

  async createShipment(data) {
    return apiClient.post("/shipments/vendor", data);
  },

  async updateShipmentStatus(id, data) {
    return apiClient.patch(`/shipments/vendor/${id}/status`, data);
  },

  // 7. Returns & RMA
  async getMyReturns(params = {}) {
    return apiClient.get("/vendors/me/returns", { params });
  },

  async getMyReturnById(id) {
    return apiClient.get(`/vendors/me/returns/${id}`);
  },

  async approveReturn(returnId, notes = null) {
    return apiClient.post(`/vendors/me/returns/${returnId}/approve`, { notes });
  },

  async rejectReturn(returnId, reason) {
    return apiClient.post(`/vendors/me/returns/${returnId}/reject`, { reason });
  },

  async receiveReturnAndRestock(returnId, data = {}) {
    return apiClient.post(`/vendors/me/returns/${returnId}/receive`, data);
  },

  async refundReturn(returnId, notes = null) {
    return apiClient.post(`/vendors/me/returns/${returnId}/refund`, { notes });
  },

  // 8. Finance & Settlements
  async getFinanceSummary() {
    return apiClient.get("/vendors/me/finance");
  },

  async getMySettlements(params = {}) {
    return apiClient.get("/vendors/me/settlements", { params });
  },

  async getSettlementById(settlementId) {
    return apiClient.get(`/vendors/me/settlements/${settlementId}`);
  },

  // 9. Customer Reviews & Q&A
  async getMyReviews(params = {}) {
    return apiClient.get("/reviews/vendor/my", { params });
  },

  async respondToReview(reviewId, comment) {
    return apiClient.patch(`/reviews/${reviewId}/vendor-response`, {
      response: comment,
    });
  },

  async getMyQuestions(params = {}) {
    return apiClient.get("/questions/vendor/my", { params });
  },

  async answerQuestion(questionId, content) {
    return apiClient.post(`/questions/${questionId}/answers`, {
      content,
    });
  },

  // 10. Notifications & Support Tickets
  async getMyNotifications() {
    return apiClient.get("/notifications");
  },

  async markNotificationRead(id) {
    return apiClient.patch(`/notifications/${id}/read`);
  },

  async markAllNotificationsRead() {
    return apiClient.post("/notifications/mark-all-read");
  },

  async getMySupportTickets() {
    return apiClient.get("/support-tickets/my");
  },

  async createSupportTicket(data) {
    return apiClient.post("/support-tickets", data);
  },
};

export default vendorService;
