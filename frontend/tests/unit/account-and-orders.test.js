import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { orderService } from "../../src/services/order.service.js";
import { customerService } from "../../src/services/customer.service.js";
import { wishlistService } from "../../src/services/wishlist.service.js";
import apiClient from "../../src/lib/api/axios.js";

describe("Account & Order Services Contract Tests", () => {
  test("orderService.getMyOrders calls GET /orders", async () => {
    const originalGet = apiClient.get;
    let capturedUrl = null;

    apiClient.get = async (url) => {
      capturedUrl = url;
      return { data: { orders: [] } };
    };

    try {
      const res = await orderService.getMyOrders();
      assert.equal(capturedUrl, "/orders");
      assert.deepEqual(res.data.orders, []);
    } finally {
      apiClient.get = originalGet;
    }
  });

  test("orderService.getOrderById calls GET /orders/:id", async () => {
    const originalGet = apiClient.get;
    let capturedUrl = null;

    apiClient.get = async (url) => {
      capturedUrl = url;
      return { data: { order: { _id: "ord-123", orderNumber: "BB-ORD-123" } } };
    };

    try {
      const res = await orderService.getOrderById("ord-123");
      assert.equal(capturedUrl, "/orders/ord-123");
      assert.equal(res.data.order.orderNumber, "BB-ORD-123");
    } finally {
      apiClient.get = originalGet;
    }
  });

  test("orderService.cancelOrder calls POST /orders/:id/cancel", async () => {
    const originalPost = apiClient.post;
    let capturedUrl = null;

    apiClient.post = async (url) => {
      capturedUrl = url;
      return { data: { order: { _id: "ord-123", status: "cancelled" } } };
    };

    try {
      const res = await orderService.cancelOrder("ord-123");
      assert.equal(capturedUrl, "/orders/ord-123/cancel");
      assert.equal(res.data.order.status, "cancelled");
    } finally {
      apiClient.post = originalPost;
    }
  });

  test("customerService.getProfile calls GET /customers/me", async () => {
    const originalGet = apiClient.get;
    let capturedUrl = null;

    apiClient.get = async (url) => {
      capturedUrl = url;
      return { data: { customer: { phone: "+919876543210" } } };
    };

    try {
      const res = await customerService.getProfile();
      assert.equal(capturedUrl, "/customers/me");
      assert.equal(res.data.customer.phone, "+919876543210");
    } finally {
      apiClient.get = originalGet;
    }
  });

  test("customerService.updateProfile calls PATCH /customers/me with strict payload", async () => {
    const originalPatch = apiClient.patch;
    let capturedUrl = null;
    let capturedBody = null;

    apiClient.patch = async (url, body) => {
      capturedUrl = url;
      capturedBody = body;
      return { data: { customer: body } };
    };

    try {
      const payload = {
        phone: "9876543210",
        dateOfBirth: "1995-05-20T00:00:00.000Z",
        gender: "female",
        preferences: {
          marketingEmails: true,
          marketingSms: false,
          marketingPush: false,
        },
      };
      await customerService.updateProfile(payload);
      assert.equal(capturedUrl, "/customers/me");
      assert.deepEqual(capturedBody, payload);
    } finally {
      apiClient.patch = originalPatch;
    }
  });

  test("wishlistService.addItem includes productId conforming to backend schema", async () => {
    const originalPost = apiClient.post;
    let capturedUrl = null;
    let capturedBody = null;

    apiClient.post = async (url, body) => {
      capturedUrl = url;
      capturedBody = body;
      return { data: { wishlist: { items: [] } } };
    };

    try {
      await wishlistService.addItem({
        productId: "60d0fe4f5311236168a109ca",
        productVariantId: "60d0fe4f5311236168a109cb",
      });
      assert.equal(capturedUrl, "/wishlist/items");
      assert.equal(capturedBody.productId, "60d0fe4f5311236168a109ca");
      assert.equal(capturedBody.productVariantId, "60d0fe4f5311236168a109cb");
    } finally {
      apiClient.post = originalPost;
    }
  });
});
