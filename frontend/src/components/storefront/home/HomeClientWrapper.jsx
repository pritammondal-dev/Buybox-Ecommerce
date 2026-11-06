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
import { ActiveCampaignsSection } from "./ActiveCampaignsSection.jsx";
import { CustomStorefrontSection } from "./CustomStorefrontSection.jsx";

export function HomeClientWrapper({
  initialBanners = [],
  inactiveSlots = [],
  initialActiveCampaigns = [],
  initialSections = [],
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

  // Find system section configurations if present
  const featuredSec = initialSections.find(
    (s) => s.key === "featured_products" || s.type === "featured_products"
  );
  const newArrivalsSec = initialSections.find(
    (s) => s.key === "new_arrivals" || s.type === "new_arrivals"
  );
  const bestSellersSec = initialSections.find(
    (s) => s.key === "best_sellers" || s.type === "best_sellers"
  );
  const hotDealsSec = initialSections.find(
    (s) => s.key === "flash_deal" || s.type === "flash_deal"
  );
  const flashSaleSec = initialSections.find(
    (s) => s.key === "flash_sale" || s.type === "flash_sale"
  );

  // Custom sections (carousel, grid, category_showcase, brand_showcase, mixed_collection, collection, category, promotional_banner)
  const customSections = initialSections.filter(
    (s) =>
      [
        "carousel",
        "grid",
        "category_showcase",
        "brand_showcase",
        "mixed_collection",
        "collection",
        "category",
        "promotional_banner",
      ].includes(s.type) && s.isActive !== false
  );

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
        },
      });

      toast.success("Added to cart", {
        description: `${product.name} was added to your shopping cart.`,
      });
    } catch {
      toast.error("Could not add item to cart. Please try again.");
    }
  };

  const showHotDealsAndFlash =
    hotDealsSec?.isActive !== false || flashSaleSec?.isActive !== false;
  const showFeatured = featuredSec ? featuredSec.isActive !== false : true;
  const showNewArrivals = newArrivalsSec ? newArrivalsSec.isActive !== false : true;
  const showBestSellers = bestSellersSec ? bestSellersSec.isActive !== false : true;

  return (
    <div className="flex flex-col">
      {/* 8. Tri-Promo Row: Today's Hot Deals + Flash Sale + Bank Offers */}
      {showHotDealsAndFlash && (
        <DealsPromoRow
          hotDealsProducts={initialHotDeals}
          flashSaleProducts={initialFlashSale}
        />
      )}

      {/* 8.5. Active Marketing Campaigns Showcase (if any live campaigns) */}
      <ActiveCampaignsSection campaigns={initialActiveCampaigns} />

      {/* 9. Middle Double Banner: Work Smarter + Stylish Looks */}
      <MidPageBanners banners={initialBanners} inactiveSlots={inactiveSlots} />

      {/* 10. Featured Products (Horizontal Product Carousel with 5 cards) */}
      {showFeatured && (
        <FeaturedProductsSection
          initialProducts={initialFeaturedProducts}
          title={featuredSec?.title}
          subtitle={featuredSec?.subtitle}
          theme={featuredSec?.theme}
          viewAllHref={
            featuredSec?.viewMoreEnabled !== false
              ? (featuredSec?.viewMoreUrl || `/sections/${featuredSec?.key || "featured_products"}`)
              : null
          }
          viewAllText={featuredSec?.viewMoreTitle || "View All"}
          wishlistVariantIds={wishlistItems}
          onWishlistToggle={handleWishlistToggle}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* 11. New Arrivals (Horizontal Product Carousel with 5 cards) */}
      {showNewArrivals && (
        <NewArrivalsSection
          initialProducts={initialNewArrivals}
          title={newArrivalsSec?.title}
          subtitle={newArrivalsSec?.subtitle}
          theme={newArrivalsSec?.theme}
          viewAllHref={
            newArrivalsSec?.viewMoreEnabled !== false
              ? (newArrivalsSec?.viewMoreUrl || `/sections/${newArrivalsSec?.key || "new_arrivals"}`)
              : null
          }
          viewAllText={newArrivalsSec?.viewMoreTitle || "View All"}
          wishlistVariantIds={wishlistItems}
          onWishlistToggle={handleWishlistToggle}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* Custom Sections Inserted between core sections */}
      {customSections.slice(0, 2).map((sec) => (
        <CustomStorefrontSection
          key={sec._id || sec.id || sec.key}
          section={sec}
          wishlistVariantIds={wishlistItems}
          onWishlistToggle={handleWishlistToggle}
          onAddToCart={handleAddToCart}
        />
      ))}

      {/* 12. Tri-Promo Category Banners: Audio + Workspace + Smart Living */}
      <CategoryBannersRow banners={initialBanners} inactiveSlots={inactiveSlots} />

      {/* 13. Shop by Brand (Brand Partner Cards) */}
      <FeaturedBrands initialBrands={initialBrands} />

      {/* 14. Best Sellers (Horizontal Product Carousel with 5 cards) */}
      {showBestSellers && (
        <BestSellersSection
          initialProducts={initialBestSellers}
          title={bestSellersSec?.title}
          subtitle={bestSellersSec?.subtitle}
          theme={bestSellersSec?.theme}
          viewAllHref={
            bestSellersSec?.viewMoreEnabled !== false
              ? (bestSellersSec?.viewMoreUrl || `/sections/${bestSellersSec?.key || "best_sellers"}`)
              : null
          }
          viewAllText={bestSellersSec?.viewMoreTitle || "View All"}
          wishlistVariantIds={wishlistItems}
          onWishlistToggle={handleWishlistToggle}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* Any remaining Custom Sections */}
      {customSections.slice(2).map((sec) => (
        <CustomStorefrontSection
          key={sec._id || sec.id || sec.key}
          section={sec}
          wishlistVariantIds={wishlistItems}
          onWishlistToggle={handleWishlistToggle}
          onAddToCart={handleAddToCart}
        />
      ))}

      {/* 15. Bottom Tri-Banner Deals: Home & Kitchen + Smart Gadgets + Monsoon Special */}
      <BottomPromosRow banners={initialBanners} inactiveSlots={inactiveSlots} />

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
