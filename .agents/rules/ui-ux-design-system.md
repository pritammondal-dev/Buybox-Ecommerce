# Buybox UI/UX Design System Enforcement Rule

This rule is mandatory for all agent operations across the **Buybox** frontend application.

## 1. Primary Design Language & Theme Tokens
- **Brand Primary**: Emerald Teal `#007A55` (`164 85% 25%`)
  - Use for: Primary CTA buttons, active links/underlines, highlighted prices, search buttons, brand icons.
  - Hover state: `#006346`
- **Top Announcement Bar**: Deep Forest Teal `#004D38` (`164 90% 16%`)
- **Hero & Seasonal Accents**: Warm Pastel Cream `#FFF8D6` (`48 100% 92%`)
- **Accent Yellow**: Sunny Warm Yellow `#FACC15` (Star ratings, discount highlights)
- **Sales / Discount Red**: `#E02424` (Sales badges, discount % chips)
- **Bento Pastel Accents**:
  - Pastel Pink: `#FCE7F3`
  - Pastel Yellow: `#FEF9C3`
  - Pastel Blue: `#E0F2FE`
  - Pastel Mint: `#DCFCE7`

## 2. Component Blueprints
- **Primary Buttons**: Always rounded-full pill buttons (`rounded-full bg-[#007A55] text-white font-bold hover:bg-[#006346] active:scale-95 transition-all`).
- **Product Cards**:
  - Rounded container (`rounded-2xl border border-border/80 bg-white p-3.5 shadow-xs hover:shadow-card hover:-translate-y-1 hover:border-[#007A55]/30`).
  - Red `SALES` or `-% OFF` badge at top-left.
  - Wishlist heart icon button at top-right.
  - 5-star rating row in `text-amber-400` with review count.
  - Emerald teal price (`#007A55`) with line-through compare price.
  - 5 circular color swatch dots.
  - Stock availability progress bar (`Sold: X, Available: Y`).
  - Action footer with secondary wishlist button + primary teal pill `Add to Cart` button.
- **Hero Banners**: Rounded-3xl (`rounded-[28px]`) with warm pastel cream background (`bg-[#FFF8D6]`), bold headline, subtext, and teal pill CTA.
- **Section Tabs**: Underlined pill tabs with emerald teal active state and smooth transition.
- **Size Filter Chips**: Pill buttons (`px-3.5 py-1 text-xs font-bold rounded-full border`), teal active state.

## 3. Data & Price Safety
- Always parse product prices through `parsePrice` to safely handle MongoDB Decimal128 objects (`{"$numberDecimal": "..."}`) and format via `formatCurrency`.
- Never display `NaN` or unformatted raw numbers.

## 4. Quality & Build Guardrails
- Maintain 0 ESLint errors/warnings (`npm run lint`).
- Ensure all tests pass (`npm test`).
- Ensure full App Router compilation without hydration mismatches (`npm run build`).
- Do not modify backend code or invent backend fields.

Refer to `frontend/docs/ui-ux-design-system.md` for complete design specifications.
