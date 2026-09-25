"use client";

import React from "react";
import { toast } from "sonner";
import { useCart } from "../../../hooks/useCart.js";
import { useWishlist } from "../../../hooks/useWishlist.js";
import { DealsPromoRow } from "./DealsPromoRow.jsx";
import { MidPageBanners } from "./MidPageBanners.jsx";
import { FeaturedProductsSection } from "./FeaturedProductsSection.jsx";
import { NewArrivalsSection } from "./NewArrivalsSection.jsx";
import { CategoryBannersRow } from "./CategoryBannersRow.jsx";
import { FeaturedBrands } from "./FeaturedBrands.jsx";
import { BestSellersSection } from "./BestSellersSection.jsx";
import { BottomPromosRow } from "./BottomPromosRow.jsx";
import { RecentlyViewedSection } from "./RecentlyViewedSection.jsx";
import { SecondaryTrustBar } from "./SecondaryTrustBar.jsx";
import { NewsletterSection } from "./NewsletterSection.jsx";

export function HomeClientWrapper({
  initialBanners = [],
  initialFeaturedProducts = [],
  initialBestSellers = [],
  initialNewArrivals = [],
  initialHotDeals = [],
  initialFlashSale = [],
  initialRecentlyViewed = [],
  initialBrands = [],
}) {
  const { addItem: addCartItem } = useCart();
  const {
    items: wishlistItems,
    addItem: addWishlistItem,
    removeItem: removeWishlistItem,
  } = useWishlist();

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
      {/* 8. Tri-Promo Row: Today's Hot Deals + Flash Sale + Bank Offers */}
      <DealsPromoRow
        hotDealsProducts={initialHotDeals}
        flashSaleProducts={initialFlashSale}
      />

      {/* 9. Middle Double Banner: Work Smarter + Stylish Looks */}
      <MidPageBanners banners={initialBanners} />

      {/* 10. Featured Products (Horizontal Product Carousel with 5 cards) */}
      <FeaturedProductsSection
        initialProducts={initialFeaturedProducts}
        wishlistVariantIds={wishlistItems}
        onWishlistToggle={handleWishlistToggle}
        onAddToCart={handleAddToCart}
      />

      {/* 11. New Arrivals (Horizontal Product Carousel with 5 cards) */}
      <NewArrivalsSection
        initialProducts={initialNewArrivals}
        wishlistVariantIds={wishlistItems}
        onWishlistToggle={handleWishlistToggle}
        onAddToCart={handleAddToCart}
      />

      {/* 12. Tri-Promo Category Banners: Audio + Workspace + Smart Living */}
      <CategoryBannersRow banners={initialBanners} />

      {/* 13. Shop by Brand (Brand Partner Cards) */}
      <FeaturedBrands initialBrands={initialBrands} />

      {/* 14. Best Sellers (Horizontal Product Carousel with 5 cards) */}
      <BestSellersSection
        initialProducts={initialBestSellers}
        wishlistVariantIds={wishlistItems}
        onWishlistToggle={handleWishlistToggle}
        onAddToCart={handleAddToCart}
      />

      {/* 15. Bottom Tri-Banner Deals: Home & Kitchen + Smart Gadgets + Monsoon Special */}
      <BottomPromosRow banners={initialBanners} />

      {/* 16. Recently Viewed (Horizontal Product Carousel) */}
      <RecentlyViewedSection
        initialProducts={initialRecentlyViewed}
        wishlistVariantIds={wishlistItems}
        onWishlistToggle={handleWishlistToggle}
        onAddToCart={handleAddToCart}
      />

      {/* 17. Secondary Trust Bar (Why Buybox? Soft Green Strip) */}
      <SecondaryTrustBar />

      {/* 18. Newsletter Subscription Strip */}
      <NewsletterSection />
    </div>
  );
}

export default HomeClientWrapper;
