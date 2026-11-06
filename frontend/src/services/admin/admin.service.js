import apiClient from "../../lib/api/admin-axios.js";
import { normalizeTaxRules, normalizeTaxRule } from "../../utils/tax.util.js";

export const dashboardService = {
  getStats: async (params = {}) => {
    const res = await apiClient.get("/admin/dashboard/stats", { params });
    return res?.data?.data || res?.data || res;
  },
};

export const staffService = {
  list: async (params = {}) => {
    const res = await apiClient.get("/admin/staff", { params });
    return res?.data?.data || res?.data || res;
  },
  listStaff: async (params = {}) => {
    const res = await apiClient.get("/admin/staff", { params });
    return res?.data?.data || res?.data || res;
  },
  get: async (id) => {
    const res = await apiClient.get(`/admin/staff/${id}`);
    return res?.data?.data?.staff || res?.data?.data || res;
  },
  create: async (data) => {
    const res = await apiClient.post("/admin/staff", data);
    return res?.data?.data?.staff || res?.data?.data || res;
  },
  update: async (id, data) => {
    const res = await apiClient.patch(`/admin/staff/${id}`, data);
    return res?.data?.data || res;
  },
  suspend: async (id) => {
    const res = await apiClient.post(`/admin/staff/${id}/suspend`);
    return res?.data || res;
  },
  reactivate: async (id) => {
    const res = await apiClient.post(`/admin/staff/${id}/reactivate`);
    return res?.data || res;
  },
  resetPassword: async (id, newPassword) => {
    const res = await apiClient.post(`/admin/staff/${id}/reset-password`, {
      newPassword,
    });
    return res?.data || res;
  },
  getSessions: async (id) => {
    const res = await apiClient.get(`/admin/staff/${id}/sessions`);
    return res?.data?.data || res?.data || res;
  },
  revokeSessions: async (id) => {
    const res = await apiClient.post(`/admin/staff/${id}/revoke-sessions`);
    return res?.data?.data || res?.data || res;
  },
};

export const adminStaffService = {
  ...staffService,
  listStaff: staffService.list,
};

export const taskService = {
  list: async (params = {}) => {
    const res = await apiClient.get("/admin/tasks", { params });
    return res?.data?.data || res?.data || res;
  },
  get: async (id) => {
    const res = await apiClient.get(`/admin/tasks/${id}`);
    return res?.data?.data?.task || res?.data?.data || res;
  },
  getTaskById: async (id) => {
    const res = await apiClient.get(`/admin/tasks/${id}`);
    return res?.data?.data?.task || res?.data?.data || res;
  },
  create: async (data) => {
    const res = await apiClient.post("/admin/tasks", data);
    return res?.data?.data?.task || res?.data?.data || res;
  },
  update: async (id, data) => {
    const res = await apiClient.patch(`/admin/tasks/${id}`, data);
    return res?.data?.data?.task || res?.data?.data || res;
  },
  updateTask: async (id, data) => {
    const res = await apiClient.patch(`/admin/tasks/${id}`, data);
    return res?.data?.data?.task || res?.data?.data || res;
  },
  addNote: async (id, note) => {
    const noteText = typeof note === "string" ? note : (note?.note || note?.content || "");
    const res = await apiClient.post(`/admin/tasks/${id}/notes`, { note: noteText });
    return res?.data?.data?.task || res?.data?.data || res;
  },
  delete: async (id) => {
    const res = await apiClient.delete(`/admin/tasks/${id}`);
    return res?.data || res;
  },
};

export const permissionService = {
  list: async () => {
    const res = await apiClient.get("/admin/governance/permissions");
    return res?.data?.data?.permissions || res?.data?.data || [];
  },
  updateEmployeePermissions: async (employeeId, permissions) => {
    const res = await apiClient.put(
      `/admin/governance/employees/${employeeId}/permissions`,
      { permissions }
    );
    return res?.data?.data || res?.data || res;
  },
  getEmployeeGrants: async (employeeId) => {
    const res = await apiClient.get(
      `/admin/governance/employees/${employeeId}/permissions/grants`
    );
    return res?.data?.data?.grants || [];
  },
  getEmployeeRestrictions: async (employeeId) => {
    const res = await apiClient.get(
      `/admin/governance/employees/${employeeId}/permissions/restrictions`
    );
    return res?.data?.data?.restrictions || [];
  },
};

export const adminCustomerService = {
  list: async (params = {}) => {
    const res = await apiClient.get("/admin/customers", { params });
    return res?.data?.data || res?.data || res;
  },
  get: async (id) => {
    const res = await apiClient.get(`/admin/customers/${id}`);
    return res?.data?.customer || res?.customer || res?.data || res;
  },
  updateStatus: async (id, isActive, reason) => {
    const res = await apiClient.patch(`/admin/customers/${id}/status`, {
      isActive,
      reason,
    });
    return res?.data || res;
  },
  suspend: async (id, reason) => {
    const res = await apiClient.post(`/admin/customers/${id}/suspend`, { reason });
    return res?.data || res;
  },
  reactivate: async (id, reason) => {
    const res = await apiClient.post(`/admin/customers/${id}/reactivate`, { reason });
    return res?.data || res;
  },
  resetPassword: async (id, newPassword, reason) => {
    const res = await apiClient.post(`/admin/customers/${id}/reset-password`, {
      newPassword,
      reason,
    });
    return res?.data?.data || res?.data || res;
  },
  delete: async (id, reason) => {
    const res = await apiClient.delete(`/admin/customers/${id}`, {
      data: { reason },
    });
    return res?.data?.data || res?.data || res;
  },
  deactivate: async (id, reason) => {
    const res = await apiClient.delete(`/admin/customers/${id}`, {
      data: { reason },
    });
    return res?.data?.data || res?.data || res;
  },
  issueGiftCard: async (id, payload) => {
    const res = await apiClient.post(`/admin/customers/${id}/gift-card`, payload);
    return res?.data?.data || res?.data || res;
  },
  update: async (id, payload) => {
    const res = await apiClient.patch(`/admin/customers/${id}`, payload);
    return res?.data?.data || res?.data || res;
  },
};

export const adminVendorService = {
  list: async (params = {}) => {
    const res = await apiClient.get("/admin/vendors", { params });
    return res?.data?.data || res?.data || res;
  },
  get: async (id) => {
    const res = await apiClient.get(`/admin/vendors/${id}`);
    return res?.data?.data || res?.data?.vendor || res?.vendor || res;
  },
  approve: async (id) => {
    const res = await apiClient.post(`/admin/vendors/${id}/approve`);
    return res?.data || res;
  },
  reject: async (id, reason) => {
    const res = await apiClient.post(`/admin/vendors/${id}/reject`, { reason });
    return res?.data || res;
  },
  requestChanges: async (id, reason) => {
    const res = await apiClient.post(`/admin/vendors/${id}/request-changes`, {
      reason,
    });
    return res?.data || res;
  },
  suspend: async (id, reason) => {
    const res = await apiClient.post(`/admin/vendors/${id}/suspend`, { reason });
    return res?.data || res;
  },
  suspendVendor: async (id, reason) => {
    const res = await apiClient.post(`/admin/vendors/${id}/suspend`, { reason });
    return res?.data || res;
  },
  reactivate: async (id, reason) => {
    const res = await apiClient.post(`/admin/vendors/${id}/reactivate`, { reason });
    return res?.data || res;
  },
  reactivateVendor: async (id, reason) => {
    const res = await apiClient.post(`/admin/vendors/${id}/reactivate`, { reason });
    return res?.data || res;
  },
  resetPassword: async (id, newPassword, reason) => {
    const res = await apiClient.post(`/admin/vendors/${id}/reset-password`, {
      newPassword,
      reason,
    });
    return res?.data || res;
  },
  resetVendorPassword: async (id, newPassword, reason) => {
    const res = await apiClient.post(`/admin/vendors/${id}/reset-password`, {
      newPassword,
      reason,
    });
    return res?.data || res;
  },
  delete: async (id, reason) => {
    const res = await apiClient.delete(`/admin/vendors/${id}`, {
      data: { reason },
    });
    return res?.data || res;
  },
  deleteVendor: async (id, reason) => {
    const res = await apiClient.delete(`/admin/vendors/${id}`, {
      data: { reason },
    });
    return res?.data || res;
  },
  updateVendor: async (id, payload) => {
    const res = await apiClient.patch(`/admin/vendors/${id}`, payload);
    return res?.data?.data || res?.data?.vendor || res?.vendor || res;
  },
};

export const securityService = {
  listEvents: async (params = {}) => {
    const res = await apiClient.get("/admin/security/events", { params });
    return res?.data?.data || res?.data || res;
  },
  listAuditLogs: async (params = {}) => {
    const res = await apiClient.get("/admin/security/audit-logs", { params });
    return res?.data?.data || res?.data || res;
  },
};

export const jobRoleService = {
  list: async (params = {}) => {
    const res = await apiClient.get("/admin/job-roles", { params });
    return res?.data?.data || res?.data || res;
  },
  get: async (id) => {
    const res = await apiClient.get(`/admin/job-roles/${id}`);
    return res?.data?.data || res?.data || res;
  },
  create: async (data) => {
    const res = await apiClient.post("/admin/job-roles", data);
    return res?.data?.data || res?.data || res;
  },
  update: async (id, data) => {
    const res = await apiClient.patch(`/admin/job-roles/${id}`, data);
    return res?.data?.data || res?.data || res;
  },
  reorder: async (orderedIds) => {
    const res = await apiClient.patch("/admin/job-roles/reorder", { orderedIds });
    return res?.data?.data || res?.data || res;
  },
  previewMigration: async (id, replacementRoleId) => {
    const res = await apiClient.post(`/admin/job-roles/${id}/migrate-preview`, { replacementRoleId });
    return res?.data?.data || res?.data || res;
  },
  deactivate: async (id, replacementRoleId) => {
    const res = await apiClient.post(`/admin/job-roles/${id}/deactivate`, { replacementRoleId });
    return res?.data?.data || res?.data || res;
  },
  migrateEmployees: async (id, replacementRoleId) => {
    const res = await apiClient.post(`/admin/job-roles/${id}/migrate`, { replacementRoleId });
    return res?.data?.data || res?.data || res;
  },
  previewRoleChange: async (employeeId, newRoleId) => {
    const res = await apiClient.post(`/admin/staff/${employeeId}/role-preview`, { newRoleId });
    return res?.data?.data || res?.data || res;
  },
  changeRole: async (employeeId, newRoleId, reason) => {
    const res = await apiClient.post(`/admin/staff/${employeeId}/change-role`, { newRoleId, reason });
    return res?.data?.data || res?.data || res;
  },
  transferSuperadmin: async (payload) => {
    const res = await apiClient.post("/admin/governance/superadmin/transfer", payload);
    return res?.data?.data || res?.data || res;
  },
};

export const adminCatalogService = {
  // Categories
  listCategories: async (params = {}) => {
    const res = await apiClient.get("/categories", { params });
    return res?.data?.data || res?.data || res;
  },
  getCategory: async (id) => {
    const res = await apiClient.get(`/categories/${id}`);
    return res?.data?.data || res?.data || res;
  },
  createCategory: async (data) => {
    const res = await apiClient.post("/categories", data);
    return res?.data?.data || res?.data || res;
  },
  updateCategory: async (id, data) => {
    const res = await apiClient.patch(`/categories/${id}`, data);
    return res?.data?.data || res?.data || res;
  },
  deleteCategory: async (id) => {
    const res = await apiClient.delete(`/categories/${id}`);
    return res?.data || res;
  },

  // Brands
  listBrands: async (params = {}) => {
    const res = await apiClient.get("/brands", { params });
    return res?.data?.data || res?.data || res;
  },
  getBrand: async (id) => {
    const res = await apiClient.get(`/brands/${id}`);
    return res?.data?.data || res?.data || res;
  },
  createBrand: async (data) => {
    const res = await apiClient.post("/brands", data);
    return res?.data?.data || res?.data || res;
  },
  updateBrand: async (id, data) => {
    const res = await apiClient.patch(`/brands/${id}`, data);
    return res?.data?.data || res?.data || res;
  },
  deleteBrand: async (id) => {
    const res = await apiClient.delete(`/brands/${id}`);
    return res?.data || res;
  },

  // Products
  listProducts: async (params = {}) => {
    try {
      const res = await apiClient.get("/products/admin/catalog", { params });
      return res?.data?.data || res?.data || res;
    } catch (err) {
      if (err?.response?.status === 404) {
        const fallbackRes = await apiClient.get("/products", { params });
        return fallbackRes?.data?.data || fallbackRes?.data || fallbackRes;
      }
      throw err;
    }
  },
  getProduct: async (id) => {
    try {
      const res = await apiClient.get(`/products/admin/${id}`);
      return (
        res?.data?.product ||
        res?.data?.data?.product ||
        res?.product ||
        res?.data?.data ||
        res?.data ||
        res
      );
    } catch (err) {
      if (err?.response?.status === 404) {
        const fallbackRes = await apiClient.get(`/products/${id}`);
        return (
          fallbackRes?.data?.product ||
          fallbackRes?.data?.data?.product ||
          fallbackRes?.product ||
          fallbackRes?.data?.data ||
          fallbackRes?.data ||
          fallbackRes
        );
      }
      throw err;
    }
  },
  submitProduct: async (id) => {
    const res = await apiClient.post(`/products/${id}/submit`);
    return res?.data?.data || res?.data || res;
  },
  approveProduct: async (id) => {
    const res = await apiClient.patch(`/products/${id}/approve`);
    return res?.data?.data || res?.data || res;
  },
  rejectProduct: async (id, reason) => {
    const res = await apiClient.patch(`/products/${id}/reject`, { reason });
    return res?.data?.data || res?.data || res;
  },
  createProduct: async (data) => {
    const res = await apiClient.post("/products", data);
    return res?.data?.data || res?.data || res;
  },
  updateProduct: async (id, data) => {
    const res = await apiClient.patch(`/products/${id}`, data);
    return res?.data?.data || res?.data || res;
  },
  deleteProduct: async (id) => {
    const res = await apiClient.delete(`/products/${id}`);
    return res?.data || res;
  },
  restoreProduct: async (id) => {
    const res = await apiClient.post(`/products/${id}/restore`);
    return res?.data?.data || res?.data || res;
  },
  bulkOperations: async (payload) => {
    const res = await apiClient.post("/products/admin/bulk-operations", payload);
    return res?.data?.data || res?.data || res;
  },
  getVariantsForProduct: async (productId, params = {}) => {
    const res = await apiClient.get(`/product-variants/product/${productId}`, { params });
    return res?.data?.data || res?.data || res;
  },
  duplicateProduct: async (id) => {
    const res = await apiClient.post(`/products/${id}/duplicate`);
    return (
      res?.data?.product ||
      res?.data?.data?.product ||
      res?.product ||
      res?.data?.data ||
      res?.data ||
      res
    );
  },
  createBulkVariants: async (productId, variants) => {
    const res = await apiClient.post(`/product-variants/product/${productId}/bulk`, { variants });
    return res?.data?.data || res?.data || res;
  },
  downloadImportTemplate: async (format = "xlsx") => {
    const res = await apiClient.get("/products/admin/import/template", {
      params: { format },
      responseType: "blob",
    });
    return res?.data || res;
  },
  validateBulkImport: async (formData) => {
    const res = await apiClient.post("/products/admin/import/validate", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res?.data?.data || res?.data || res;
  },
  commitBulkImport: async (rows) => {
    const res = await apiClient.post("/products/admin/import/commit", { rows });
    return res?.data?.data || res?.data || res;
  },
  exportProducts: async (params = {}) => {
    const res = await apiClient.get("/products/admin/export", {
      params,
      responseType: "blob",
    });
    return res?.data || res;
  },

  // Platform Attributes & Sets
  listAttributes: async (params = {}) => {
    const res = await apiClient.get("/attributes", { params });
    return res?.data?.data || res?.data || res;
  },
  getAttribute: async (id) => {
    const res = await apiClient.get(`/attributes/${id}`);
    return res?.data?.data || res?.data || res;
  },
  createAttribute: async (data) => {
    const res = await apiClient.post("/attributes", data);
    return res?.data?.data || res?.data || res;
  },
  updateAttribute: async (id, data) => {
    const res = await apiClient.patch(`/attributes/${id}`, data);
    return res?.data?.data || res?.data || res;
  },
  deleteAttribute: async (id) => {
    const res = await apiClient.delete(`/attributes/${id}`);
    return res?.data || res;
  },
  getCategoryAttributes: async (categoryId) => {
    const res = await apiClient.get(`/categories/${categoryId}/attributes`);
    return res?.data?.data || res?.data || res;
  },

  // Import / Export Jobs & Error Reports
  listImportJobs: async (params = {}) => {
    const res = await apiClient.get("/products/admin/import/jobs", { params });
    return res?.data?.data || res?.data || res;
  },
  getImportJob: async (jobId) => {
    const res = await apiClient.get(`/products/admin/import/jobs/${jobId}`);
    return res?.data?.data || res?.data || res;
  },
  downloadErrorReport: async (errorDetails, format = "csv") => {
    const res = await apiClient.post(
      "/products/admin/import/errors/download",
      { errorDetails },
      { params: { format }, responseType: "blob" }
    );
    return res;
  },
  exportInventory: async (params = {}) => {
    const res = await apiClient.get("/products/admin/inventory/export", {
      params,
      responseType: "blob",
    });
    return res;
  },
  bulkUpdatePricesAndStock: async (updates) => {
    const res = await apiClient.patch("/products/admin/bulk-update", { updates });
    return res?.data?.data || res?.data || res;
  },

  // Reviews
  listReviews: async (params = {}) => {
    const res = await apiClient.get("/reviews", { params });
    return res?.data?.data || res?.data || res;
  },
  moderateReview: async (reviewId, status, reason) => {
    const res = await apiClient.patch(`/reviews/${reviewId}/moderate`, {
      status,
      moderationReason: reason,
      rejectionReason: reason,
    });
    return res?.data?.data || res?.data || res;
  },
};

export const adminInventoryService = {
  listStock: async (params = {}) => {
    const res = await apiClient.get("/inventory", { params });
    return res?.data?.data || res?.data || res;
  },
  getSummary: async (params = {}) => {
    const res = await apiClient.get("/inventory/summary", { params });
    return res?.data?.data || res?.data || res;
  },
  adjustStock: async (inventoryId, quantity, notes = "") => {
    const payload = { quantity: Number(quantity) };
    if (notes) payload.notes = String(notes).trim();
    const res = await apiClient.patch(`/inventory/${inventoryId}/adjust`, payload);
    return res?.data?.data || res?.data || res;
  },
  transferStock: async (data) => {
    const res = await apiClient.post("/inventory/transfer", data);
    return res?.data?.data || res?.data || res;
  },
  listWarehouses: async (params = {}) => {
    const res = await apiClient.get("/warehouses", { params });
    return res?.data?.warehouses || res?.data?.data || res?.data || res;
  },
  getWarehouse: async (id) => {
    const res = await apiClient.get(`/warehouses/${id}`);
    return res?.data?.warehouse || res?.data?.data || res?.data || res;
  },
  createWarehouse: async (data) => {
    const res = await apiClient.post("/warehouses", data);
    return res?.data?.data || res?.data || res;
  },
  updateWarehouse: async (id, data) => {
    const res = await apiClient.patch(`/warehouses/${id}`, data);
    return res?.data?.data || res?.data || res;
  },
  deleteWarehouse: async (id) => {
    const res = await apiClient.delete(`/warehouses/${id}`);
    return res?.data?.data || res?.data || res;
  },
  // Stock Receiving
  listReceivings: async (params = {}) => {
    const res = await apiClient.get("/warehouse-operations/receiving", { params });
    return res?.data?.data || res?.data || res;
  },
  getReceiving: async (id) => {
    const res = await apiClient.get(`/warehouse-operations/receiving/${id}`);
    return res?.data?.data || res?.data || res;
  },
  createReceiving: async (data) => {
    const res = await apiClient.post("/warehouse-operations/receiving", data);
    return res?.data?.data || res?.data || res;
  },
  updateConfirmReceiving: async (id, data = {}) => {
    const res = await apiClient.post(`/warehouse-operations/receiving/${id}/confirm`, data);
    return res?.data?.data || res?.data || res;
  },
  cancelReceiving: async (id, data = {}) => {
    const res = await apiClient.post(`/warehouse-operations/receiving/${id}/cancel`, data);
    return res?.data?.data || res?.data || res;
  },
  // Stock Transfers
  listTransfers: async (params = {}) => {
    const res = await apiClient.get("/warehouse-operations/transfers", { params });
    return res?.data?.data || res?.data || res;
  },
  getTransfer: async (id) => {
    const res = await apiClient.get(`/warehouse-operations/transfers/${id}`);
    return res?.data?.data || res?.data || res;
  },
  createTransfer: async (data) => {
    const res = await apiClient.post("/warehouse-operations/transfers", data);
    return res?.data?.data || res?.data || res;
  },
  approveTransfer: async (id) => {
    const res = await apiClient.post(`/warehouse-operations/transfers/${id}/approve`);
    return res?.data?.data || res?.data || res;
  },
  dispatchTransfer: async (id, data = {}) => {
    const res = await apiClient.post(`/warehouse-operations/transfers/${id}/dispatch`, data);
    return res?.data?.data || res?.data || res;
  },
  receiveTransfer: async (id, data = {}) => {
    const res = await apiClient.post(`/warehouse-operations/transfers/${id}/receive`, data);
    return res?.data?.data || res?.data || res;
  },
  cancelTransfer: async (id, data = {}) => {
    const res = await apiClient.post(`/warehouse-operations/transfers/${id}/cancel`, data);
    return res?.data?.data || res?.data || res;
  },
  // Bin / Shelf Locations
  listLocations: async (params = {}) => {
    const res = await apiClient.get("/warehouse-operations/locations", { params });
    return res?.data?.data || res?.data || res;
  },
  createLocation: async (data) => {
    const res = await apiClient.post("/warehouse-operations/locations", data);
    return res?.data?.data || res?.data || res;
  },
  updateLocation: async (id, data) => {
    const res = await apiClient.patch(`/warehouse-operations/locations/${id}`, data);
    return res?.data?.data || res?.data || res;
  },
  assignLocationItem: async (locationId, data) => {
    const res = await apiClient.post(`/warehouse-operations/locations/${locationId}/assign`, data);
    return res?.data?.data || res?.data || res;
  },
  moveLocationItem: async (data) => {
    const res = await apiClient.post("/warehouse-operations/locations/move", data);
    return res?.data?.data || res?.data || res;
  },
  // Stock Counts / Cycle Counting
  listStockCounts: async (params = {}) => {
    const res = await apiClient.get("/warehouse-operations/counts", { params });
    return res?.data?.data || res?.data || res;
  },
  getStockCount: async (id) => {
    const res = await apiClient.get(`/warehouse-operations/counts/${id}`);
    return res?.data?.data || res?.data || res;
  },
  createStockCount: async (data) => {
    const res = await apiClient.post("/warehouse-operations/counts", data);
    return res?.data?.data || res?.data || res;
  },
  recordStockCount: async (id, data) => {
    const res = await apiClient.post(`/warehouse-operations/counts/${id}/record`, data);
    return res?.data?.data || res?.data || res;
  },
  reconcileStockCount: async (id, data = {}) => {
    const res = await apiClient.post(`/warehouse-operations/counts/${id}/reconcile`, data);
    return res?.data?.data || res?.data || res;
  },
  cancelStockCount: async (id, data = {}) => {
    const res = await apiClient.post(`/warehouse-operations/counts/${id}/cancel`, data);
    return res?.data?.data || res?.data || res;
  },
  // Order Allocation
  getEligibleWarehousesForItem: async (productVariantId, params = {}) => {
    const res = await apiClient.get(`/warehouse-operations/allocations/eligible/${productVariantId}`, { params });
    return res?.data?.data || res?.data || res;
  },
  reallocateOrderItem: async (orderId, data) => {
    const res = await apiClient.post(`/warehouse-operations/allocations/orders/${orderId}/reallocate`, data);
    return res?.data?.data || res?.data || res;
  },
  // Dashboard & Reporting
  getWarehouseDashboardOverview: async (params = {}) => {
    const res = await apiClient.get("/warehouse-operations/reports/overview", { params });
    return res?.data?.data || res?.data || res;
  },
  getWarehouseInventoryReport: async (params = {}) => {
    const res = await apiClient.get("/warehouse-operations/reports/inventory", { params });
    return res?.data?.data || res?.data || res;
  },
  getWarehouseMovementHistory: async (params = {}) => {
    const res = await apiClient.get("/warehouse-operations/reports/movement-history", { params });
    return res?.data?.data || res?.data || res;
  },
  // Aliases for comprehensive operations coverage
  listReceivingRecords(params) { return this.listReceivings(params); },
  getReceivingRecord(id) { return this.getReceiving(id); },
  createReceivingRecord(data) { return this.createReceiving(data); },
  confirmReceivingRecord(id, data) { return this.updateConfirmReceiving(id, data); },
  cancelReceivingRecord(id, data) { return this.cancelReceiving(id, data); },
  getTransferRecord(id) { return this.getTransfer(id); },
  assignItemToLocation(locId, data) { return this.assignLocationItem(locId, data); },
  moveItemBetweenLocations(data) { return this.moveLocationItem(data); },
  recordPhysicalCounts(id, data) { return this.recordStockCount(id, data); },
  reconcileAndFinalizeCount(id, data) { return this.reconcileStockCount(id, data); },
  getWarehouseOperationsOverview(params) { return this.getWarehouseDashboardOverview(params); },
  getPickLists: async (params = {}) => {
    const res = await apiClient.get("/warehouse-operations/pick-lists", { params });
    return res?.data?.data || res?.data || res;
  },
  exportPickLists: async (params = {}, format = "csv") => {
    return apiClient.get("/warehouse-operations/pick-lists/export", {
      params: { ...params, format },
      responseType: "blob",
    });
  },
  getPackingSlip: async (orderId, params = {}) => {
    const res = await apiClient.get(`/orders/${orderId}/packing-slip`, { params });
    return res?.data?.data || res?.data || res;
  },
};

export const adminImportExportService = {
  downloadTemplate: async (format = "csv") => {
    const res = await apiClient.get("/products/admin/import/template", {
      params: { format },
      responseType: "blob",
    });
    return res;
  },
  validateImport: async (formData) => {
    const res = await apiClient.post("/products/admin/import/validate", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res?.data?.data || res?.data || res;
  },
  commitImport: async (rows, stagingId = null) => {
    const payload = Array.isArray(rows)
      ? stagingId
        ? { rows, stagingId }
        : { rows }
      : rows;
    const res = await apiClient.post("/products/admin/import/commit", payload);
    return res?.data?.data || res?.data || res;
  },
  exportProducts: async (paramsOrFormat = "csv") => {
    const format = typeof paramsOrFormat === "object" && paramsOrFormat !== null ? (paramsOrFormat.format || "csv") : (paramsOrFormat || "csv");
    const res = await apiClient.get("/products/admin/export", {
      params: { format },
      responseType: "blob",
    });
    return res?.data || res;
  },
  exportInventory: async (paramsOrFormat = "csv") => {
    const format = typeof paramsOrFormat === "object" && paramsOrFormat !== null ? (paramsOrFormat.format || "csv") : (paramsOrFormat || "csv");
    const res = await apiClient.get("/products/admin/inventory/export", {
      params: { format },
      responseType: "blob",
    });
    return res?.data || res;
  },
};

export const adminOperationsService = {
  // Returns
  listReturns: async (params = {}) => {
    const res = await apiClient.get("/returns/admin", { params });
    return res?.data?.data || res?.data || res;
  },
  getReturn: async (id) => {
    const res = await apiClient.get(`/returns/admin/${id}`);
    return res?.data?.data || res?.data || res;
  },
  approveReturn: async (id, notes = "") => {
    const res = await apiClient.post(`/returns/admin/${id}/approve`, { notes });
    return res?.data?.data || res?.data || res;
  },
  rejectReturn: async (id, reason = "") => {
    const res = await apiClient.post(`/returns/admin/${id}/reject`, { reason });
    return res?.data?.data || res?.data || res;
  },
  scheduleReturnPickup: async (id, data = {}) => {
    const res = await apiClient.post(`/returns/admin/${id}/schedule-pickup`, data);
    return res?.data?.data || res?.data || res;
  },
  confirmReturnPickup: async (id, data = {}) => {
    const res = await apiClient.post(`/returns/admin/${id}/confirm-pickup`, data);
    return res?.data?.data || res?.data || res;
  },
  inspectReturn: async (id, data = {}) => {
    const res = await apiClient.post(`/returns/admin/${id}/inspect`, data);
    return res?.data?.data || res?.data || res;
  },
  fulfillExchange: async (id, data = {}) => {
    const res = await apiClient.post(`/returns/admin/${id}/exchange`, data);
    return res?.data?.data || res?.data || res;
  },
  receiveReturn: async (id, warehouseId, notes = "") => {
    const res = await apiClient.post(`/returns/admin/${id}/receive`, {
      warehouseId,
      notes,
    });
    return res?.data?.data || res?.data || res;
  },
  refundReturn: async (id, notes = "") => {
    const res = await apiClient.post(`/returns/admin/${id}/refund`, { notes });
    return res?.data?.data || res?.data || res;
  },

  // Refunds
  listRefunds: async (params = {}) => {
    const res = await apiClient.get("/payments/admin/refunds", { params });
    return res?.data?.data || res?.data || res;
  },
  getRefund: async (id) => {
    const res = await apiClient.get(`/payments/admin/refunds/${id}`);
    return res?.data?.data || res?.data || res;
  },
  createRefund: async (orderId, amount, reason) => {
    const res = await apiClient.post(`/payments/orders/${orderId}/refunds`, {
      amount,
      reason,
    });
    return res?.data?.data || res?.data || res;
  },

  // Shipments
  listShipments: async (params = {}) => {
    const res = await apiClient.get("/shipments", { params });
    return res?.data?.data || res?.data || res;
  },
  getShipment: async (id) => {
    const res = await apiClient.get(`/shipments/${id}`);
    return res?.data?.data || res?.data || res;
  },
  getShipmentPackingSlip: async (id) => {
    const res = await apiClient.get(`/shipments/${id}/packing-slip`);
    return res?.data?.data || res?.data || res;
  },
  updateShipmentStatus: async (id, data = {}) => {
    const res = await apiClient.patch(`/shipments/${encodeURIComponent(id)}/status`, data);
    return res?.data?.data || res?.data || res;
  },
  exportShipments: async (params = {}, format = "csv") => {
    return apiClient.get("/shipments/export", {
      params: { ...params, format },
      responseType: "blob",
    });
  },
  getOrderPackingSlip: async (orderId, params = {}) => {
    const res = await apiClient.get(`/orders/${orderId}/packing-slip`, { params });
    return res?.data?.data || res?.data || res;
  },
  getPickLists: async (params = {}) => {
    const res = await apiClient.get("/warehouse-operations/pick-lists", { params });
    return res?.data?.data || res?.data || res;
  },
  exportPickLists: async (params = {}, format = "csv") => {
    return apiClient.get("/warehouse-operations/pick-lists/export", {
      params: { ...params, format },
      responseType: "blob",
    });
  },
};

export const adminSupportService = {
  listTickets: async (params = {}) => {
    const res = await apiClient.get("/support-tickets", { params });
    return res?.data?.data || res?.data || res;
  },
  getTicket: async (id) => {
    const res = await apiClient.get(`/support-tickets/${id}`);
    return res?.data?.data || res?.data || res;
  },
  updateTicket: async (id, data) => {
    const res = await apiClient.patch(`/support-tickets/${id}`, data);
    return res?.data?.data || res?.data || res;
  },
  assignTicket: async (id, assignedTo) => {
    const res = await apiClient.patch(`/support-tickets/${id}/assign`, {
      assignedTo,
    });
    return res?.data?.data || res?.data || res;
  },
  transitionStatus: async (id, status) => {
    const res = await apiClient.patch(`/support-tickets/${id}/status`, {
      status,
    });
    return res?.data?.data || res?.data || res;
  },
  getTicketMessages: async (id) => {
    const res = await apiClient.get(`/support-tickets/${id}/messages/all`);
    return res?.data?.data || res?.data || res;
  },
  replyTicket: async (id, data) => {
    const res = await apiClient.post(`/support-tickets/${id}/messages/reply`, data);
    return res?.data?.data || res?.data || res;
  },
  addInternalNote: async (id, data) => {
    const res = await apiClient.post(`/support-tickets/${id}/messages/internal-note`, data);
    return res?.data?.data || res?.data || res;
  },
};

export const adminAnalyticsService = {
  getOverview: async (params = {}) => {
    const res = await apiClient.get("/analytics/admin/overview", { params });
    return res?.data?.data || res?.data || res;
  },
  getTopProducts: async (params = {}) => {
    const res = await apiClient.get("/analytics/admin/top-products", { params });
    return res?.data?.data || res?.data || res;
  },
  getSalesTrend: async (params = {}) => {
    const res = await apiClient.get("/analytics/admin/sales-trend", { params });
    return res?.data?.intervals || res?.data?.trend || res?.data?.data || res?.data || res;
  },
};

export const adminSearchService = {
  search: async (q) => {
    const res = await apiClient.get("/admin/search", { params: { q } });
    return res?.data?.data || res?.data || res;
  },
};

export const adminAuthPolicyService = {
  getLoginMethods: async () => {
    const res = await apiClient.get("/admin/authentication/login-methods");
    return res?.data?.data || res?.data || res;
  },
  updateLoginMethods: async (data) => {
    const res = await apiClient.patch("/admin/authentication/login-methods", data);
    return res?.data?.data || res?.data || res;
  },
};

export const adminMediaService = {
  uploadMedia: async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await apiClient.post("/storefront/media/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res?.data || res;
  },
  listMedia: async (params = {}) => {
    const res = await apiClient.get("/storefront/media", { params });
    return res?.data?.data || res?.data || res;
  },
};

export const campaignService = {
  list: async (params = {}) => {
    const res = await apiClient.get("/campaigns", { params });
    return res?.data?.data || res?.data || [];
  },
  get: async (id) => {
    const res = await apiClient.get(`/campaigns/${id}`);
    return res?.data?.data || res?.data || null;
  },
  create: async (data) => {
    const res = await apiClient.post("/campaigns", data);
    return res?.data?.data || res?.data;
  },
  update: async (id, data) => {
    const res = await apiClient.patch(`/campaigns/${id}`, data);
    return res?.data?.data || res?.data;
  },
  activate: async (id) => {
    const res = await apiClient.patch(`/campaigns/${id}/activate`);
    return res?.data?.data || res?.data;
  },
  deactivate: async (id) => {
    const res = await apiClient.patch(`/campaigns/${id}/deactivate`);
    return res?.data?.data || res?.data;
  },
  transitionStatus: async (id, status) => {
    const res = await apiClient.patch(`/campaigns/${id}/status`, { status });
    return res?.data?.data || res?.data;
  },
  schedule: async (id) => {
    const res = await apiClient.patch(`/campaigns/${id}/schedule`);
    return res?.data?.data || res?.data;
  },
  duplicate: async (id) => {
    const res = await apiClient.post("/campaigns", { duplicateFrom: id });
    return res?.data?.data || res?.data;
  },
  archive: async (id) => {
    const res = await apiClient.patch(`/campaigns/${id}/status`, { status: "archived" });
    return res?.data?.data || res?.data;
  },
};

export const couponService = {
  list: async (params = {}) => {
    const res = await apiClient.get("/coupons", { params });
    return res?.data?.data || res?.data || [];
  },
  get: async (id) => {
    const res = await apiClient.get(`/coupons/${id}`);
    return res?.data?.data || res?.data || null;
  },
  create: async (data) => {
    const res = await apiClient.post("/coupons", data);
    return res?.data?.data || res?.data;
  },
  update: async (id, data) => {
    const res = await apiClient.patch(`/coupons/${id}`, data);
    return res?.data?.data || res?.data;
  },
  activate: async (id) => {
    const res = await apiClient.patch(`/coupons/${id}/activate`);
    return res?.data?.data || res?.data;
  },
  deactivate: async (id) => {
    const res = await apiClient.patch(`/coupons/${id}/deactivate`);
    return res?.data?.data || res?.data;
  },
  delete: async (id) => {
    const res = await apiClient.delete(`/admin/coupons/${id}`);
    return res?.data?.data || res?.data;
  },
  getRedemptions: async (couponId) => {
    const res = await apiClient.get(`/coupon-redemptions/coupon/${couponId}`);
    return res?.data?.data || res?.data || [];
  },
};

export const discountService = {
  list: async (params = {}) => {
    const res = await apiClient.get("/admin/discounts", { params });
    return res?.data?.data || res?.data || [];
  },
  get: async (id) => {
    const res = await apiClient.get(`/admin/discounts/${id}`);
    return res?.data?.data || res?.data || null;
  },
  create: async (data) => {
    const res = await apiClient.post("/admin/discounts", data);
    return res?.data?.data || res?.data;
  },
  update: async (id, data) => {
    const res = await apiClient.patch(`/admin/discounts/${id}`, data);
    return res?.data?.data || res?.data;
  },
  activate: async (id, reason = null) => {
    const res = await apiClient.post(`/admin/discounts/${id}/activate`, { reason });
    return res?.data?.data || res?.data;
  },
  pause: async (id, reason = null) => {
    const res = await apiClient.post(`/admin/discounts/${id}/pause`, { reason });
    return res?.data?.data || res?.data;
  },
  resume: async (id, reason = null) => {
    const res = await apiClient.post(`/admin/discounts/${id}/resume`, { reason });
    return res?.data?.data || res?.data;
  },
  cancel: async (id, reason = null) => {
    const res = await apiClient.post(`/admin/discounts/${id}/cancel`, { reason });
    return res?.data?.data || res?.data;
  },
  delete: async (id) => {
    const res = await apiClient.delete(`/admin/discounts/${id}`);
    return res?.data?.data || res?.data;
  },
  preview: async (payload) => {
    const res = await apiClient.post("/admin/discounts/preview", payload);
    return res?.data?.data || res?.data;
  },
  assignProducts: async (id, payload) => {
    const res = await apiClient.post(`/admin/discounts/${id}/assign-products`, payload);
    return res?.data?.data || res?.data;
  },
  reconcile: async (payload = {}) => {
    const res = await apiClient.post("/admin/discounts/reconcile", payload);
    return res?.data?.data || res?.data;
  },
};

export const adminSettingsService = {
  get: async () => {
    const res = await apiClient.get("/storefront/settings");
    return res?.data?.data || res?.data || null;
  },
  update: async (data) => {
    const res = await apiClient.put("/admin/settings/general", data);
    return res?.data?.data || res?.data;
  },
  updateFeatureFlags: async (featureFlags) => {
    const res = await apiClient.patch("/admin/settings/general/feature-flags", featureFlags);
    return res?.data?.data || res?.data;
  },
};

export const adminTaxService = {
  getRules: async (params = {}) => {
    const res = await apiClient.get("/tax/rules", { params });
    const raw = res?.data?.data || res?.data || [];
    return normalizeTaxRules(raw);
  },
  getRule: async (id) => {
    const res = await apiClient.get(`/tax/rules/${id}`);
    const raw = res?.data?.data || res?.data || null;
    return raw ? normalizeTaxRule(raw) : null;
  },
  createRule: async (data) => {
    const res = await apiClient.post("/tax/rules", data);
    const raw = res?.data?.data || res?.data;
    return raw ? normalizeTaxRule(raw) : raw;
  },
  updateRule: async (id, data) => {
    const res = await apiClient.put(`/tax/rules/${id}`, data);
    const raw = res?.data?.data || res?.data;
    return raw ? normalizeTaxRule(raw) : raw;
  },
  deleteRule: async (id) => {
    const res = await apiClient.delete(`/tax/rules/${id}`);
    return res?.data?.data || res?.data;
  },
};

export const cmsPageService = {
  list: async (params = {}) => {
    const res = await apiClient.get("/cms/pages", { params });
    return res?.data?.data || res?.data || [];
  },
  get: async (id) => {
    const res = await apiClient.get(`/cms/pages/${id}`);
    return res?.data?.data || res?.data || null;
  },
  create: async (data) => {
    const res = await apiClient.post("/cms/pages", data);
    return res?.data?.data || res?.data;
  },
  update: async (id, data) => {
    const res = await apiClient.patch(`/cms/pages/${id}`, data);
    return res?.data?.data || res?.data;
  },
  publish: async (id) => {
    const res = await apiClient.patch(`/cms/pages/${id}/publish`);
    return res?.data?.data || res?.data;
  },
  unpublish: async (id) => {
    const res = await apiClient.patch(`/cms/pages/${id}/unpublish`);
    return res?.data?.data || res?.data;
  },
  archive: async (id) => {
    const res = await apiClient.patch(`/cms/pages/${id}/archive`);
    return res?.data?.data || res?.data;
  },
  delete: async (id) => {
    const res = await apiClient.delete(`/cms/pages/${id}`);
    return res?.data?.data || res?.data;
  },
};

export const adminEventPageService = {
  list: async (params = {}) => {
    const res = await apiClient.get("/cms/events", { params });
    return res?.data?.data || res?.data || [];
  },
  get: async (id) => {
    const res = await apiClient.get(`/cms/events/${id}`);
    return res?.data?.data || res?.data || null;
  },
  create: async (data) => {
    const res = await apiClient.post("/cms/events", data);
    return res?.data?.data || res?.data;
  },
  update: async (id, data) => {
    const res = await apiClient.patch(`/cms/events/${id}`, data);
    return res?.data?.data || res?.data;
  },
  duplicate: async (id) => {
    const res = await apiClient.post(`/cms/events/${id}/duplicate`);
    return res?.data?.data || res?.data;
  },
  publish: async (id) => {
    const res = await apiClient.patch(`/cms/events/${id}/publish`);
    return res?.data?.data || res?.data;
  },
  unpublish: async (id) => {
    const res = await apiClient.patch(`/cms/events/${id}/unpublish`);
    return res?.data?.data || res?.data;
  },
  archive: async (id) => {
    const res = await apiClient.patch(`/cms/events/${id}/archive`);
    return res?.data?.data || res?.data;
  },
  delete: async (id) => {
    const res = await apiClient.delete(`/cms/events/${id}`);
    return res?.data?.data || res?.data;
  },
};

export const adminReportService = adminAnalyticsService;

export const adminSystemService = {
  getHealth: async () => {
    const res = await apiClient.get("/health");
    return res?.data || res;
  },
  getStatus: async () => {
    const res = await apiClient.get("/health");
    return res?.data || res;
  },
};

export const adminNotificationService = {
  list: async (params = {}) => {
    const res = await apiClient.get("/notifications", { params });
    return res?.data?.data || res?.data || [];
  },
  markAsRead: async (id) => {
    const res = await apiClient.patch(`/notifications/${id}/read`);
    return res?.data || res;
  },
  markAllAsRead: async () => {
    const res = await apiClient.post("/notifications/mark-all-read");
    return res?.data || res;
  },
};

export const adminIntegrationService = {
  list: async () => {
    return [
      { id: "stripe", name: "Stripe Payments", status: "configured", category: "Payments" },
      { id: "razorpay", name: "Razorpay", status: "configured", category: "Payments" },
      { id: "shiprocket", name: "Shiprocket Logistics", status: "active", category: "Shipping" },
      { id: "sendgrid", name: "SendGrid Email API", status: "active", category: "Communications" },
    ];
  },
};



