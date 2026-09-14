# Buybox UI/UX Design System & Style Guide

## 1. Executive Summary & Design Vision

This document establishes the official **Buybox UI/UX Design System, Visual Identity, and Component Guidelines**. All future frontend development—including storefront pages, category and product detail views, user account management, cart, checkout flows, and administrative portals—must strictly adhere to the visual hierarchy, color palette, component patterns, typography, and interactive behaviors defined in this specification.

### Core Brand Principles
- **Modern & Trustworthy**: Clean layouts, high-contrast typography, and curated trust signifiers (e.g., live stock tracking, genuine badges, 24/7 support hotlines).
- **Emerald Teal & Warm Pastel Palette**: Distinguishable from generic ecommerce sites by pairing an authoritative **Emerald Teal** (`#007A55`) with a welcoming **Warm Pastel Yellow** (`#FFF8D6`), **Deep Forest Teal** (`#004D38`), and soft pastel accents.
- **Product-Focused & Interactive**: High-density product cards featuring color swatches, stock availability progress meters, interactive size chips, and instant feedback micro-animations.
- **Flawless Responsiveness**: Pixel-perfect scaling across mobile, tablet, desktop, and ultra-wide viewports without layout shifts or horizontal overflows.

---

## 2. Color Palette & Token Architecture

The design system uses HSL CSS variables defined in [`frontend/src/app/globals.css`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/globals.css) and exposed through Tailwind CSS v4 `@theme`.

### 2.1 Primary & Brand Colors

| Token Name | Hex Code | HSL Value | Tailwind Token | UI Role & Application |
| :--- | :--- | :--- | :--- | :--- |
| **Emerald Teal** | `#007A55` | `164 85% 25%` | `bg-primary`, `text-primary`, `border-primary` | Primary brand color, primary CTA buttons (`Shop Now`, `Add to Cart`), active tab underlines, price displays, logo mark. |
| **Deep Forest Teal** | `#004D38` | `164 90% 16%` | `bg-topbar`, `text-topbar-foreground` | Top announcement bar, high-emphasis header accents, contrast banners. |
| **Teal Hover / Dark** | `#006346` | `164 85% 20%` | `hover:bg-[#006346]` | Hover and active states for primary emerald teal buttons. |
| **Teal Light / Subtle**| `#E6F5F0` | `164 45% 94%` | `bg-secondary`, `bg-emerald-50` | Active swatch highlights, category badge backgrounds, icon backdrops. |

### 2.2 Accent & Promotional Warm Colors

| Token Name | Hex Code | HSL Value | Tailwind Token | UI Role & Application |
| :--- | :--- | :--- | :--- | :--- |
| **Warm Hero Cream** | `#FFF8D6` | `48 100% 92%` | `bg-hero-cream`, `bg-[#FFF8D6]` | Large rounded hero containers, seasonal highlight banners. |
| **Sunny Accent Yellow**| `#FACC15` | `48 96% 53%` | `bg-accent`, `text-accent-foreground` | Star ratings, promotional pill highlights, "Extra 20% Off" discount badges. |
| **Discount / Sales Red**| `#E02424` | `0 84% 51%` | `bg-[#E02424]`, `text-[#E02424]` | Red `SALES` tag, discount percentages (`-25% OFF`), urgent flash sale alerts. |

### 2.3 Bento Pastel Accent Tokens

Used for promotional bento grids, curated category collections, and feature trio cards:

| Token Name | Hex Code | HSL Value | Tailwind Token | Typical Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Pastel Pink** | `#FCE7F3` | `325 80% 94%` | `bg-pastel-pink`, `bg-[#FCE7F3]` | Runway / Fashion promo cards, women's apparel spotlights. |
| **Pastel Mint** | `#DCFCE7` | `142 75% 93%` | `bg-pastel-mint`, `bg-[#DCFCE7]` | Eco-friendly / Lifestyle promo cards, spring collection cards. |
| **Pastel Blue** | `#E0F2FE` | `204 90% 94%` | `bg-pastel-blue`, `bg-[#E0F2FE]` | Electronics, Kids & Baby clothing promo cards, audio highlights. |
| **Pastel Yellow** | `#FEF9C3` | `54 95% 77%` | `bg-pastel-yellow`, `bg-[#FEF9C3]` | Clearance banners, featured category backdrops. |

### 2.4 Neutrals & Structure Tokens

| Token Name | Hex Code / HSL | Tailwind Token | Application |
| :--- | :--- | :--- | :--- |
| **Background (Light)** | `0 0% 100%` (`#FFFFFF`) | `bg-background` | Page background, cards, modals. |
| **Foreground (Light)** | `222 47% 11%` (`#0F172A`) | `text-foreground` | High-contrast body text, headings. |
| **Muted Slate** | `215 16% 47%` (`#64748B`) | `text-muted-foreground` | Subtitles, secondary copy, stock counts. |
| **Border / Dividers** | `214 20% 90%` (`#E2E8F0`) | `border-border` | Subtle component borders, product card separators. |
| **Card / Surface Light** | `210 20% 98%` (`#F8FAFC`) | `bg-slate-50` | Thumbnail containers, inactive tab backgrounds. |

---

## 3. Typography Hierarchy & Rules

### 3.1 Display & Headings

- **Font Family**: Inter, Plus Jakarta Sans, or System UI Sans-Serif (`font-sans`).
- **Hero Display H1**:
  - `text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-950 leading-[1.1]`
  - Always used inside hero banners for high visual punch.
- **Section Titles H2**:
  - `text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight`
  - Paired with an optional subtle subheadline (`text-sm sm:text-base text-slate-500`).
- **Card Titles H3**:
  - `text-sm sm:text-base font-bold text-slate-900 line-clamp-1 hover:text-[#007A55]`
- **Sub-headings / Brand Overlines**:
  - `text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400`

### 3.2 Pricing & Number Typography

- **Current Sale Price**:
  - `text-base sm:text-lg font-extrabold text-[#007A55]`
  - Format via `formatCurrency(price)` (e.g. `₹2,999`).
- **Strikethrough Original Price**:
  - `text-xs text-slate-400 line-through font-normal`
- **Discount Percentage Badge**:
  - `text-[11px] font-bold text-[#E02424]`

---

## 4. Layout Architecture & Grid Hierarchy

Every storefront page follows the global shell structure established in [`StorefrontShell.jsx`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/components/storefront/StorefrontShell.jsx):

```
+-----------------------------------------------------------------------------------+
| 1. Top Announcement Bar (Deep Forest Teal #004D38)                                 |
|    Hotline: +1800 900 1234 | "Extra 20% Off" Yellow Pill | Currency / Language     |
+-----------------------------------------------------------------------------------+
| 2. Storefront Header (Clean White #FFFFFF, Sticky)                                |
|    Buybox Logo (Teal) | Pill Search Bar + Category Trigger | 24/7 Support | Icons  |
+-----------------------------------------------------------------------------------+
| 3. Category Navigation Bar (Clean White / Sub-Header)                             |
|    "Explore All Categories" Teal Pill Button | Horizontal Menu | Hot Deals Tag     |
+-----------------------------------------------------------------------------------+
|                                                                                   |
| 4. Main Content Area (Max-W 7XL, Centered, Padding X-4/6/8)                      |
|                                                                                   |
|    [Hero Section] -> Rounded-[28px] Warm Pastel Yellow (#FFF8D6) Container       |
|    [Category Circles] -> 6-Column Minimalist Circles with Item Counts             |
|    [Today's Hot Picks] -> Countdown Pill Badge + 5-Col Product Cards              |
|    [Bento Promo Grid] -> 3-Card Pastel Pink / Yellow / Blue Asymmetric Grid       |
|    [Trust Ticker Marquee] -> Infinite Scrolling Ticker + Monochrome Brands        |
|    [Hand Picked Section] -> Interactive Size Chips (S, M, L, XL, XXL) + 4-Col Grid|
|    [Promo Trio Banner] -> Mint / Pink / Yellow 3-Column Spotlight Cards           |
|    [Bottom Tabs Section] -> "Fresh Finds / Top Sellers / Most Wanted" Underlines  |
|                                                                                   |
+-----------------------------------------------------------------------------------+
| 5. Storefront Footer (Dark Navy Slate #0F172A)                                    |
|    Newsletter Subscription | 4 Navigation Columns | Payment Badges | Copyright    |
+-----------------------------------------------------------------------------------+
```

### Standard Max Widths & Gutters
- **Global Container**: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
- **Section Vertical Margins**: `py-8 sm:py-12 lg:py-16`
- **Grid Gaps**:
  - Product grids: `gap-4 sm:gap-6`
  - Promo bento: `gap-6`
  - Category icons: `gap-4 sm:gap-6`

---

## 5. Core Component Design Specifications

### 5.1 The Buybox Product Card (`ProductCard.jsx`)

The product card is the central atom of the ecommerce experience. It must always include:

```
+--------------------------------------------------------+
| [ SALES ] (-25% OFF)                     [ (Heart) ]   |
|                                                        |
|                 Product Thumbnail                      |
|                 (Aspect Square 1:1)                    |
|                                                        |
+--------------------------------------------------------+
| BRAND NAME (Small uppercase tracking-wider)           |
| Product Title (1 line clamp, bold, teal on hover)     |
| ★★★★★ (18)                                             |
| ₹2,999   ~~₹3,999~~   25% OFF                          |
| (•) (•) (•) (•) (•) (5 Circular color swatch dots)     |
| Sold: 4                             Available: 200     |
| [==================----------------------------------] |
|                                                        |
| [(Heart)]   [         Add to Cart (Teal Pill)        ] |
+--------------------------------------------------------+
```

#### Exact Component Code Blueprint:
- **Container**: `group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-white p-3.5 shadow-xs transition-all duration-300 hover:shadow-card hover:-translate-y-1 hover:border-[#007A55]/30`
- **Image Container**: `relative aspect-square w-full overflow-hidden rounded-xl bg-slate-50 border border-slate-100`
- **Discount Badge**: `absolute top-2.5 left-2.5 z-10 rounded bg-[#E02424] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-xs`
- **Wishlist Button**: `absolute top-2.5 right-2.5 z-10 flex size-7 items-center justify-center rounded-full bg-white shadow-sm transition-transform active:scale-95`
- **Color Swatches**: Circular `size-2.5 rounded-full` buttons. Selected state has `ring-2 ring-[#007A55] ring-offset-1 scale-110`.
- **Stock Progress Bar**:
  - Status text: `flex items-center justify-between text-[10px] font-medium text-slate-500`
  - Track: `h-1.5 w-full overflow-hidden rounded-full bg-slate-100`
  - Fill: `h-full rounded-full bg-[#007A55] transition-all duration-500`
- **Action Buttons**:
  - Wishlist icon button: `size-8 rounded-lg border border-border text-slate-500 hover:border-[#007A55] hover:text-[#007A55]`
  - Add to Cart button: `flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#007A55] px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#006346] active:scale-95 transition-all`

---

### 5.2 Header & Navigation Components

#### Top Announcement Bar (`AnnouncementBar.jsx`)
- **Background**: `bg-[#004D38]` (Deep Forest Teal)
- **Text**: `text-xs text-white`
- **Left Element**: Customer support hotline link (`+1800 900 1234`) with phone icon.
- **Center Element**: Promo callout with yellow pill tag (`bg-[#FACC15] text-slate-900 font-bold px-2 py-0.5 rounded-full text-[10px]`).
- **Right Element**: Currency (`INR / USD`) and Language (`EN / HI`) dropdown selectors with separator divider.

#### Storefront Header (`StorefrontHeader.jsx`)
- **Background**: `bg-white/95 backdrop-blur-md sticky top-0 z-40 border-b border-border`
- **Brand Logo**: Rounded-xl teal icon (`bg-[#007A55] text-white size-9`) with shopping bag icon + bold typography (`Buybox`).
- **Search Bar**: Full-width rounded-full pill input with integrated category trigger and emerald teal search trigger button (`bg-[#007A55] text-white rounded-full size-9`).
- **24/7 Support Hotline**: Phone icon in `bg-emerald-50 text-[#007A55] size-10 rounded-full`, subtext `24/7 Support`, number `+800-777-003`.
- **Account / Wishlist / Cart Icons**: Circular `size-9 rounded-full border border-border` icons with numeric teal count badges. Cart shows label and live formatted subtotal in teal (`formatCurrency(subtotal)`).

#### Category Navigation Bar (`CategoryNavigation.jsx`)
- **All Categories Button**: Teal pill button `rounded-full bg-[#007A55] text-white font-bold text-xs px-4 py-2 flex items-center gap-2`.
- **Horizontal Links**: Clean text links with subtle hover transition (`hover:text-[#007A55]`).
- **Hot Deals Badge**: Small red tag (`bg-[#E02424] text-white text-[9px] font-bold px-1.5 py-0.5 rounded`).

---

### 5.3 Hero Section (`HeroSection.jsx`)

- **Outer Wrapper**: `rounded-[28px] bg-[#FFF8D6] p-8 sm:p-12 lg:p-16 border border-amber-200/50 shadow-xs relative overflow-hidden`
- **Badge**: Small uppercase promotional tag (`text-xs font-semibold text-slate-800`).
- **Headline**: High-impact bold display heading (`text-3xl sm:text-5xl lg:text-6xl font-black text-slate-950`).
- **CTA Button**: Emerald teal pill button: `rounded-full bg-[#007A55] text-white hover:bg-[#006346] font-bold text-sm px-8 py-3.5 shadow-sm hover:scale-105 active:scale-95 transition-transform`.
- **Slider Controls**:
  - Circular dark buttons: `size-9 rounded-full bg-slate-900 text-white hover:bg-slate-800 shadow-md`.
  - Pagination indicators: Active bar `w-8 bg-[#007A55] h-2 rounded-full`, inactive `w-2 bg-slate-300 h-2 rounded-full`.

---

### 5.4 Bento Promotional Grid (`BentoPromoGrid.jsx`)

Follows a 3-column asymmetric layout utilizing the designated pastel colors:
1. **Card 1 (Fashion / Runway)**:
   - Background: `bg-[#FCE7F3]` (Pastel Pink)
   - Border: `border-pink-200/60 rounded-3xl p-6 sm:p-8`
   - CTA: `rounded-full bg-slate-900 text-white text-xs font-bold px-5 py-2.5 hover:bg-slate-800`
2. **Card 2 (Women's Clothing)**:
   - Background: `bg-[#FEF9C3]` (Pastel Yellow)
   - Border: `border-yellow-200/60 rounded-3xl p-6 sm:p-8`
3. **Card 3 (Kids / Gadgets)**:
   - Background: `bg-[#E0F2FE]` (Pastel Blue)
   - Border: `border-sky-200/60 rounded-3xl p-6 sm:p-8`

---

### 5.5 Continuous Marquee & Trust Ticker (`TrustSection.jsx`)

- **Ticker Wrapper**: `w-full overflow-hidden bg-slate-50 py-3.5 border-y border-slate-200/80`
- **Marquee Content**: Infinitely scrolling horizontal row using CSS animation:
  - Text: `text-xs font-bold uppercase tracking-wider text-slate-700`
  - Separators: `text-amber-500 font-bold mx-4` (e.g. `★`)
  - Repeating phrases: `Free shipment ★ Support 24/7 ★ 7-Day Free Return ★ 100% Genuine Quality Guaranteed`
- **Partner Brands**: Monochrome partner logos with muted slate opacity (`text-slate-400 hover:text-slate-700 transition-colors`).

---

### 5.6 Hand Picked Section with Size Filter Chips (`HandPickedSection.jsx`)

- **Filter Chips**:
  - Pill buttons: `px-3.5 py-1 text-xs font-bold rounded-full border transition-all cursor-pointer`
  - Active chip: `bg-[#007A55] text-white border-[#007A55] shadow-xs`
  - Inactive chip: `bg-white text-slate-600 border-slate-200 hover:border-[#007A55] hover:text-[#007A55]`
  - Standard sizes: `["ALL", "S", "M", "L", "XL", "XXL"]`

---

### 5.7 Multi-Tab Product Collections (`BottomTabsSection.jsx`)

- **Tabs Header**: Centered tab switcher (`Fresh Finds`, `Top Sellers`, `Most Wanted`).
- **Active State Indicator**:
  - Active tab text: `text-[#007A55] font-extrabold`
  - Active tab underline: `absolute bottom-0 left-0 right-0 h-0.5 bg-[#007A55] rounded-full`
  - Inactive tab text: `text-slate-400 font-medium hover:text-slate-700`

---

## 6. Micro-Interactions & Animation Guidelines

1. **Hover Lift**:
   - Product cards and promo tiles apply `transition-all duration-300 hover:-translate-y-1 hover:shadow-card`.
2. **Button Tap / Click Scale**:
   - Interactive buttons apply `active:scale-95` to give a tactile physical response.
3. **Image Zoom on Card Hover**:
   - Product thumbnails use `transition-transform duration-500 group-hover:scale-105`.
4. **Toast Feedback**:
   - When items are added to Cart or Wishlist, use `sonner` toasts styled with emerald teal accents and clear CTA buttons (e.g. `View Cart`).

---

## 7. Responsive Breakpoint Rules

| Viewport | Tailwind Prefix | Behavior & Grid Layouts |
| :--- | :--- | :--- |
| **Mobile (< 640px)** | Default | 1-2 product columns (`grid-cols-2 gap-3`), stacked hero elements, slide-over mobile drawer for navigation, collapsed search bar. |
| **Tablet (640px - 1024px)**| `sm:`, `md:` | 3 product columns (`grid-cols-3 gap-4`), full search bar visible in header, hero grid 2 columns. |
| **Desktop (1024px - 1280px)**| `lg:` | 4-5 product columns (`grid-cols-4` or `grid-cols-5`), all category navigation visible, bento grid 3-column row. |
| **Wide Desktop (> 1280px)** | `xl:`, `2xl:` | Full 5-column hot picks grid, 24/7 hotline displayed in top header, max container fixed at `max-w-7xl` (`1280px`). |

---

## 8. Development Rules & Governance Checklist

When adding any new page or modifying existing UI components, verify that:

- [ ] **Primary buttons** use `bg-[#007A55] hover:bg-[#006346] text-white rounded-full` (pill shape).
- [ ] **Product prices** are parsed via `parsePrice` and formatted via `formatCurrency` to properly handle MongoDB Decimal128 objects.
- [ ] **Discount badges** use `#E02424` (Red) with bold white text.
- [ ] **Rating stars** use `text-amber-400` with 5 stars and parenthesized count `(18)`.
- [ ] **Border radiuses** match standard tokens: `rounded-2xl` for cards, `rounded-full` for chips and buttons, and `rounded-[28px]` for primary banner sections.
- [ ] **No arbitrary dark colors** like random `#000000` or `#1e3a8a` are introduced—use slate neutrals (`slate-900`, `slate-950`) or brand `topbar` (`#004D38`).
- [ ] **Zero backend modifications**: Storefront components must strictly consume existing backend endpoints and fields documented in `frontend/docs/backend-api-contract.md`.
- [ ] **Build & Lint Safety**: All new components must pass `npm run lint` with 0 warnings/errors and `npm run build` without hydration mismatches.
