/**
 * Buybox Storefront Business & Commercial Policies Configuration
 *
 * Centralized, single-source-of-truth configuration for platform-wide commercial claims,
 * promotional offers, bank partnerships, shipping rules, delivery estimates, trust guarantees,
 * and serviceability terms.
 *
 * All values here are centralized and easily modified or connected to backend
 * CMS/storefront-settings endpoints without code changes across individual UI components.
 */

export const STOREFRONT_BUSINESS_POLICIES = {
  // Promotional Bank Offers
  bankOffers: [
    {
      id: "bank-offer-hdfc-icici",
      title: "10% Instant Discount",
      badge: "Bank Offer",
      description: "Up to ₹1,500 on HDFC & ICICI Credit Cards. Min. spend ₹5,000.",
      termsText: "Terms & Conditions Apply",
      minSpend: 5000,
      maxDiscount: 1500,
    },
  ],

  // Platform Welcome & Special Coupons
  coupons: [
    {
      id: "coupon-welcome-buybox10",
      code: "BUYBOX10",
      title: "Flat 10% Off",
      badge: "Special Coupon",
      description: "Use code on first purchase above ₹1,999.",
      minOrderAmount: 1999,
      discountPercentage: 10,
    },
  ],

  // Payment & Financing Policies
  payment: {
    emi: {
      isAvailable: true,
      minOrderAmount: 3000,
      description: "No Cost EMI available on major credit cards",
    },
    cod: {
      isAvailable: true,
      label: "COD Available",
      description: "Cash on Delivery available on eligible orders",
      thresholdMin: 0,
      thresholdMax: 50000,
    },
  },

  // Shipping & Logistics Policies
  shipping: {
    freeShippingThreshold: 499,
    freeShippingLabel: "Free Delivery on orders above ₹499",
    standardEstimatedDays: "2–4 business days",
    standardDeliveryFee: 0,
    standardDeliveryFeeBelowThreshold: 40,
    expressEstimatedDays: "1–2 business days",
    expressDeliveryFee: 99,
    expressDispatchLabel: "24h Dispatch",
    dispatchDescription: "Orders dispatched within 24 hours of confirmation",
    deliveryDisclaimer:
      "Final delivery carrier options, fees, and exact delivery dates are calculated during checkout based on your full delivery address.",
    options: [
      {
        id: "standard",
        name: "Standard Delivery",
        estimatedDays: "2–4 business days",
        badge: "Free Delivery Eligible",
        description: "Standard surface shipping via verified courier logistics partners.",
      },
      {
        id: "express",
        name: "Express Delivery",
        estimatedDays: "1–2 business days",
        badge: "Fastest Dispatch",
        description: "Priority air dispatch within 24 hours of confirmation.",
      },
    ],
  },

  // Returns, Replacements & Warranty
  returnsAndWarranty: {
    replacementDays: 7,
    replacementLabel: "7-Day Replacement",
    replacementDescription:
      "In the rare event of damage, defect, or mismatch, request a hassle-free doorstep replacement within 7 days of delivery.",
    defaultWarrantyLabel: "Brand Warranty",
    defaultWarrantyDescription:
      "Includes standard manufacturer warranty honored at authorized brand service centers.",
    genuineGuaranteeLabel: "100% Genuine Guarantee",
    genuineGuaranteeDescription:
      "Directly sourced from authorized brand distributors with authentic packaging.",
  },

  // Seller & Fulfillment Defaults
  seller: {
    defaultSellerName: "Buybox Authorized Merchant",
    verifiedBadgeLabel: "Buybox Verified Partner",
    fulfillmentLabel: "Fulfilled by Buybox Express",
    fulfillmentDescription:
      "Quality checked and dispatched from our certified logistics hubs with complete transit tracking.",
  },

  // Trust Badges for Product Details & Catalog
  trustBadges: [
    {
      id: "dispatch",
      key: "dispatch",
      icon: "Truck",
      label: "24h Dispatch",
      description: "Quick dispatch from warehouse",
    },
    {
      id: "replacement",
      key: "replacement",
      icon: "RotateCcw",
      label: "7-Day Replacement",
      description: "Doorstep replacement for defects",
    },
    {
      id: "warranty",
      key: "warranty",
      icon: "ShieldCheck",
      label: "Brand Warranty",
      description: "Manufacturer warranty coverage",
    },
    {
      id: "cod",
      key: "cod",
      icon: "Banknote",
      label: "COD Available",
      description: "Pay upon delivery",
    },
  ],
};

/**
 * Dynamically extract authentic product-specific warranty from specifications
 * Checks both ES6 Map and plain Object specifications for keys containing "warranty".
 *
 * @param {Object} product
 * @returns {string|null} Authentic product warranty or null if unspecified
 */
export function extractProductWarranty(product) {
  if (!product) return null;

  const specifications = product.specifications;
  if (!specifications) return null;

  let entries = [];
  if (specifications instanceof Map) {
    entries = Array.from(specifications.entries());
  } else if (typeof specifications === "object") {
    entries = Object.entries(specifications);
  }

  for (const [key, val] of entries) {
    if (key && typeof key === "string" && /warranty/i.test(key)) {
      const stringVal = String(val || "").trim();
      if (stringVal) {
        return stringVal;
      }
    }
  }

  return null;
}

/**
 * Resolve authentic seller info without fabricating fake ratings
 *
 * @param {Object} product
 * @param {Object} [brand]
 * @returns {{ sellerName: string, verifiedBadge: string, rating: number|null, fulfillmentLabel: string, fulfillmentDescription: string }}
 */
export function resolveSellerInfo(product, brand) {
  const sellerName =
    product?.vendor?.businessName ||
    product?.vendor?.name ||
    brand?.name ||
    STOREFRONT_BUSINESS_POLICIES.seller.defaultSellerName;

  // Only use authentic rating if present on vendor data; NEVER fabricate a number
  const rawRating =
    product?.vendor?.ratingAverage ||
    product?.vendor?.rating ||
    null;
  const rating =
    typeof rawRating === "number" && rawRating > 0
      ? Number(rawRating.toFixed(1))
      : null;

  return {
    sellerName,
    verifiedBadge: STOREFRONT_BUSINESS_POLICIES.seller.verifiedBadgeLabel,
    rating,
    fulfillmentLabel: STOREFRONT_BUSINESS_POLICIES.seller.fulfillmentLabel,
    fulfillmentDescription:
      STOREFRONT_BUSINESS_POLICIES.seller.fulfillmentDescription,
  };
}

/**
 * Dynamically calculate shipping / delivery fee based on subtotal and chosen delivery option
 *
 * @param {number|string} subtotal
 * @param {string} [optionId="standard"]
 * @returns {number} Delivery fee in currency units (INR)
 */
export function calculateDeliveryFee(subtotal, optionId = "standard") {
  const numSubtotal = Number(subtotal) || 0;
  const shippingPolicy = STOREFRONT_BUSINESS_POLICIES.shipping;

  if (optionId === "express") {
    return shippingPolicy.expressDeliveryFee ?? 99;
  }

  if (numSubtotal >= (shippingPolicy.freeShippingThreshold ?? 499)) {
    return shippingPolicy.standardDeliveryFee ?? 0;
  }

  return shippingPolicy.standardDeliveryFeeBelowThreshold ?? 40;
}

/**
 * Dynamically evaluate COD eligibility against order subtotal and platform policy
 *
 * @param {number|string} subtotal
 * @param {Object} [paymentPolicy=STOREFRONT_BUSINESS_POLICIES.payment.cod]
 * @returns {{ isEligible: boolean, reason?: string, fee: number }}
 */
export function evaluateCodEligibility(
  subtotal,
  paymentPolicy = STOREFRONT_BUSINESS_POLICIES.payment.cod
) {
  const numSubtotal = Number(subtotal) || 0;

  if (!paymentPolicy?.isAvailable) {
    return {
      isEligible: false,
      reason: "Cash on Delivery is currently unavailable on this storefront.",
      fee: 0,
    };
  }

  if (paymentPolicy.thresholdMin && numSubtotal < paymentPolicy.thresholdMin) {
    return {
      isEligible: false,
      reason: `Minimum order value of ₹${paymentPolicy.thresholdMin} required for Cash on Delivery.`,
      fee: 0,
    };
  }

  if (paymentPolicy.thresholdMax && numSubtotal > paymentPolicy.thresholdMax) {
    return {
      isEligible: false,
      reason: `Cash on Delivery is only available for orders up to ₹${paymentPolicy.thresholdMax}.`,
      fee: 0,
    };
  }

  return {
    isEligible: true,
    fee: paymentPolicy.codFee ?? 0,
  };
}

export default STOREFRONT_BUSINESS_POLICIES;
