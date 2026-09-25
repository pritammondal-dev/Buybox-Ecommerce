import { create } from "zustand";
import { addressService } from "../services/address.service.js";

const STORAGE_KEY = "buybox_delivery_address_id";

/**
 * Global Zustand Store for Customer Delivery Addresses
 *
 * Manages customer saved addresses, dynamic delivery address selection for the navbar,
 * and maintains reactive consistency when addresses are created, edited, or deleted.
 */
export const useAddressStore = create((set, get) => ({
  addresses: [],
  selectedAddressId: null,
  isLoading: false,
  isHydrated: false,
  error: null,

  /**
   * Fetch all saved addresses for the authenticated customer.
   * Resolves and sets active delivery address.
   */
  fetchAddresses: async (force = false) => {
    if (get().addresses.length > 0 && !force && get().isHydrated) {
      return get().addresses;
    }

    set({ isLoading: true, error: null });

    try {
      const res = await addressService.getAddresses();
      const list = res?.data?.addresses || (Array.isArray(res?.data) ? res.data : []);
      const validAddresses = Array.isArray(list) ? list : [];

      // Determine active selected address
      let currentSelectedId = get().selectedAddressId;
      if (!currentSelectedId && typeof window !== "undefined") {
        try {
          currentSelectedId = localStorage.getItem(STORAGE_KEY);
        } catch {
          // Ignore localStorage errors
        }
      }

      // Verify that currentSelectedId exists in the fetched list
      const matched = validAddresses.find(
        (a) => (a._id || a.id) === currentSelectedId
      );

      if (!matched && validAddresses.length > 0) {
        // Fallback to default address or first address
        const defaultAddr = validAddresses.find((a) => a.isDefault) || validAddresses[0];
        currentSelectedId = defaultAddr?._id || defaultAddr?.id || null;
        if (currentSelectedId && typeof window !== "undefined") {
          try {
            localStorage.setItem(STORAGE_KEY, currentSelectedId);
          } catch {
            // Ignore
          }
        }
      } else if (validAddresses.length === 0) {
        currentSelectedId = null;
      }

      set({
        addresses: validAddresses,
        selectedAddressId: currentSelectedId,
        isLoading: false,
        isHydrated: true,
      });

      return validAddresses;
    } catch (err) {
      set({
        error: err?.message || "Failed to load addresses",
        isLoading: false,
        isHydrated: true,
      });
      return [];
    }
  },

  /**
   * Set active delivery address by ID
   */
  setSelectedAddressId: (id) => {
    set({ selectedAddressId: id });
    if (typeof window !== "undefined") {
      try {
        if (id) {
          localStorage.setItem(STORAGE_KEY, id);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // Ignore
      }
    }
  },

  /**
   * Get the currently active delivery address object
   */
  getSelectedAddress: () => {
    const { addresses, selectedAddressId } = get();
    if (!addresses || addresses.length === 0) return null;
    return (
      addresses.find((a) => (a._id || a.id) === selectedAddressId) ||
      addresses.find((a) => a.isDefault) ||
      addresses[0] ||
      null
    );
  },

  /**
   * Reset store on logout
   */
  clear: () => {
    set({
      addresses: [],
      selectedAddressId: null,
      isLoading: false,
      isHydrated: false,
      error: null,
    });
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore
      }
    }
  },
}));

export default useAddressStore;
