"use client";

import React from "react";
import Link from "next/link";
import { ShoppingBag, ArrowRight, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "../ui/Sheet.jsx";
import { Button } from "../ui/Button.jsx";
import { QuantitySelector } from "./QuantitySelector.jsx";
import { formatCurrency } from "../../utils/formatCurrency.js";
import { useCart } from "../../hooks/useCart.js";
import { cn } from "../../utils/cn.js";

export function CartDrawer({ isOpen, onClose }) {
  const {
    items = [],
    itemCount = 0,
    subtotal = 0,
    isLoading,
    updateQuantity,
    removeItem,
  } = useCart();

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="right"
        onClose={onClose}
        className="w-full sm:max-w-md flex flex-col justify-between p-0"
      >
        {/* Header */}
        <SheetHeader className="p-5 border-b">
          <SheetTitle className="flex items-center gap-2 text-lg font-bold">
            <ShoppingBag className="size-5 text-primary" />
            <span>Shopping Cart ({itemCount})</span>
          </SheetTitle>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center p-6">
              <div className="size-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-4">
                <ShoppingBag className="size-8" />
              </div>
              <h4 className="text-base font-semibold text-foreground">Your cart is empty</h4>
              <p className="mt-1 text-sm text-muted-foreground max-w-xs">
                Looks like you haven&apos;t added any items to your cart yet.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-5"
                onClick={onClose}
                asChild
              >
                <Link href="/shop">Start Shopping</Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {items.map((item, idx) => {
                const variantId =
                  item.productVariantId?._id || item.productVariantId || item.id || `item-${idx}`;
                const title =
                  item.productVariantId?.sku || item.name || item.title || "Product Item";
                const price =
                  item.unitPrice || item.price || item.productVariantId?.price || 0;
                const image =
                  item.image || item.productVariantId?.images?.[0]?.url || null;

                return (
                  <div key={variantId} className="flex gap-4 py-4 first:pt-0">
                    <div className="size-20 shrink-0 rounded-md border bg-muted/30 overflow-hidden flex items-center justify-center">
                      {image ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={image}
                          alt={title}
                          className="size-full object-cover"
                        />
                      ) : (
                        <ShoppingBag className="size-6 text-muted-foreground" />
                      )}
                    </div>

                    <div className="flex flex-1 flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h5 className="text-sm font-semibold text-foreground line-clamp-1">
                            {title}
                          </h5>
                          <button
                            type="button"
                            onClick={() => removeItem({ productVariantId: variantId })}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            aria-label="Remove item"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                        <p className="mt-1 text-sm font-bold text-foreground">
                          {formatCurrency(price)}
                        </p>
                      </div>

                      <div className="mt-2 flex items-center justify-between">
                        <QuantitySelector
                          value={item.quantity}
                          onChange={(qty) =>
                            updateQuantity({ productVariantId: variantId, quantity: qty })
                          }
                          size="sm"
                          disabled={isLoading}
                        />
                        <span className="text-xs font-semibold text-muted-foreground">
                          Total: {formatCurrency(price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <SheetFooter className="p-5 border-t bg-muted/20 flex flex-col gap-3">
            <div className="space-y-1.5 w-full text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="font-semibold text-foreground">
                  {formatCurrency(subtotal)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Shipping & Taxes</span>
                <span>Calculated at checkout</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full mt-2">
              <Button asChild size="lg" className="w-full gap-2 shadow-sm" onClick={onClose}>
                <Link href="/checkout">
                  Proceed to Checkout
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="w-full" onClick={onClose}>
                <Link href="/cart">View Full Cart</Link>
              </Button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default CartDrawer;
