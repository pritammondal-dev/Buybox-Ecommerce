"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, MapPin, ArrowRight, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../hooks/useAuth.js";
import { useCart } from "../../../hooks/useCart.js";
import { useCheckoutStore } from "../../../stores/checkout.store.js";
import { addressService } from "../../../services/address.service.js";
import { useAddressStore } from "../../../stores/address.store.js";
import { formatCurrency, parsePrice } from "../../../utils/formatCurrency.js";
import { CheckoutStepIndicator } from "./CheckoutStepIndicator.jsx";
import { AddressCard } from "./AddressCard.jsx";
import { AddressForm } from "./AddressForm.jsx";
import { DeleteAddressModal } from "./DeleteAddressModal.jsx";
import { CheckoutEmptyCart } from "./CheckoutEmptyCart.jsx";
import { Button } from "../../ui/Button.jsx";

export function CheckoutAddressPageView() {
  const router = useRouter();
  const { isAuthenticated, isInitialized } = useAuth();
  const { items = [], subtotal = 0, isHydrated } = useCart();
  const {
    selectedAddressId,
    setSelectedAddressId,
    fetchQuote,
    quote,
  } = useCheckoutStore();

  const [addresses, setAddresses] = useState([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true);
  const [isMutatingAddress, setIsMutatingAddress] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [deletingAddress, setDeletingAddress] = useState(null);

  // 1. Load customer addresses
  useEffect(() => {
    let isCancelled = false;
    if (!isAuthenticated) return;

    addressService
      .getAddresses()
      .then((res) => {
        if (isCancelled) return;
        const list = res?.data?.addresses || (Array.isArray(res?.data) ? res.data : []);
        setAddresses(list);

        if (list.length > 0) {
          if (!selectedAddressId || !list.some((a) => (a._id || a.id) === selectedAddressId)) {
            const defaultAddr = list.find((a) => a.isDefault) || list[0];
            setSelectedAddressId(defaultAddr._id || defaultAddr.id);
          }
        }
      })
      .catch(() => {
        if (isCancelled) return;
        setAddresses([]);
      })
      .finally(() => {
        if (isCancelled) return;
        setIsLoadingAddresses(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated, selectedAddressId, setSelectedAddressId]);

  // 2. Fetch authoritative quote when address or cart loads
  useEffect(() => {
    if (isAuthenticated && selectedAddressId) {
      fetchQuote({ shippingAddressId: selectedAddressId });
    }
  }, [isAuthenticated, selectedAddressId, fetchQuote]);

  // Address CRUD Handlers
  const handleCreate = async (payload) => {
    setIsMutatingAddress(true);
    try {
      const res = await addressService.createAddress(payload);
      const created = res?.data?.address || res?.data;
      if (created) {
        const id = created._id || created.id;
        setAddresses((prev) => [...prev, created]);
        setSelectedAddressId(id);
        setIsAddingNew(false);
        toast.success("Delivery address added successfully");
        useAddressStore.getState().fetchAddresses(true).catch(() => {});
        return true;
      }
      return false;
    } catch (err) {
      toast.error(err?.message || "Failed to save address. Please verify your inputs.");
      return false;
    } finally {
      setIsMutatingAddress(false);
    }
  };

  const handleUpdate = async (payload) => {
    const id = editingAddress?._id || editingAddress?.id;
    setIsMutatingAddress(true);
    try {
      const res = await addressService.updateAddress(id, payload);
      const updated = res?.data?.address || res?.data;
      if (updated) {
        setAddresses((prev) =>
          prev.map((a) => ((a._id || a.id) === id ? updated : a))
        );
        setEditingAddress(null);
        toast.success("Address updated successfully");
        useAddressStore.getState().fetchAddresses(true).catch(() => {});
        return true;
      }
      return false;
    } catch (err) {
      toast.error(err?.message || "Failed to update address.");
      return false;
    } finally {
      setIsMutatingAddress(false);
    }
  };

  const handleDelete = async (id) => {
    setIsMutatingAddress(true);
    try {
      await addressService.deleteAddress(id);
      setAddresses((prev) => {
        const next = prev.filter((a) => (a._id || a.id) !== id);
        if (selectedAddressId === id) {
          const nextSelected = next[0]?._id || next[0]?.id || null;
          setSelectedAddressId(nextSelected);
        }
        return next;
      });
      setDeletingAddress(null);
      toast.success("Address removed successfully");
      useAddressStore.getState().fetchAddresses(true).catch(() => {});
      return true;
    } catch (err) {
      toast.error(err?.message || "Failed to delete address.");
      return false;
    } finally {
      setIsMutatingAddress(false);
    }
  };

  const handleContinue = () => {
    if (!selectedAddressId) {
      toast.error("Please select or add a delivery address to proceed.");
      return;
    }
    router.push("/checkout/summary");
  };

  // Auth & Cart Guards
  if (isInitialized && !isAuthenticated) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 text-center">
        <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xs space-y-4">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#004D38]/10 text-[#004D38]">
            <MapPin className="size-6" />
          </div>
          <h2 className="text-lg font-black text-slate-900">Sign in to Checkout</h2>
          <p className="text-xs text-slate-600">
            Please log in to your Buybox account to access your saved delivery addresses.
          </p>
          <Link
            href="/auth/login?redirect=/checkout/address"
            className="block w-full rounded-full bg-[#004D38] hover:bg-[#003D2C] py-3 text-xs font-bold text-white shadow-sm transition-all"
          >
            Sign In to Continue
          </Link>
        </div>
      </div>
    );
  }

  if (isHydrated && items.length === 0) {
    return <CheckoutEmptyCart />;
  }

  const numericSubtotal = quote?.subtotal ? parsePrice(quote.subtotal) : parsePrice(subtotal);
  const estimatedDelivery = quote?.shippingTotal !== undefined
    ? parsePrice(quote.shippingTotal)
    : (numericSubtotal >= 499 ? 0 : 40);
  const estimatedGrandTotal = quote?.grandTotal ? parsePrice(quote.grandTotal) : (numericSubtotal + estimatedDelivery);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Checkout Progress Indicator */}
      <CheckoutStepIndicator currentStep={1} completedSteps={selectedAddressId ? [1] : []} />

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
        {/* Left Column: Address Selection (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="flex size-7 items-center justify-center rounded-full bg-[#004D38] text-white text-xs font-black">
                  1
                </span>
                <div>
                  <h1 className="text-base font-black uppercase tracking-wider text-slate-950">
                    Select Delivery Address
                  </h1>
                  <p className="text-xs text-slate-500">
                    Choose where you want your order delivered or add a new address.
                  </p>
                </div>
              </div>

              {!isAddingNew && !editingAddress && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddingNew(true)}
                  disabled={isLoadingAddresses || isMutatingAddress}
                  className="text-xs font-bold text-[#004D38] hover:text-[#003D2C] gap-1.5"
                >
                  <Plus className="size-4" />
                  Add Address
                </Button>
              )}
            </div>

            {isLoadingAddresses ? (
              <div className="space-y-3 py-4">
                <div className="h-24 bg-slate-100 rounded-xl animate-pulse" />
                <div className="h-24 bg-slate-100 rounded-xl animate-pulse" />
              </div>
            ) : isAddingNew ? (
              <AddressForm
                onSubmit={handleCreate}
                onCancel={() => setIsAddingNew(false)}
                isSubmitting={isMutatingAddress}
              />
            ) : editingAddress ? (
              <AddressForm
                initialData={editingAddress}
                onSubmit={handleUpdate}
                onCancel={() => setEditingAddress(null)}
                isSubmitting={isMutatingAddress}
              />
            ) : addresses.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center space-y-3">
                <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <MapPin className="size-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">No saved addresses found</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Please add a delivery address to complete your order.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsAddingNew(true)}
                  className="bg-[#004D38] hover:bg-[#003D2C] text-white text-xs font-bold"
                >
                  <Plus className="size-3.5 mr-1" />
                  Add New Address
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {addresses.map((addr) => {
                  const id = addr._id || addr.id;
                  const isSelected = selectedAddressId === id;

                  return (
                    <AddressCard
                      key={id}
                      address={addr}
                      isSelected={isSelected}
                      onSelect={(addrId) => setSelectedAddressId(addrId)}
                      onEdit={(a) => setEditingAddress(a)}
                      onDelete={(a) => setDeletingAddress(a)}
                      isActionDisabled={isMutatingAddress}
                    />
                  );
                })}
              </div>
            )}

            {/* Single Primary CTA */}
            {!isAddingNew && !editingAddress && (
              <div className="pt-4 flex items-center justify-end border-t border-slate-100">
                <Button
                  type="button"
                  onClick={handleContinue}
                  disabled={!selectedAddressId || isLoadingAddresses || isMutatingAddress}
                  className="rounded-full bg-[#004D38] hover:bg-[#003D2C] text-white text-xs font-black uppercase tracking-wider px-8 py-3.5 shadow-md active:scale-98 transition-all gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span>Continue to Order Summary</span>
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Price Summary Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-24">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-black text-slate-950 uppercase tracking-wider border-b border-slate-100 pb-3">
              Price Details ({items.length} {items.length === 1 ? "Item" : "Items"})
            </h2>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Items Subtotal</span>
                <span className="font-semibold text-slate-900">{formatCurrency(numericSubtotal)}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Estimated Delivery</span>
                <span className="font-semibold text-slate-900">
                  {estimatedDelivery === 0 ? (
                    <span className="text-[#004D38] font-bold uppercase">FREE</span>
                  ) : (
                    formatCurrency(estimatedDelivery)
                  )}
                </span>
              </div>

              <div className="flex items-baseline justify-between border-t border-slate-200 pt-3 text-sm">
                <span className="font-black text-slate-950">Estimated Total</span>
                <span className="text-xl font-black text-[#004D38] tracking-tight">
                  {formatCurrency(estimatedGrandTotal)}
                </span>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleContinue}
              disabled={!selectedAddressId || isLoadingAddresses || isMutatingAddress}
              className="w-full rounded-full bg-[#004D38] hover:bg-[#003D2C] text-white text-xs font-black uppercase tracking-wider py-3.5 shadow-md active:scale-98 transition-all gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>Continue to Order Summary</span>
              <ArrowRight className="size-4" />
            </Button>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 pt-1">
              <ShieldCheck className="size-4 text-[#004D38]" />
              <span>Safe 256-Bit SSL Encrypted Checkout</span>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Address Modal */}
      <DeleteAddressModal
        isOpen={Boolean(deletingAddress)}
        address={deletingAddress}
        onConfirm={handleDelete}
        onCancel={() => setDeletingAddress(null)}
        isDeleting={isMutatingAddress}
      />
    </div>
  );
}

export default CheckoutAddressPageView;
