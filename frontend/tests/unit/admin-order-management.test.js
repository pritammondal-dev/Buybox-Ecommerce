import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { adminOrderService } from "../../src/services/admin/order.service.js";
import apiClient from "../../src/lib/api/admin-axios.js";

describe("Admin Order Management — Service Contract & Pricing Verification", () => {
  test("adminOrderService.updateOrderStatus issues PATCH /orders/admin/:id/status with conforming payload", async () => {
    const originalPatch = apiClient.patch;
    let capturedUrl = null;
    let capturedBody = null;

    apiClient.patch = async (url, body) => {
      capturedUrl = url;
      capturedBody = body;
      return {
        data: {
          success: true,
          data: {
            _id: "order-123",
            status: body.status,
            orderNumber: "BB-20261019-001",
          },
        },
      };
    };

    try {
      const payload = {
        status: "processing",
        reason: "Preparation started",
        notes: "Items confirmed in stock",
        expectedPreviousStatus: "confirmed",
        isOverride: false,
      };

      const result = await adminOrderService.updateOrderStatus("order-123", payload);

      assert.equal(capturedUrl, "/orders/admin/order-123/status");
      assert.deepEqual(capturedBody, payload);
      assert.equal(result.status, "processing");
      assert.equal(result.orderNumber, "BB-20261019-001");
    } finally {
      apiClient.patch = originalPatch;
    }
  });

  test("adminOrderService.updateOrderStatus supports Superadmin exceptional override payload", async () => {
    const originalPatch = apiClient.patch;
    let capturedUrl = null;
    let capturedBody = null;

    apiClient.patch = async (url, body) => {
      capturedUrl = url;
      capturedBody = body;
      return {
        data: {
          success: true,
          data: {
            _id: "order-456",
            status: body.status,
          },
        },
      };
    };

    try {
      const payload = {
        status: "processing",
        isOverride: true,
        overrideReason: "Carrier returned damaged label; reset to processing for relabeling",
        expectedPreviousStatus: "shipped",
      };

      const result = await adminOrderService.updateOrderStatus("order-456", payload);

      assert.equal(capturedUrl, "/orders/admin/order-456/status");
      assert.equal(capturedBody.isOverride, true);
      assert.equal(capturedBody.overrideReason, payload.overrideReason);
      assert.equal(result.status, "processing");
    } finally {
      apiClient.patch = originalPatch;
    }
  });

  test("adminOrderService.getOrders correctly serializes search, date range, and sort parameters", async () => {
    const originalGet = apiClient.get;
    let capturedUrl = null;
    let capturedParams = null;

    apiClient.get = async (url, config) => {
      capturedUrl = url;
      capturedParams = config?.params;
      return {
        data: {
          data: [{ _id: "order-1", grandTotal: "1500.00" }],
          meta: { page: 1, limit: 20, total: 1 },
        },
      };
    };

    try {
      const params = {
        page: 1,
        limit: 20,
        status: "confirmed",
        search: "John",
        dateFrom: "2026-10-01",
        dateTo: "2026-10-19",
        sortBy: "grandTotal",
        sortOrder: "desc",
      };

      const result = await adminOrderService.getOrders(params);

      assert.equal(capturedUrl, "/orders/admin");
      assert.deepEqual(capturedParams, params);
      assert.equal(result.data.length, 1);
      assert.equal(result.meta.total, 1);
    } finally {
      apiClient.get = originalGet;
    }
  });

  test("adminOrderService.getOrderById issues GET /orders/admin/:id and receives normalized pricing data", async () => {
    const originalGet = apiClient.get;
    let capturedUrl = null;

    const mockOrderResponse = {
      _id: "order-789",
      orderNumber: "BB-20261019-999",
      subtotal: "1999.00",
      discountTotal: "100.00",
      shippingTotal: "50.00",
      taxTotal: "150.00",
      grandTotal: "2099.00",
      items: [
        {
          productName: "Premium Noise Cancelling Headphones",
          sku: "WH-1000",
          quantity: 1,
          unitPrice: "1999.00",
          lineTotal: "1899.00",
          productImage: "https://cdn.buybox.test/images/wh.jpg",
          vendor: { name: "Acoustics Hub" },
        },
      ],
      timeline: [
        { event: "order_placed", title: "Order Placed" },
        { event: "status_confirmed", title: "Order Status Updated to CONFIRMED" },
      ],
    };

    apiClient.get = async (url) => {
      capturedUrl = url;
      return { data: { success: true, data: mockOrderResponse } };
    };

    try {
      const res = await adminOrderService.getOrderById("order-789");

      assert.equal(capturedUrl, "/orders/admin/order-789");
      assert.equal(res.subtotal, "1999.00");
      assert.equal(res.grandTotal, "2099.00");
      assert.equal(res.items[0].unitPrice, "1999.00");
      assert.equal(res.items[0].productImage, "https://cdn.buybox.test/images/wh.jpg");
      assert.equal(res.timeline.length, 2);
    } finally {
      apiClient.get = originalGet;
    }
  });
});
