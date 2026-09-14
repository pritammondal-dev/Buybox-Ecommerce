"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "../../../hooks/useCart.js";
import { useCartStore } from "../../../stores/cart.store.js";
import { CartItem } from "./CartItem.jsx";
import { CartSummary } from "./CartSummary.jsx";
import { CartEmptyState } from "./CartEmptyState.jsx";
import { CartSkeleton } from "./CartSkeleton.jsx";
import { ClearCartModal } from "./ClearCartModal.jsx";
import { Button } from "../../ui/Button.jsx";

export function CartPageView() {
  const {
    items = [],
    itemCount = 0,
    subtotal = 0,
    isHydrated,
    isLoading,
    updateQuantity,
    removeItem,
    clearCart,
  } = useCart();

  const serverCart = useCartStore((state) => state.serverCart);

  const [updatingVariantId, setUpdatingVariantId] = useState(null);
  const [removingVariantId, setRemovingVariantId] = useState(null);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Authoritative server cart totals when available
  const serverSubtotal = serverCart?.subtotal?.$numberDecimal || serverCart?.subtotal;
  const serverDiscount = serverCart?.discountTotal?.$numberDecimal || serverCart?.discountTotal;
  const serverTax = serverCart?.taxTotal?.$numberDecimal || serverCart?.taxTotal;
  const serverShipping = serverCart?.shippingTotal?.$numberDecimal || serverCart?.shippingTotal;
  const serverGrandTotal = serverCart?.grandTotal?.$numberDecimal || serverCart?.grandTotal;

  const effectiveSubtotal = serverSubtotal !== undefined ? serverSubtotal : subtotal;

  const handleQuantityChange = async (variantId, newQuantity) => {
    if (updatingVariantId) return;
    setUpdatingVariantId(variantId);
    try {
      await updateQuantity({ productVariantId: variantId, quantity: newQuantity });
    } catch (err) {
      toast.error(err?.message || "Could not update item quantity.");
    } finally {
      setUpdatingVariantId(null);
    }
  };

  const handleRemoveItem = async (variantId, title) => {
    if (removingVariantId) return;
    setRemovingVariantId(variantId);
    try {
      await removeItem({ productVariantId: variantId });
      toast.info("Item removed from cart", {
        description: title ? `${title} was removed.` : undefined,
      });
    } catch (err) {
      toast.error(err?.message || "Could not remove item.");
    } finally {
      setRemovingVariantId(null);
    }
  };

  const handleConfirmClearCart = async () => {
    setIsClearing(true);
    try {
      await clearCart();
      setIsClearModalOpen(false);
      toast.info("Shopping cart cleared");
    } catch (err) {
      toast.error(err?.message || "Could not clear cart.");
    } finally {
      setIsClearing(false);
    }
  };

  if (!isHydrated) {
    return <CartSkeleton />;
  }

  if (items.length === 0) {
    return <CartEmptyState />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-[#007A55] transition-colors">
          Home
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-900">Shopping Cart</span>
      </nav>

      {/* Cart Page Title & Actions */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            Shopping Cart
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {itemCount} {itemCount === 1 ? "item" : "items"} ready for checkout
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsClearModalOpen(true)}
          className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer flex items-center gap-1.5"
        >
          <Trash2 className="size-3.5" />
          <span>Clear Cart</span>
        </Button>
      </div>

      {/* Main Two-Column Cart Grid */}
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10 items-start">
        {/* Left Column: Cart Items (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {items.map((item) => {
            const variantId = item.productVariantId;
            return (
              <CartItem
                key={variantId}
                item={item}
                onQuantityChange={handleQuantityChange}
                onRemove={handleRemoveItem}
                isUpdating={updatingVariantId === variantId}
                isRemoving={removingVariantId === variantId}
              />
            );
          })}

          <div className="pt-4 flex items-center justify-between">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 text-xs font-bold text-[#007A55] hover:underline"
            >
              <ArrowLeft className="size-3.5" />
              <span>Continue Shopping</span>
            </Link>
          </div>
        </div>

        {/* Right Column: Order Summary (4 cols) */}
        <div className="lg:col-span-4 lg:sticky lg:top-28">
          <CartSummary
            subtotal={effectiveSubtotal}
            discountTotal={serverDiscount || 0}
            taxTotal={serverTax || 0}
            shippingTotal={serverShipping || 0}
            grandTotal={serverGrandTotal}
            itemCount={itemCount}
            isDisabled={isLoading || updatingVariantId !== null || removingVariantId !== null}
          />
        </div>
      </div>

      {/* Clear Cart Confirmation Dialog */}
      <ClearCartModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={handleConfirmClearCart}
        isClearing={isClearing}
      />
    </div>
  );
}

export default CartPageView;
