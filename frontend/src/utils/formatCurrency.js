/**
 * Safely extracts a numeric price from numbers, numeric strings, or MongoDB Decimal128 objects
 */
export function parsePrice(amount) {
  if (amount === null || amount === undefined) return 0;
  if (typeof amount === "object" && "$numberDecimal" in amount) {
    return Number(amount.$numberDecimal) || 0;
  }
  return Number(amount) || 0;
}

/**
 * Currency and Price Formatting Utility
 *
 * Provides locale-aware currency formatting with INR default.
 */
export function formatCurrency(amount, currency = "INR", locale = "en-IN") {
  const numericAmount = parsePrice(amount);

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: numericAmount % 1 === 0 ? 0 : 2,
    }).format(numericAmount);
  } catch {
    // Fallback if Intl fails
    return `${currency} ${numericAmount.toFixed(2)}`;
  }
}

/**
 * Calculates discount percentage between basePrice and salePrice
 */
export function calculateDiscountPercentage(originalPrice, currentPrice) {
  const original = parsePrice(originalPrice);
  const current = parsePrice(currentPrice);

  if (original <= 0 || current >= original) {
    return 0;
  }

  return Math.round(((original - current) / original) * 100);
}

export default formatCurrency;

