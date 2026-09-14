import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useWishlistStore } from "../../src/stores/wishlist.store.js";
import { wishlistService } from "../../src/services/wishlist.service.js";

describe("Wishlist Store Removal Contract Tests", () => {
  const originalRemoveItem = wishlistService.removeItem;

  beforeEach(() => {
    useWishlistStore.setState({
      serverWishlist: {
        _id: "wishlist-doc-1",
        items: [
          {
            _id: "item-subdoc-1",
            productId: "prod-unpopulated-100",
            productVariantId: null,
          },
          {
            _id: "item-subdoc-2",
            productId: {
              _id: "prod-populated-200",
              name: "Populated Product",
            },
            productVariantId: null,
          },
        ],
      },
      guestWishlist: {
        itemVariantIds: ["guest-prod-1", "guest-prod-2"],
      },
      isLoading: false,
      error: null,
    });
  });

  test("1. resolves unpopulated productId string to matching wishlist subdocument item _id", async () => {
    let capturedItemId = null;
    wishlistService.removeItem = async (itemId) => {
      capturedItemId = itemId;
      return { success: true };
    };

    try {
      await useWishlistStore.getState().removeItem("prod-unpopulated-100", true);
      assert.equal(capturedItemId, "item-subdoc-1");
      const remainingItems = useWishlistStore.getState().serverWishlist.items;
      assert.equal(remainingItems.length, 1);
      assert.equal(remainingItems[0]._id, "item-subdoc-2");
    } finally {
      wishlistService.removeItem = originalRemoveItem;
    }
  });

  test("2. resolves populated productId object to matching wishlist subdocument item _id", async () => {
    let capturedItemId = null;
    wishlistService.removeItem = async (itemId) => {
      capturedItemId = itemId;
      return { success: true };
    };

    try {
      await useWishlistStore.getState().removeItem("prod-populated-200", true);
      assert.equal(capturedItemId, "item-subdoc-2");
      const remainingItems = useWishlistStore.getState().serverWishlist.items;
      assert.equal(remainingItems.length, 1);
      assert.equal(remainingItems[0]._id, "item-subdoc-1");
    } finally {
      wishlistService.removeItem = originalRemoveItem;
    }
  });

  test("3. passes through direct item _id when already known", async () => {
    let capturedItemId = null;
    wishlistService.removeItem = async (itemId) => {
      capturedItemId = itemId;
      return { success: true };
    };

    try {
      await useWishlistStore.getState().removeItem("item-subdoc-1", true);
      assert.equal(capturedItemId, "item-subdoc-1");
      const remainingItems = useWishlistStore.getState().serverWishlist.items;
      assert.equal(remainingItems.length, 1);
      assert.equal(remainingItems[0]._id, "item-subdoc-2");
    } finally {
      wishlistService.removeItem = originalRemoveItem;
    }
  });

  test("4. gracefully ignores items not present in wishlist without failing", async () => {
    let callCount = 0;
    wishlistService.removeItem = async () => {
      callCount++;
      return { success: true };
    };

    try {
      await useWishlistStore.getState().removeItem("non-existent-prod", true);
      assert.equal(callCount, 0);
      assert.equal(useWishlistStore.getState().serverWishlist.items.length, 2);
    } finally {
      wishlistService.removeItem = originalRemoveItem;
    }
  });

  test("5. guest wishlist removal removes by ID directly", async () => {
    await useWishlistStore.getState().removeItem("guest-prod-1", false);
    assert.deepEqual(useWishlistStore.getState().guestWishlist.itemVariantIds, ["guest-prod-2"]);
  });
});
