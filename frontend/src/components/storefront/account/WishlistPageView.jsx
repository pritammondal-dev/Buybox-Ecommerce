"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, ArrowRight, RefreshCw, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useWishlist } from "../../../hooks/useWishlist.js";
import { useCart } from "../../../hooks/useCart.js";
import { productService } from "../../../services/product.service.js";
import { ProductCard } from "../ProductCard.jsx";
import { AccountNav } from "./AccountNav.jsx";

export function WishlistPageView() {
  const pathname = usePathname();
  const isAccountRoute = pathname?.startsWith("/account");

  const { items = [], isHydrated, isAuthenticated, removeItem: removeWishlistItem } = useWishlist();
  const { addItem: addCartItem } = useCart();

  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isHydrated) return;
    let isMounted = true;

    async function resolveWishlist() {
      if (items.length === 0) {
        if (isMounted) {
          setProducts([]);
          setIsLoading(false);
        }
        return;
      }

      // If authenticated and productId is already populated as an object on wishlist items
      if (isAuthenticated) {
        const loadedProducts = [];
        const missingProductIds = [];

        items.forEach((it) => {
          if (it?.productId && typeof it.productId === "object") {
            loadedProducts.push({
              ...it.productId,
              wishlistItemId: it._id,
              productVariantId: it.productVariantId?._id || it.productVariantId || null,
            });
          } else if (it?.productId && typeof it.productId === "string") {
            missingProductIds.push({ id: it.productId, wishlistItemId: it._id });
          }
        });

        if (missingProductIds.length > 0) {
          const results = await Promise.allSettled(
            missingProductIds.map((item) =>
              productService.getProductById(item.id).then((res) => ({
                product: res?.data?.product || res?.data,
                wishlistItemId: item.wishlistItemId,
              }))
            )
          );
          if (!isMounted) return;
          const additional = results
            .filter((r) => r.status === "fulfilled" && r.value?.product)
            .map((r) => ({
              ...r.value.product,
              wishlistItemId: r.value.wishlistItemId,
            }));
          setProducts([...loadedProducts, ...additional]);
          setIsLoading(false);
        } else {
          if (!isMounted) return;
          setProducts(loadedProducts);
          setIsLoading(false);
        }
        return;
      }

      // Guest wishlist: array of product / variant IDs
      const guestIds = items.filter(Boolean);
      const results = await Promise.allSettled(
        guestIds.map((id) => productService.getProductById(id))
      );
      if (!isMounted) return;
      const loaded = results
        .filter((r) => r.status === "fulfilled" && r.value)
        .map((r) => r.value?.data?.product || r.value?.data)
        .filter(Boolean);
      setProducts(loaded);
      setIsLoading(false);
    }

    resolveWishlist();

    return () => {
      isMounted = false;
    };
  }, [items, isHydrated, isAuthenticated]);

  const handleWishlistToggle = async (product) => {
    const removeId = product.wishlistItemId || product._id || product.id;
    try {
      await removeWishlistItem(removeId);
      setProducts((prev) =>
        prev.filter((p) => (p.wishlistItemId || p._id || p.id) !== removeId)
      );
      toast.info("Removed from Wishlist");
    } catch {
      toast.error("Could not remove item from wishlist");
    }
  };

  const handleAddToCart = async (product) => {
    try {
      const prodId = product._id || product.id;
      const variantId =
        product.productVariantId ||
        product.variants?.[0]?._id ||
        undefined;

      await addCartItem({
        productId: prodId,
        ...(variantId ? { productVariantId: variantId } : {}),
        quantity: 1,
        itemSnapshot: {
          name: product.name,
          price: product.price,
          image: product.images?.[0]?.url || product.image || null,
          sku: product.sku,
        },
      });

      toast.success("Added to Shopping Cart", {
        description: `${product.name} is ready for checkout.`,
      });
    } catch (err) {
      toast.error(err?.message || "Could not add item to cart.");
    }
  };

  const content = (
    <div className="space-y-6">
      <div className="pb-4 border-b flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
            My Wishlist
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {products.length} saved {products.length === 1 ? "product" : "products"}
          </p>
        </div>
      </div>

      {!isHydrated || (items.length > 0 && isLoading) ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 sm:gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <ProductCard key={i} isLoading />
          ))}
        </div>
      ) : items.length === 0 || products.length === 0 ? (
        <div className="rounded-2xl border bg-white p-12 text-center space-y-4 shadow-xs">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-pink-50 text-pink-600">
            <Heart className="size-7 stroke-[1.5]" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-black text-slate-950">Your Wishlist is Empty</h2>
            <p className="text-xs text-slate-600 max-w-sm mx-auto">
              Save products you want to track by clicking the heart icon on any product card.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 rounded-full bg-[#007A55] hover:bg-[#004D38] text-white font-bold text-xs px-6 py-2.5 shadow-xs transition-colors"
            >
              Explore Products
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 sm:gap-4">
          {products.map((product) => {
            const id = product._id || product.id;
            return (
              <ProductCard
                key={product.wishlistItemId || id}
                product={product}
                isWishlisted={true}
                onWishlistToggle={() => handleWishlistToggle(product)}
                onAddToCart={() => handleAddToCart(product)}
              />
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-[#007A55] transition-colors">
          Home
        </Link>
        <span>/</span>
        {isAccountRoute && (
          <>
            <Link href="/account" className="hover:text-[#007A55] transition-colors">
              My Account
            </Link>
            <span>/</span>
          </>
        )}
        <span className="font-semibold text-foreground">Wishlist</span>
      </nav>

      {isAccountRoute ? (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <AccountNav />
          </div>
          <div className="lg:col-span-8 rounded-2xl border bg-white p-6 shadow-xs">
            {content}
          </div>
        </div>
      ) : (
        content
      )}
    </div>
  );
}

export default WishlistPageView;
