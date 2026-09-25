import apiClient from "../../lib/api/admin-axios.js";

export const dashboardService = {
  getStats: async () => {
    const res = await apiClient.get("/admin/dashboard/stats");
    return res?.data?.data || res?.data || res;
  },
};

export const staffService = {
  list: async (params = {}) => {
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
  create: async (data) => {
    const res = await apiClient.post("/admin/tasks", data);
    return res?.data?.data?.task || res?.data?.data || res;
  },
  update: async (id, data) => {
    const res = await apiClient.patch(`/admin/tasks/${id}`, data);
    return res?.data?.data?.task || res?.data?.data || res;
  },
  addNote: async (id, note) => {
    const res = await apiClient.post(`/admin/tasks/${id}/notes`, { note });
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
    return res?.data?.data?.customer || res?.data?.data || res;
  },
  updateStatus: async (id, isActive) => {
    const res = await apiClient.patch(`/admin/customers/${id}/status`, {
      isActive,
    });
    return res?.data || res;
  },
};

export const adminVendorService = {
  list: async (params = {}) => {
    const res = await apiClient.get("/vendors", { params });
    return res?.data?.data || res?.data || res;
  },
  approve: async (id) => {
    const res = await apiClient.post(`/vendors/${id}/approve`);
    return res?.data || res;
  },
  reject: async (id, reason) => {
    const res = await apiClient.post(`/vendors/${id}/reject`, { reason });
    return res?.data || res;
  },
  requestChanges: async (id, reason) => {
    const res = await apiClient.post(`/vendors/${id}/request-changes`, {
      reason,
    });
    return res?.data || res;
  },
  suspend: async (id, reason) => {
    const res = await apiClient.patch(`/vendors/${id}/status`, {
      status: "suspended",
      reason,
    });
    return res?.data || res;
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
    const res = await apiClient.get("/products", { params });
    return res?.data?.data || res?.data || res;
  },
  getProduct: async (id) => {
    const res = await apiClient.get(`/products/${id}`);
    return res?.data?.data?.product || res?.data?.data || res;
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
  duplicateProduct: async (id) => {
    const res = await apiClient.post(`/products/${id}/duplicate`);
    return res?.data?.data?.product || res?.data?.data || res;
  },
  createBulkVariants: async (productId, variants) => {
    const res = await apiClient.post(`/product-variants/product/${productId}/bulk`, { variants });
    return res?.data?.data || res?.data || res;
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
  moderateReview: async (reviewId, status, rejectionReason) => {
    const res = await apiClient.patch(`/reviews/${reviewId}/moderate`, {
      status,
      rejectionReason,
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
    const res = await apiClient.patch(`/inventory/${inventoryId}/adjust`, {
      quantity: Number(quantity),
      notes,
    });
    return res?.data?.data || res?.data || res;
  },
  transferStock: async (data) => {
    const res = await apiClient.post("/inventory/transfer", data);
    return res?.data?.data || res?.data || res;
  },
  listWarehouses: async (params = {}) => {
    const res = await apiClient.get("/warehouses", { params });
    return res?.data?.data || res?.data || res;
  },
  getWarehouse: async (id) => {
    const res = await apiClient.get(`/warehouses/${id}`);
    return res?.data?.data || res?.data || res;
  },
  createWarehouse: async (data) => {
    const res = await apiClient.post("/warehouses", data);
    return res?.data?.data || res?.data || res;
  },
  updateWarehouse: async (id, data) => {
    const res = await apiClient.patch(`/warehouses/${id}`, data);
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
  commitImport: async (rows) => {
    const res = await apiClient.post("/products/admin/import/commit", { rows });
    return res?.data?.data || res?.data || res;
  },
  exportProducts: async (format = "csv") => {
    const res = await apiClient.get("/products/admin/export", {
      params: { format },
      responseType: "blob",
    });
    return res;
  },
  exportInventory: async (format = "csv") => {
    const res = await apiClient.get("/products/admin/inventory/export", {
      params: { format },
      responseType: "blob",
    });
    return res;
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
    return res?.data?.data || res?.data || res;
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

