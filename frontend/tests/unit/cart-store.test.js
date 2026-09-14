// Mock localStorage for Node test runner
if (typeof globalThis.localStorage === "undefined") {
  const memoryStore = new Map();
  const mockStorage = {
    getItem: (key) => memoryStore.get(key) || null,
    setItem: (key, value) => memoryStore.set(key, String(value)),
    removeItem: (key) => memoryStore.delete(key),
    clear: () => memoryStore.clear(),
  };
  globalThis.localStorage = mockStorage;
  globalThis.window = { localStorage: mockStorage };
}

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useCartStore } from "../../src/stores/cart.store.js";
import { cartService } from "../../src/services/cart.service.js";

describe("Cart Store & Guest Architecture Unit Tests", () => {
  beforeEach(() => {
    useCartStore.setState({
      guestCart: { items: [] },
      serverCart: null,
      isLoading: false,
      isMigrating: false,
      error: null,
    });
  });

  test("adds item to guest cart when unauthenticated", async () => {
    await useCartStore.getState().addItem(
      {
        productVariantId: "var-101",
        quantity: 2,
        itemSnapshot: { title: "Wireless Mouse", price: 1500 },
      },
      false // isAuthenticated = false
    );

    const items = useCartStore.getState().getItems(false);
    assert.equal(items.length, 1);
    assert.equal(items[0].productVariantId, "var-101");
    assert.equal(items[0].quantity, 2);
    assert.equal(items[0].price, 1500);

    const totalCount = useCartStore.getState().getItemCount(false);
    assert.equal(totalCount, 2);

    const subtotal = useCartStore.getState().getSubtotal(false);
    assert.equal(subtotal, 3000);
  });

  test("increments quantity when adding duplicate item to guest cart", async () => {
    await useCartStore.getState().addItem(
      { productVariantId: "var-202", quantity: 1, itemSnapshot: { price: 500 } },
      false
    );
    await useCartStore.getState().addItem(
      { productVariantId: "var-202", quantity: 3, itemSnapshot: { price: 500 } },
      false
    );

    const items = useCartStore.getState().getItems(false);
    assert.equal(items.length, 1);
    assert.equal(items[0].quantity, 4);

    const subtotal = useCartStore.getState().getSubtotal(false);
    assert.equal(subtotal, 2000);
  });

  test("updates item quantity and removes when quantity is zero", async () => {
    await useCartStore.getState().addItem(
      { productVariantId: "var-303", quantity: 5, itemSnapshot: { price: 100 } },
      false
    );

    await useCartStore.getState().updateQuantity(
      { productVariantId: "var-303", quantity: 2 },
      false
    );

    let items = useCartStore.getState().getItems(false);
    assert.equal(items[0].quantity, 2);

    // Setting quantity to 0 removes the item
    await useCartStore.getState().updateQuantity(
      { productVariantId: "var-303", quantity: 0 },
      false
    );

    items = useCartStore.getState().getItems(false);
    assert.equal(items.length, 0);
  });

  test("removes item from guest cart explicitly", async () => {
    await useCartStore.getState().addItem(
      { productVariantId: "var-401", quantity: 1 },
      false
    );
    await useCartStore.getState().addItem(
      { productVariantId: "var-402", quantity: 1 },
      false
    );

    assert.equal(useCartStore.getState().getItems(false).length, 2);

    await useCartStore.getState().removeItem(
      { productVariantId: "var-401" },
      false
    );

    const items = useCartStore.getState().getItems(false);
    assert.equal(items.length, 1);
    assert.equal(items[0].productVariantId, "var-402");
  });

  test("maintains clear separation between guest cart and authenticated server cart", () => {
    // Guest cart has items
    useCartStore.setState({
      guestCart: {
        items: [{ productVariantId: "guest-var-1", quantity: 2, price: 100 }],
      },
      serverCart: {
        items: [{ productVariantId: "server-var-99", quantity: 5, unitPrice: 200 }],
        subtotal: "1000.00",
        itemCount: 5,
      },
    });

    // When queried as guest
    const guestItems = useCartStore.getState().getItems(false);
    assert.equal(guestItems[0].productVariantId, "guest-var-1");
    assert.equal(useCartStore.getState().getItemCount(false), 2);

    // When queried as authenticated
    const serverItems = useCartStore.getState().getItems(true);
    assert.equal(serverItems[0].productVariantId, "server-var-99");
    assert.equal(useCartStore.getState().getItemCount(true), 5);
    assert.equal(useCartStore.getState().getSubtotal(true), 1000);
  });

  test("migrateGuestCartToServer replays items safely without losing failed items", async () => {
    useCartStore.setState({
      guestCart: {
        items: [
          { productVariantId: "var-success-1", quantity: 2 },
          { productVariantId: "var-fail-2", quantity: 1 },
        ],
      },
    });

    const originalAddItem = cartService.addItem;
    const originalGetCart = cartService.getCart;

    // Mock backend responses
    cartService.addItem = async ({ productVariantId, quantity }) => {
      if (productVariantId === "var-fail-2") {
        const err = new Error("Product variant is out of stock");
        err.response = {
          status: 400,
          data: {
            success: false,
            message: "Product variant is out of stock",
            code: "INSUFFICIENT_STOCK",
          },
        };
        throw err;
      }
      return { success: true, data: { cart: { items: [{ productVariantId, quantity }] } } };
    };

    cartService.getCart = async () => ({
      success: true,
      data: { cart: { items: [{ productVariantId: "var-success-1", quantity: 2 }] } },
    });

    try {
      const result = await useCartStore.getState().migrateGuestCartToServer();

      assert.equal(result.migratedCount, 1);
      assert.equal(result.failedItems.length, 1);
      assert.equal(result.failedItems[0].item.productVariantId, "var-fail-2");

      // The successfully migrated item is removed, the failed item is preserved!
      const remainingGuestItems = useCartStore.getState().guestCart.items;
      assert.equal(remainingGuestItems.length, 1);
      assert.equal(remainingGuestItems[0].productVariantId, "var-fail-2");
    } finally {
      cartService.addItem = originalAddItem;
      cartService.getCart = originalGetCart;
    }
  });
});
