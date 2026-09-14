import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { reviewService } from "../../src/services/review.service.js";
import apiClient from "../../src/lib/api/axios.js";

describe("Product Reviews Service Contract Tests", () => {
  test("reviewService.getProductReviews calls GET /reviews/product/:productId", async () => {
    const originalGet = apiClient.get;
    let capturedUrl = null;
    let capturedConfig = null;

    apiClient.get = async (url, config) => {
      capturedUrl = url;
      capturedConfig = config;
      return { data: [{ _id: "rev-1", rating: 5 }] };
    };

    try {
      const res = await reviewService.getProductReviews("60d0fe4f5311236168a109ca");
      assert.equal(capturedUrl, "/reviews/product/60d0fe4f5311236168a109ca");
      assert.deepEqual(capturedConfig, { params: {} });
      assert.equal(res.data[0].rating, 5);
    } finally {
      apiClient.get = originalGet;
    }
  });

  test("reviewService.getReviewById calls GET /reviews/:reviewId", async () => {
    const originalGet = apiClient.get;
    let capturedUrl = null;

    apiClient.get = async (url) => {
      capturedUrl = url;
      return { data: { review: { _id: "60d0fe4f5311236168a109cb", rating: 4 } } };
    };

    try {
      const res = await reviewService.getReviewById("60d0fe4f5311236168a109cb");
      assert.equal(capturedUrl, "/reviews/60d0fe4f5311236168a109cb");
      assert.equal(res.data.review.rating, 4);
    } finally {
      apiClient.get = originalGet;
    }
  });

  test("reviewService.createReview calls POST /reviews with conforming payload", async () => {
    const originalPost = apiClient.post;
    let capturedUrl = null;
    let capturedBody = null;

    apiClient.post = async (url, body) => {
      capturedUrl = url;
      capturedBody = body;
      return { data: { review: { _id: "rev-new", ...body } } };
    };

    try {
      const payload = {
        productId: "60d0fe4f5311236168a109ca",
        orderId: "60d0fe4f5311236168a109cc",
        productVariantId: null,
        rating: 5,
        title: "Exceptional build quality",
        comment: "Solid craftsmanship and worked perfectly out of the box.",
      };

      const res = await reviewService.createReview(payload);
      assert.equal(capturedUrl, "/reviews");
      assert.deepEqual(capturedBody, payload);
      assert.equal(res.data.review.rating, 5);
      assert.equal(res.data.review.title, "Exceptional build quality");
    } finally {
      apiClient.post = originalPost;
    }
  });

  test("reviewService.updateReview calls PATCH /reviews/:reviewId with update payload", async () => {
    const originalPatch = apiClient.patch;
    let capturedUrl = null;
    let capturedBody = null;

    apiClient.patch = async (url, body) => {
      capturedUrl = url;
      capturedBody = body;
      return { data: { review: { _id: "rev-1", ...body } } };
    };

    try {
      const updatePayload = {
        rating: 4,
        title: "Updated headline",
        comment: "Updated detailed comment after testing.",
      };

      const res = await reviewService.updateReview("rev-1", updatePayload);
      assert.equal(capturedUrl, "/reviews/rev-1");
      assert.deepEqual(capturedBody, updatePayload);
      assert.equal(res.data.review.rating, 4);
    } finally {
      apiClient.patch = originalPatch;
    }
  });

  test("reviewService.markHelpful calls POST /reviews/:reviewId/helpful", async () => {
    const originalPost = apiClient.post;
    let capturedUrl = null;

    apiClient.post = async (url) => {
      capturedUrl = url;
      return { data: { helpfulCount: 1 } };
    };

    try {
      const res = await reviewService.markHelpful("rev-1");
      assert.equal(capturedUrl, "/reviews/rev-1/helpful");
      assert.equal(res.data.helpfulCount, 1);
    } finally {
      apiClient.post = originalPost;
    }
  });
});
