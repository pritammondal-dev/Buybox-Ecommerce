# Implementation Plan - Production-Ready Product Details Page (`/product/[slug]`)

Build a complete, production-grade Product Details Page for Buybox E-Commerce (`/product/[slug]`) that conforms strictly to the Buybox design system (`#004D38` primary color, typography, and card components) while incorporating high-conversion patterns (Amazon/Flipkart usability, clear information density, zoomable gallery, delivery checker, specifications table, and customer reviews).

## User Review Required

> [!IMPORTANT]
> **Strict Scope Adherence:**
> - The Homepage (`/`), Homepage navbar, promotional banners, campaigns, and product sections remain **100% untouched**.
> - The Category Listing Page (`/category/[slug]`) and its newly built components remain **100% untouched**.
> - Existing backend APIs for products, categories, brands, reviews, and carts will be reused as-is without breaking any existing contracts.

## Proposed Changes

### Storefront Product Components

#### [MODIFY] [ProductGallery.jsx](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/components/storefront/product/ProductGallery.jsx)
- **Desktop vertical thumbnails column**: Render left-aligned thumbnail strip with smooth scroll and active thumbnail ring (`#004D38`).
- **Mobile horizontal thumbnails**: Swipeable/scrollable horizontal thumbnail strip below the main image.
- **Main image area**: High-resolution image showcase with next/prev arrows, image count indicator (`Photo 1 of 4`), discount badge (`-25% OFF`), and wishlist button.
- **Zoom / Lightbox Modal**: Click-to-zoom / lightbox modal with fullscreen high-res view, keyboard navigation (`Esc`, arrow keys), and close button.
- **Fallback resilience**: Graceful single-image handling and `ImageOff` SVG fallback on image load error (`onError`), preventing cumulative layout shift (CLS).

#### [MODIFY] [ProductInfo.jsx](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/components/storefront/product/ProductInfo.jsx)
- **Brand & SKU header**: Clickable brand link to `/shop?brandId=...` and font-mono SKU badge.
- **Title**: High-contrast typography with semantic `<h1>`.
- **Ratings & Reviews jump link**: Numerical average (e.g. `4.8 ★`), gold star icons, and clickable review count link that smoothly scrolls to the reviews section.
- **Pricing & Savings**: Full support for MongoDB `Decimal128` values; selling price, MRP / compareAtPrice with strikethrough, discount percentage badge, and calculated savings amount (`You save ₹X,XXX`).
- **Inclusive of taxes**: Tax category indicator.
- **Stock availability**: Visual indicator for `In Stock` (pulsing emerald dot), `Low Stock` (amber warning if quantity <= 5), `Out of Stock` (red badge), and `Pre-order` (amber badge).
- **Short description & tags**: Truncated / clean summary and product tags.

#### [NEW] [ProductOffers.jsx](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/components/storefront/product/ProductOffers.jsx)
- Bank Offers (instant credit card discount notes).
- Coupon discount card with copyable coupon code (`BUYBOX10`).
- Special benefits (No Cost EMI, Free Delivery above ₹499).

#### [NEW] [ProductHighlights.jsx](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/components/storefront/product/ProductHighlights.jsx)
- Extract top key attributes dynamically from `product.specifications` (display, processor, RAM, storage, battery, connectivity, warranty, etc.) across all categories (electronics, laptops, mobiles, accessories, fashion).

#### [MODIFY] [DeliveryWidget.jsx](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/components/storefront/product/DeliveryWidget.jsx)
- Styled with Buybox forest green `#004D38`.
- 6-digit Indian PIN code input with validation.
- Truthful serviceability feedback without hardcoded false promises.
- Trust badges: 24h Dispatch, 7-Day Replacement Policy, 1-Year Brand Warranty, COD Available.

#### [MODIFY] [ProductActions.jsx](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/components/storefront/product/ProductActions.jsx)
- **Quantity Selector**: Minus / plus buttons, min 1, max stock, disabled if out of stock.
- **Add to Cart button**: Full Buybox green `#004D38`, loading state with spinner, `useCart()` integration, toast notification.
- **Buy Now button**: Adds item to cart and navigates directly to `/checkout`.
- **Wishlist button**: Synchronized with `useWishlist()`.

#### [MODIFY] [ProductTabs.jsx](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/components/storefront/product/ProductTabs.jsx)
- **Product Overview / Description**: Detailed description with expand/collapse toggle for long texts.
- **Specifications Table**: Grouped key-value table dynamically rendering all entries from `product.specifications`.
- **Seller Information**: Vendor business name, verified rating, fulfillment guarantee, and return/warranty terms.
- **Customer Reviews**:
  - Rating distribution bars (5★ down to 1★).
  - Filter by star rating and sort by recent / helpful / highest / lowest.
  - Review cards with reviewer name, verified purchase badge, date, rating, and helpful vote button.
  - "Write a Review" modal with delivered order verification via `reviewService`.

#### [NEW] [RecentlyViewedSection.jsx](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/components/storefront/product/RecentlyViewedSection.jsx)
- Reads recently viewed product IDs via `getRecentlyViewedIds()`.
- Fetches products from `productService.getProducts()`, excludes the current product, and displays a responsive catalog row.

#### [MODIFY] [ProductDetailView.jsx](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/components/storefront/product/ProductDetailView.jsx)
- Master client component assembling Gallery, Info, Offers, Highlights, Actions, Delivery, Tabs, Related Products, Recently Viewed, and Mobile Sticky Bar.
- Records product view via `recordRecentlyViewed(productId)`.
- Dynamic breadcrumbs with parent-child category hierarchy (`Home > Category > Subcategory > Product`).

#### [MODIFY] [MobileStickyBar.jsx](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/components/storefront/product/MobileStickyBar.jsx)
- Fixed bottom bar on mobile (< 768px) with product thumbnail, title, price, and "Add to Cart" + "Buy Now" actions.

---

### Storefront Route Page

#### [MODIFY] [frontend/src/app/(storefront)/product/[slug]/page.js](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/(storefront)/product/[slug]/page.js)
- Server component prefetching product, category, brand, related products, and all categories (for breadcrumb hierarchy).
- `generateMetadata`: dynamic product title, meta description, OpenGraph images, and canonical URL.
- Error handling: graceful 404 via `notFound()`.

---

### Store Utility Refinement

#### [MODIFY] [frontend/src/stores/cart.store.js](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/stores/cart.store.js)
- Ensure `addItem` safely normalizes both `{ productId, quantity }` objects and direct `productId` string arguments.

---

## Verification Plan

### Automated Tests
1. **Frontend Unit Tests**: Run `npm test` in `frontend/` to verify all 86+ unit tests pass. Add new unit tests in `frontend/tests/unit/product-details-page.test.js` covering gallery image count, discount calculations, specs parsing, and quantity constraints.
2. **Frontend Linting**: Run `npm run lint` in `frontend/` to ensure 0 errors and 0 warnings.
3. **Backend Tests**: Run `npm test` in `backend/` to verify all 1,223 tests continue to pass.

### Manual & Visual Verification
1. **Desktop View (`/product/[slug]`)**:
   - Test gallery with vertical thumbnails, next/prev arrows, zoom/lightbox modal.
   - Verify pricing, Decimal128 parsing, discount badge, and savings text.
   - Verify quantity increment/decrement, Add to Cart toast, and Buy Now checkout transition.
   - Verify Pincode checker validation and trust badges.
   - Verify Specifications tab, Seller info tab, and Customer Reviews tab.
   - Verify Related Products and Recently Viewed sections.
2. **Mobile View (390px)**:
   - Verify gallery horizontal thumbnails, compact layout, and sticky bottom action bar.
   - Verify zero horizontal overflow.
3. **Regression Check**:
   - Verify Homepage (`/`) is 100% unchanged.
   - Verify Category Listing Page (`/category/mobiles`) is 100% unchanged.
