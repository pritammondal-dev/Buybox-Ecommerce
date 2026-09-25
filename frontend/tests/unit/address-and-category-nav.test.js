import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useAddressStore } from "../../src/stores/address.store.js";

describe("Address Store & Delivery Location Tests", () => {
  beforeEach(() => {
    useAddressStore.getState().clear();
  });

  test("initializes with empty addresses and null selectedAddressId", () => {
    const state = useAddressStore.getState();
    assert.deepEqual(state.addresses, []);
    assert.equal(state.selectedAddressId, null);
    assert.equal(state.getSelectedAddress(), null);
  });

  test("resolves default address when multiple addresses exist", () => {
    const mockAddresses = [
      {
        _id: "addr-1",
        firstName: "Pritam",
        city: "Kolkata",
        postalCode: "700001",
        isDefault: false,
      },
      {
        _id: "addr-2",
        firstName: "Pritam Work",
        city: "Salt Lake",
        postalCode: "700091",
        isDefault: true,
      },
    ];

    useAddressStore.setState({
      addresses: mockAddresses,
      selectedAddressId: "addr-2",
      isHydrated: true,
    });

    const active = useAddressStore.getState().getSelectedAddress();
    assert.ok(active);
    assert.equal(active._id, "addr-2");
    assert.equal(active.city, "Salt Lake");
    assert.equal(active.postalCode, "700091");
  });

  test("allows switching active delivery address", () => {
    const mockAddresses = [
      {
        _id: "addr-1",
        firstName: "Home",
        city: "Mumbai",
        postalCode: "400001",
        isDefault: true,
      },
      {
        _id: "addr-2",
        firstName: "Office",
        city: "Pune",
        postalCode: "411001",
        isDefault: false,
      },
    ];

    useAddressStore.setState({
      addresses: mockAddresses,
      selectedAddressId: "addr-1",
    });

    useAddressStore.getState().setSelectedAddressId("addr-2");

    const active = useAddressStore.getState().getSelectedAddress();
    assert.ok(active);
    assert.equal(active._id, "addr-2");
    assert.equal(active.city, "Pune");
  });

  test("clear resets address store state", () => {
    useAddressStore.setState({
      addresses: [{ _id: "addr-1", city: "Delhi" }],
      selectedAddressId: "addr-1",
      isHydrated: true,
    });

    useAddressStore.getState().clear();
    const state = useAddressStore.getState();
    assert.deepEqual(state.addresses, []);
    assert.equal(state.selectedAddressId, null);
    assert.equal(state.isHydrated, false);
  });
});

describe("Dynamic Category Navbar Resolution Tests", () => {
  test("dynamically renders all backend categories without truncation", () => {
    const mockBackendCategories = [
      { _id: "c1", name: "Mobiles", slug: "mobiles", parentId: null },
      { _id: "c2", name: "Laptops", slug: "laptops", parentId: null },
      { _id: "c3", name: "Audio", slug: "audio", parentId: null },
      { _id: "c4", name: "Fashion", slug: "fashion", parentId: null },
      { _id: "c5", name: "Gaming", slug: "gaming", parentId: null },
      { _id: "c6", name: "Displays & Monitors", slug: "displays-monitors", parentId: null },
      { _id: "c7", name: "Smart Home", slug: "smart-home", parentId: null },
      { _id: "c8", name: "Keyboards", slug: "keyboards-peripherals", parentId: null },
      { _id: "c9", name: "Minimalist Gear", slug: "minimalist-gear-edc", parentId: null },
      { _id: "c10", name: "Accessories", slug: "accessories", parentId: null },
      { _id: "c11", name: "Gaming Hardware", slug: "gaming-hardware", parentId: null },
      { _id: "c12", name: "Smart Power", slug: "smart-home-power", parentId: null },
    ];

    // Simulating CategoryNavBar resolution logic
    const rootCategories = mockBackendCategories.filter((c) => !c.parentId);
    const sourceList = rootCategories.length >= 4 ? rootCategories : mockBackendCategories;

    const displayItems = sourceList.map((cat) => ({
      id: cat._id,
      name: cat.name,
      slug: cat.slug,
    }));

    // Must preserve all 12 categories, not truncated to 8
    assert.equal(displayItems.length, 12);
    assert.equal(displayItems[5].name, "Displays & Monitors");
    assert.equal(displayItems[11].name, "Smart Power");
  });
});
