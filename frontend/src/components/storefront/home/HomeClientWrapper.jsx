"use client";

import React from "react";
import { toast } from "sonner";
import { useCart } from "../../../hooks/useCart.js";
import { useWishlist } from "../../../hooks/useWishlist.js";
import { FlashSaleSection } from "./FlashSaleSection.jsx";
import { FlashDealSection } from "./FlashDealSection.jsx";
import { BentoPromoGrid } from "./BentoPromoGrid.jsx";
import { FeaturedProductsSection } from "./FeaturedProductsSection.jsx";
import { BestSellersSection } from "./BestSellersSection.jsx";
import { NewArrivalsSection } from "./NewArrivalsSection.jsx";
import { RecentlyViewedSection } from "./RecentlyViewedSection.jsx";
import { ExploreMoreSection } from "./ExploreMoreSection.jsx";
import { TrustSection } from "./TrustSection.jsx";

export function HomeClientWrapper({
  initialFlashDeals = [],
  initialFeaturedProducts = [],
  initialBestSellers = [],
  initialNewArrivals = [],
  initialCampaign = null,
}) {
  const { addItem: addCartItem } = useCart();
  const { items: wishlistItems, addItem: addWishlistItem, removeItem: removeWishlistItem } = useWishlist();

  // Deduplicate product IDs shown in earlier sections
  const displayedIds = React.useMemo(() => {
    const ids = new Set();
    (initialFlashDeals || []).forEach((p) => {
      const id = p._id || p.id;
      if (id) ids.add(id);
    });
    (initialFeaturedProducts || []).forEach((p) => {
      const id = p._id || p.id;
      if (id) ids.add(id);
    });
    (initialNewArrivals || []).forEach((p) => {
      const id = p._id || p.id;
      if (id) ids.add(id);
    });
    (initialBestSellers || []).forEach((p) => {
      const id = p._id || p.id;
      if (id) ids.add(id);
    });
    return Array.from(ids);
  }, [initialFlashDeals, initialFeaturedProducts, initialNewArrivals, initialBestSellers]);

  const handleWishlistToggle = async (product, isWishlisted) => {
    const id = product._id || product.id;
    try {
      if (isWishlisted) {
        await addWishlistItem(id);
        toast.success("Added to wishlist", {
          description: `${product.name} was saved to your wishlist.`,
        });
      } else {
        await removeWishlistItem(id);
        toast.info("Removed from wishlist", {
          description: `${product.name} was removed from your wishlist.`,
        });
      }
    } catch {
      toast.error("Could not update wishlist. Please try again.");
    }
  };

  const handleAddToCart = async (product) => {
    try {
      const productId = product._id || product.id;
      const productVariantId =
        product.productVariantId ||
        product.defaultVariantId ||
        undefined;
      await addCartItem({
        ...(productVariantId ? { productVariantId } : {}),
        productId,
        quantity: 1,
        itemSnapshot: {
          name: product.name,
          price: product.price,
          image: product.images?.[0]?.url || product.image || null,
          sku: product.sku,
        },
      });
      toast.success("Added to cart", {
        description: `${product.name} was added to your shopping cart.`,
      });
    } catch {
      toast.error("Could not add item to cart. Please try again.");
    }
  };

  return (
    <div className="flex flex-col">
      {/* 1. Flash Sale (Campaign-backed; null if no active campaign in backend) */}
      <FlashSaleSection
        campaign={initialCampaign}
        wishlistVariantIds={wishlistItems}
        onWishlistToggle={handleWishlistToggle}
        onAddToCart={handleAddToCart}
      />

      {/* 2. Today's Hot Deals (Warm Cream background, genuine discount filter) */}
      <FlashDealSection
        initialProducts={initialFlashDeals}
        wishlistVariantIds={wishlistItems}
        onWishlistToggle={handleWishlistToggle}
        onAddToCart={handleAddToCart}
      />

      {/* 3. Bento Promotional Highlights */}
      <div className="py-2 sm:py-4">
        <BentoPromoGrid />
      </div>

      {/* 4. Featured Products (Slate Neutral background) */}
      <FeaturedProductsSection
        initialProducts={initialFeaturedProducts}
        wishlistVariantIds={wishlistItems}
        onWishlistToggle={handleWishlistToggle}
        onAddToCart={handleAddToCart}
      />

      {/* 5. Best Sellers (Gracefully hidden if not configured in CMS) */}
      <BestSellersSection
        initialProducts={initialBestSellers}
        wishlistVariantIds={wishlistItems}
        onWishlistToggle={handleWishlistToggle}
        onAddToCart={handleAddToCart}
      />

      {/* 6. New Arrivals (Soft Emerald background) */}
      <NewArrivalsSection
        initialProducts={initialNewArrivals}
        wishlistVariantIds={wishlistItems}
        onWishlistToggle={handleWishlistToggle}
        onAddToCart={handleAddToCart}
      />

      {/* 7. Recently Viewed Products (Soft Stone background, client-side history) */}
      <RecentlyViewedSection
        wishlistVariantIds={wishlistItems}
        onWishlistToggle={handleWishlistToggle}
        onAddToCart={handleAddToCart}
      />

      {/* 8. Explore More Products (Crisp White background, deduplicated) */}
      <ExploreMoreSection
        excludeIds={displayedIds}
        wishlistVariantIds={wishlistItems}
        onWishlistToggle={handleWishlistToggle}
        onAddToCart={handleAddToCart}
      />

      {/* 9. Continuous Trust Ticker & Verified Badges */}
      <TrustSection />
    </div>
  );
}

export default HomeClientWrapper;
