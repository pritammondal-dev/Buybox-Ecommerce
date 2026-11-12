const crypto = require("crypto");
const mongoose = require("mongoose");

const orderRepository = require("../repositories/order.repository");
const cartRepository = require("../repositories/cart.repository");
const addressRepository = require("../repositories/address.repository");
const inventoryRepository = require("../repositories/inventory.repository");
const paymentRepository = require("../repositories/payment.repository");
const couponRepository = require("../repositories/coupon.repository");
const couponRedemptionRepository = require("../repositories/coupon-redemption.repository");
const shipmentRepository = require("../repositories/shipment.repository");

const inventoryService = require("./inventory.service");
const couponService = require("./coupon.service");
const couponRedemptionService = require("./coupon-redemption.service");
const taxService = require("./tax.service");
const notificationService = require("./notification");
const notificationOutboxService = require("./notification-outbox.service");
const logger = require("../config/logger");

const paymentService = require("./payment.service");
const digitalEntitlementService = require("./digital-entitlement.service");
const financialLedgerService = require("./financial-ledger.service");
const commissionService = require("./commission.service");

const {
  TAX_PRICING_MODES,
  DEFAULT_TAX_PRICING_MODE,
} = require("../constants/tax.constants");

const withTransaction = require("../utils/withTransaction");

const ProductVariant = require("../models/ProductVariant");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const User = require("../models/User");
const Order = require("../models/Order");
const Vendor = require("../models/Vendor");
const Payment = require("../models/Payment");

const storefrontSettingsService = require("./storefront-settings.service");
const pricingEngineService = require("./pricing-engine.service");
const {
  generateQuoteReference,
  verifyQuoteReference,
  computePricingFingerprint,
  toStandardDecimalString,
} = require("../utils/quote-reference.util");

const AppError = require("../errors/AppError");
const { encodeSecureId, decodeSecureId } = require("../utils/secure-id.util");

const {
  canTransitionOrderStatus,
} = require("../constants/order.constants");

const DEFAULT_CURRENCY = "INR";
const MINOR_UNIT_SCALE = 100;

/**
 * Convert a decimal value into integer minor units.
 *
 * Examples:
 * "2799.00" -> 279900
 * "10.50" -> 1050
 */
const decimalToMinorUnits = (value) => {
  const decimalString =
    value?.toString?.() ?? String(value ?? "0");

  const normalizedValue =
    decimalString.trim();

  if (!/^-?\d+(\.\d+)?$/.test(normalizedValue)) {
    throw new AppError(
      "Invalid monetary value",
      500,
      "INVALID_MONEY_VALUE"
    );
  }

  const sign =
    normalizedValue.startsWith("-")
      ? -1
      : 1;

  const unsignedValue =
    normalizedValue.replace("-", "");

  const [
    wholePart = "0",
    fractionalPart = "",
  ] = unsignedValue.split(".");

  const normalizedFraction =
    fractionalPart
      .padEnd(2, "0")
      .slice(0, 2);

  const wholeMinorUnits =
    Number(wholePart) * MINOR_UNIT_SCALE;

  const fractionalMinorUnits =
    Number(normalizedFraction);

  const minorUnits =
    wholeMinorUnits +
    fractionalMinorUnits;

  if (!Number.isSafeInteger(minorUnits)) {
    throw new AppError(
      "Monetary value is too large",
      500,
      "MONEY_VALUE_TOO_LARGE"
    );
  }

  return sign * minorUnits;
};

/**
 * Convert integer minor units into a decimal string.
 *
 * Example:
 * 279900 -> "2799.00"
 */
const minorUnitsToDecimalString = (
  minorUnits
) => {
  if (!Number.isSafeInteger(minorUnits)) {
    throw new AppError(
      "Invalid minor unit amount",
      500,
      "INVALID_MINOR_UNIT_AMOUNT"
    );
  }

  const sign =
    minorUnits < 0 ? "-" : "";

  const absoluteValue =
    Math.abs(minorUnits);

  const wholePart = Math.floor(
    absoluteValue / MINOR_UNIT_SCALE
  );

  const fractionalPart = String(
    absoluteValue % MINOR_UNIT_SCALE
  ).padStart(2, "0");

  return `${sign}${wholePart}.${fractionalPart}`;
};

/**
 * Validate and normalize the Idempotency-Key header value.
 */
const validateIdempotencyKey = (idempotencyKey) => {
  if (
    typeof idempotencyKey !== "string" ||
    idempotencyKey.trim().length < 8 ||
    idempotencyKey.trim().length > 128
  ) {
    throw new AppError(
      "A valid Idempotency-Key is required",
      400,
      "INVALID_IDEMPOTENCY_KEY"
    );
  }

  return idempotencyKey.trim();
};

/**
 * Generate a SHA-256 fingerprint of the order checkout inputs.
 */
const generateCheckoutFingerprint = ({
  customerId,
  shippingAddressId,
  couponCode,
}) => {
  const normalizedCoupon = couponCode
    ? String(couponCode).trim().toUpperCase()
    : "";
  const payload = `${String(customerId)}|${String(shippingAddressId)}|${normalizedCoupon}`;
  return crypto.createHash("sha256").update(payload, "utf8").digest("hex");
};

/**
 * Generate a unique human-readable order number.
 */
const generateOrderNumber = () => {
  const timestamp = Date.now()
    .toString(36)
    .toUpperCase();

  const random = crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase();

  return `BB-${timestamp}-${random}`;
};

/**
 * Load the active customer profile belonging
 * to the authenticated user.
 */
const validateCustomer = async (userId) => {
  const customer =
    await Customer.findOne({
      userId,
      isActive: true,
      deletedAt: null,
    });

  if (!customer) {
    throw new AppError(
      "Customer profile not found",
      404,
      "CUSTOMER_NOT_FOUND"
    );
  }

  return customer;
};

/**
 * Load an address belonging to the authenticated user.
 *
 * Address belongs to User, not Customer.
 */
const getShippingAddress = async (
  userId,
  addressId
) => {
  const address =
    await addressRepository.findById(
      addressId,
      userId
    );

  if (!address) {
    throw new AppError(
      "Shipping address not found",
      404,
      "SHIPPING_ADDRESS_NOT_FOUND"
    );
  }

  return address;
};

/**
 * Validate every cart item against the current
 * authoritative catalog data.
 *
 * Cart priceSnapshot is intentionally NOT trusted.
 */
const validateCartItems = async (cart, options = {}) => {
  if (
    !cart ||
    cart.status !== "active"
  ) {
    throw new AppError(
      "Active cart not found",
      404,
      "CART_NOT_FOUND"
    );
  }

  if (
    !cart.items ||
    cart.items.length === 0
  ) {
    throw new AppError(
      "Cannot create order from an empty cart",
      400,
      "CART_EMPTY"
    );
  }

  const variantIds = cart.items.map(
    (item) => item.productVariantId
  );

  let variantQuery = ProductVariant.find({
    _id: { $in: variantIds },
    isActive: true,
    deletedAt: null,
  });
  if (options.session && typeof variantQuery.session === "function") {
    variantQuery = variantQuery.session(options.session);
  }
  const variants = await variantQuery.lean();

  const variantMap = new Map(
    variants.map((v) => [v._id.toString(), v])
  );

  const productIds = [
    ...new Set(variants.map((v) => v.productId.toString())),
  ];

  let productQuery = Product.find({
    _id: { $in: productIds },
    status: "active",
    deletedAt: null,
  });
  if (options.session && typeof productQuery.session === "function") {
    productQuery = productQuery.session(options.session);
  }
  const products = await productQuery.lean();

  const productMap = new Map(
    products.map((p) => [p._id.toString(), p])
  );

  const orderItems = [];

  for (const cartItem of cart.items) {
    const variant = variantMap.get(
      cartItem.productVariantId.toString()
    );

    if (!variant) {
      throw new AppError(
        "A product variant in your cart is no longer available",
        400,
        "CART_ITEM_UNAVAILABLE"
      );
    }

    const product = productMap.get(
      variant.productId.toString()
    );

    if (!product) {
      throw new AppError(
        "A product in your cart is no longer available",
        400,
        "PRODUCT_UNAVAILABLE"
      );
    }

    const variantCurrency =
      variant.currency ||
      DEFAULT_CURRENCY;

    const cartCurrency =
      cart.currency ||
      DEFAULT_CURRENCY;

    if (
      variantCurrency !== cartCurrency
    ) {
      throw new AppError(
        "Cart currency does not match product currency",
        400,
        "CART_CURRENCY_MISMATCH"
      );
    }

    let unitPrice = variant.price;
    let regularPrice = variant.price;
    let compareAtPrice = variant.compareAtPrice ?? product.compareAtPrice ?? null;
    let effectivePrice = variant.price;
    let isPromotional = false;
    let promotionId = null;
    let promotionName = null;
    let promotionDiscountAmount = "0.00";
    let fundingSource = null;
    let allowCoupons = true;

    if (mongoose.connection.readyState === 1 && typeof pricingEngineService.calculateEffectivePrice === "function") {
      try {
        const pricing = await pricingEngineService.calculateEffectivePrice({
          product,
          variant,
          asOfDate: options.asOfDate || new Date(),
        });
        if (pricing) {
          if (pricing.compareAtPrice !== undefined && pricing.compareAtPrice !== null) {
            compareAtPrice = pricing.compareAtPrice;
          }
          if (pricing.effectivePrice !== undefined && pricing.effectivePrice !== null) {
            effectivePrice = pricing.effectivePrice;
          }
          if (pricing.isPromotional) {
            isPromotional = true;
            regularPrice = pricing.regularPrice;
            unitPrice = pricing.effectivePrice;
            promotionId = pricing.promotion?.id || null;
            promotionName = pricing.promotion?.name || null;
            promotionDiscountAmount = pricing.promotionalDiscountAmount || "0.00";
            fundingSource = pricing.promotion?.fundingSource || null;
            allowCoupons = pricing.promotion?.allowCoupons !== false;
          }
        }
      } catch (err) {
        logger.warn("Promotional pricing calculation failed, falling back to base price: " + err.message);
      }
    }

    const unitPriceMinorUnits =
      decimalToMinorUnits(unitPrice);

    const lineTotalMinorUnits =
      unitPriceMinorUnits *
      cartItem.quantity;

    if (
      !Number.isSafeInteger(
        lineTotalMinorUnits
      )
    ) {
      throw new AppError(
        "Order amount is too large",
        400,
        "ORDER_AMOUNT_TOO_LARGE"
      );
    }

    const lineTotal =
      minorUnitsToDecimalString(
        lineTotalMinorUnits
      );

    orderItems.push({
      productId: product._id,
      productVariantId: variant._id,
      vendorId: product.vendorId,
      categoryId: product.categoryId,
      sku: variant.sku,
      productName: product.name,
      variantName: variant.name || "",
      quantity: cartItem.quantity,
      unitPrice,
      regularPrice,
      compareAtPrice,
      effectivePrice,
      isPromotional,
      promotionId,
      promotionName,
      promotionDiscountAmount,
      fundingSource,
      allowCoupons,
      isTaxable:
        product.isTaxable !== undefined ? product.isTaxable : true,
      taxCategory: product.taxCategory || "standard",
      discountTotal: "0.00",
      taxTotal: "0.00",
      lineTotal,
      currency: variantCurrency,
    });
  }

  return orderItems;
};

/**
 * Calculate authoritative checkout totals.
 *
 * Discounts, tax and shipping engines are not active yet,
 * except for the coupon discount supplied by checkout.
 */
const DELIVERY_OPTIONS = {
  standard: {
    id: "standard",
    name: "Standard Delivery",
    estimatedDays: "2–4 business days",
    freeThresholdMinorUnits: 49900, // ₹499
    standardFeeBelowMinorUnits: 4000, // ₹40
  },
  express: {
    id: "express",
    name: "Express Delivery",
    estimatedDays: "1–2 business days",
    feeMinorUnits: 9900, // ₹99
  },
};

const resolveDeliveryOption = (deliveryOptionId, subtotalMinorUnits = 0) => {
  if (!deliveryOptionId) {
    return {
      id: "standard",
      name: "Standard Delivery",
      estimatedDays: "2–4 business days",
      feeMinorUnits: 0,
      cost: "0.00",
    };
  }
  const normalizedId = String(deliveryOptionId).trim().toLowerCase();
  if (normalizedId === "express") {
    return {
      id: "express",
      name: "Express Delivery",
      estimatedDays: "1–2 business days",
      feeMinorUnits: 9900,
      cost: minorUnitsToDecimalString(9900),
    };
  }
  // Default standard delivery: free if subtotal meets/exceeds ₹499, else ₹40
  const feeMinorUnits = subtotalMinorUnits >= 49900 ? 0 : 4000;
  return {
    id: "standard",
    name: "Standard Delivery",
    estimatedDays: "2–4 business days",
    feeMinorUnits,
    cost: minorUnitsToDecimalString(feeMinorUnits),
  };
};

/**
 * Calculate authoritative checkout totals.
 *
 * Supports dynamic shippingTotalMinorUnits, coupon discounts, and tax calculation.
 */
const calculateOrderTotals = (
  orderItems,
  currency,
  couponDiscountMinorUnits = 0,
  taxCalculation = null,
  shippingTotalMinorUnits = 0
) => {
  let subtotalMinorUnits = 0;

  for (const item of orderItems) {
    subtotalMinorUnits +=
      decimalToMinorUnits(
        item.lineTotal
      );

    if (
      !Number.isSafeInteger(
        subtotalMinorUnits
      )
    ) {
      throw new AppError(
        "Order amount is too large",
        400,
        "ORDER_AMOUNT_TOO_LARGE"
      );
    }
  }

  if (
    !Number.isSafeInteger(
      couponDiscountMinorUnits
    ) ||
    couponDiscountMinorUnits < 0 ||
    couponDiscountMinorUnits >
      subtotalMinorUnits
  ) {
    throw new AppError(
      "Invalid coupon discount",
      400,
      "INVALID_COUPON_DISCOUNT"
    );
  }

  const taxTotalMinorUnits =
    taxCalculation?.totalTaxMinorUnits !== undefined
      ? taxCalculation.totalTaxMinorUnits
      : 0;

  const shippingTotalMinor =
    Number.isSafeInteger(shippingTotalMinorUnits) && shippingTotalMinorUnits >= 0
      ? shippingTotalMinorUnits
      : 0;

  const pricingMode =
    taxCalculation?.pricingMode || DEFAULT_TAX_PRICING_MODE;

  let grandTotalMinorUnits;
  if (pricingMode === TAX_PRICING_MODES.TAX_INCLUSIVE) {
    grandTotalMinorUnits =
      subtotalMinorUnits -
      couponDiscountMinorUnits +
      shippingTotalMinor +
      (taxCalculation?.shippingTaxTotalMinorUnits || 0);
  } else {
    grandTotalMinorUnits =
      subtotalMinorUnits -
      couponDiscountMinorUnits +
      taxTotalMinorUnits +
      shippingTotalMinor;
  }

  return {
    currency,
    pricingMode,

    subtotal:
      minorUnitsToDecimalString(
        subtotalMinorUnits
      ),

    discountTotal:
      minorUnitsToDecimalString(
        couponDiscountMinorUnits
      ),

    taxTotal:
      minorUnitsToDecimalString(
        taxTotalMinorUnits
      ),

    shippingTotal:
      minorUnitsToDecimalString(
        shippingTotalMinor
      ),

    grandTotal:
      minorUnitsToDecimalString(
        Math.max(0, grandTotalMinorUnits)
      ),
  };
};

/**
 * Reserve inventory for every order item
 * inside the caller's MongoDB transaction.
 */
const reserveInventoryForOrderItems =
  async (
    orderItems,
    orderNumber,
    userId,
    session
  ) => {
    for (const item of orderItems) {
      if (
        item.isVirtual ||
        item.isDownloadable ||
        item.inventoryStatus === "not_required" ||
        item.productType === "digital"
      ) {
        item.warehouseId = null;
        item.inventoryStatus = "not_required";
        continue;
      }

      const inventories =
        await inventoryRepository.findByVariant(
          item.productVariantId,
          { session }
        );

      const activeInventories = (inventories || []).filter((inv) => {
        if (!inv.warehouseId) return false;
        if (typeof inv.warehouseId === "object") {
          if (inv.warehouseId.isActive === false) return false;
          if (inv.warehouseId.deletedAt) return false;
        }
        return true;
      });

      if (activeInventories.length === 0) {
        throw new AppError(
          `No inventory is configured for SKU ${item.sku}`,
          409,
          "INVENTORY_NOT_CONFIGURED"
        );
      }

      /*
       * Sort candidate warehouses deterministically:
       * 1. Available stock descending (prioritizes warehouse with deepest stock)
       * 2. Warehouse ID ascending (stable tie-breaker)
       */
      const sortedInventories = [...activeInventories].sort((a, b) => {
        const availA = Math.max(
          (Number(a.onHand) || 0) - (Number(a.reserved) || 0),
          0
        );
        const availB = Math.max(
          (Number(b.onHand) || 0) - (Number(b.reserved) || 0),
          0
        );

        if (availB !== availA) {
          return availB - availA;
        }

        return (a.warehouseId?.toString() || "").localeCompare(
          b.warehouseId?.toString() || ""
        );
      });

      let reservedInventory = null;

      for (const inventory of sortedInventories) {
        const available =
          (Number(inventory.onHand) || 0) -
          (Number(inventory.reserved) || 0);

        if (
          available < item.quantity
        ) {
          continue;
        }

        try {
          reservedInventory =
            await inventoryService
              .reserveStockInTransaction(
                inventory._id,
                item.quantity,
                {
                  referenceType: "order",
                  referenceId: orderNumber,
                  actorUserId: (userId && mongoose.Types.ObjectId.isValid(userId)) ? userId : null,
                  idempotencyKey: `order-reservation-${orderNumber}-${item.productVariantId.toString()}`,
                  notes:
                    "Inventory reserved during checkout",
                },
                session
              );

          if (reservedInventory) {
            break;
          }
        } catch (error) {
          if (error?.code === "INSUFFICIENT_STOCK") {
            // Warehouse lost stock to concurrent reservation; try next candidate
            continue;
          }
          throw error;
        }
      }

      if (!reservedInventory) {
        throw new AppError(
          `Insufficient stock for SKU ${item.sku}`,
          409,
          "INSUFFICIENT_STOCK"
        );
      }

      item.warehouseId =
        reservedInventory.warehouseId;
    }

    return orderItems;
  };

/**
 * Create an order from the authenticated customer's
 * current active cart.
 */
const createOrderFromCurrentCart = async (
  userId,
  shippingAddressId,
  couponCode = null,
  idempotencyKey = null,
  deliveryOptionId = null,
  quoteReference = null,
  guestOptions = {}
) => {
  const isGuestOrder = Boolean(guestOptions.isGuest);
  const guestId = isGuestOrder ? (guestOptions.guestId || userId) : null;

  if (isGuestOrder) {
    const isGuestEnabled = await storefrontSettingsService.isFeatureEnabled("guestCheckout");
    if (!isGuestEnabled) {
      throw new AppError("Guest checkout is currently disabled", 403, "GUEST_CHECKOUT_DISABLED");
    }
  }

  const customer = !isGuestOrder
    ? await validateCustomer(userId)
    : {
        _id: null,
        isGuest: true,
        guestId,
        email: guestOptions.guestEmail || guestOptions.guestShippingAddress?.email,
      };

  let address = null;
  if (isGuestOrder) {
    address = guestOptions.guestShippingAddress || null;
    if (!address && shippingAddressId) {
      try {
        address = await addressRepository.findById(shippingAddressId);
      } catch {
        // Non-blocking fallback
      }
    }
  } else {
    address = await getShippingAddress(userId, shippingAddressId);
  }

  if (!address) {
    throw new AppError("Shipping address is required", 400, "INVALID_SHIPPING_ADDRESS");
  }

  let normalizedKey = null;
  let fingerprint = null;

  if (idempotencyKey !== null && idempotencyKey !== undefined) {
    normalizedKey = validateIdempotencyKey(idempotencyKey);
    fingerprint = generateCheckoutFingerprint({
      customerId: customer._id || guestId,
      shippingAddressId: shippingAddressId || (address._id ? address._id.toString() : "guest_address"),
      couponCode,
      deliveryOptionId,
    });

    const existingOrder = customer._id
      ? await orderRepository.findByCustomerIdAndIdempotencyKey(
          customer._id,
          normalizedKey
        )
      : await Order.findOne({ guestId, idempotencyKey: normalizedKey }).lean();

    if (existingOrder) {
      if (existingOrder.idempotencyFingerprint !== fingerprint) {
        throw new AppError(
          "Idempotency key already used for a different order request",
          409,
          "IDEMPOTENCY_KEY_CONFLICT"
        );
      }

      Object.defineProperty(existingOrder, "isReplay", {
        value: true,
        enumerable: false,
        configurable: true,
        writable: true,
      });

      return existingOrder;
    }
  }

  let order;
  try {
    order = await withTransaction(
      async (session) => {
        const cart = isGuestOrder
          ? await cartRepository.findActiveByGuest(guestId, null, { session })
          : await cartRepository.findActiveByCustomer(customer._id, null, { session });

        if (!cart) {
          if (normalizedKey) {
            const existingOrder =
              await orderRepository.findByCustomerIdAndIdempotencyKey(
                customer._id,
                normalizedKey,
                { session }
              );

            if (existingOrder) {
              if (existingOrder.idempotencyFingerprint !== fingerprint) {
                throw new AppError(
                  "Idempotency key already used for a different order request",
                  409,
                  "IDEMPOTENCY_KEY_CONFLICT"
                );
              }

              Object.defineProperty(existingOrder, "isReplay", {
                value: true,
                enumerable: false,
                configurable: true,
                writable: true,
              });

              return existingOrder;
            }
          }

          throw new AppError(
            "Active cart not found",
            404,
            "CART_NOT_FOUND"
          );
        }

        const orderItems =
          await validateCartItems(cart, { session });

        const currency =
          cart.currency ||
          DEFAULT_CURRENCY;

        const subtotalTotals =
          calculateOrderTotals(
            orderItems,
            currency
          );

        const subtotalMinorUnits = decimalToMinorUnits(subtotalTotals.subtotal);
        const delivery = resolveDeliveryOption(deliveryOptionId, subtotalMinorUnits);

        let isFirstOrder = false;
        if (!isGuestOrder && customer._id) {
          const previousOrder =
            await Order.findOne({
              customerId: customer._id,
            })
              .select("_id")
              .session(session)
              .lean();
          isFirstOrder = !previousOrder;
        }

        let couponResult = null;

        if (couponCode) {
          const itemDisallowingCoupons = orderItems.find((it) => it.allowCoupons === false);
          if (itemDisallowingCoupons) {
            throw new AppError(
              `Coupon cannot be combined with promotional item '${itemDisallowingCoupons.productName}'`,
              400,
              "COUPON_STACKING_DISALLOWED"
            );
          }

          couponResult =
            await couponService.validateCoupon({
              code: couponCode,
              customerId: customer._id || null,
              orderAmount:
                Number(
                  subtotalTotals.subtotal
                ),
              items: orderItems.map(
                (item) => ({
                  productId:
                    item.productId,
                  categoryId:
                    item.categoryId,
                  vendorId:
                    item.vendorId,
                  lineTotal:
                    item.lineTotal,
                  quantity:
                    item.quantity,
                })
              ),
              isFirstOrder,
            });
        }

        const couponDiscountMinorUnits =
          couponResult
            ? decimalToMinorUnits(
                couponResult.discountAmount
              )
            : 0;

        const taxCalculation =
          await taxService.calculateOrderTax({
            items: orderItems,
            shippingAddress: address,
            couponDiscountMinorUnits,
            shippingTotalMinorUnits: delivery.feeMinorUnits,
            pricingMode: DEFAULT_TAX_PRICING_MODE,
            currency,
            session,
          });

        const finalizedOrderItems = taxCalculation.items;

        const totals =
          calculateOrderTotals(
            finalizedOrderItems,
            currency,
            couponDiscountMinorUnits,
            taxCalculation,
            delivery.feeMinorUnits
          );

        if (quoteReference) {
          const verifiedQuote = verifyQuoteReference(quoteReference, {
            customerId: isGuestOrder ? guestId : customer._id.toString(),
            cartId: cart._id.toString(),
          });

          if (verifiedQuote.currency && verifiedQuote.currency !== currency) {
            throw new AppError("Currency does not match quote", 409, "PRICE_CHANGED", {
              quotedCurrency: verifiedQuote.currency,
              currentCurrency: currency,
              quotedGrandTotal: verifiedQuote.quotedGrandTotal,
              currentGrandTotal: totals.grandTotal,
            });
          }

          if (toStandardDecimalString(verifiedQuote.quotedGrandTotal) !== toStandardDecimalString(totals.grandTotal)) {
            throw new AppError(
              "Order grand total has changed since checkout quote was issued",
              409,
              "PRICE_CHANGED",
              {
                quotedGrandTotal: toStandardDecimalString(verifiedQuote.quotedGrandTotal),
                currentGrandTotal: toStandardDecimalString(totals.grandTotal),
                reason: "grand_total_changed",
              }
            );
          }

          if (verifiedQuote.pricingFingerprint) {
            const currentFingerprint = computePricingFingerprint({
              items: finalizedOrderItems,
              currency,
              subtotal: totals.subtotal,
              discountTotal: totals.discountTotal,
              shippingTotal: totals.shippingTotal,
              taxTotal: totals.taxTotal,
              grandTotal: totals.grandTotal,
              deliveryOptionId: delivery.id,
              couponCode: couponResult?.coupon?.code || null,
            });

            if (verifiedQuote.pricingFingerprint !== currentFingerprint) {
              throw new AppError(
                "Order pricing components have changed since checkout quote was issued",
                409,
                "PRICE_CHANGED",
                {
                  quotedGrandTotal: toStandardDecimalString(verifiedQuote.quotedGrandTotal),
                  currentGrandTotal: toStandardDecimalString(totals.grandTotal),
                  reason: "component_changed",
                  previousQuote: verifiedQuote.snapshot || null,
                  currentQuote: {
                    subtotal: totals.subtotal,
                    discountTotal: totals.discountTotal,
                    shippingTotal: totals.shippingTotal,
                    taxTotal: totals.taxTotal,
                    grandTotal: totals.grandTotal,
                    currency,
                    deliveryOptionId: delivery.id,
                    couponCode: couponResult?.coupon?.code || null,
                    items: finalizedOrderItems,
                  },
                }
              );
            }
          }
        }

        const orderNumber =
          generateOrderNumber();

        await reserveInventoryForOrderItems(
          finalizedOrderItems,
          orderNumber,
          userId,
          session
        );

        const fullName = [
          address.firstName,
          address.lastName,
        ]
          .filter(Boolean)
          .join(" ")
          .trim() || (address.fullName ? address.fullName.trim() : "");

        if (!fullName) {
          throw new AppError(
            "Shipping address name is invalid",
            400,
            "INVALID_SHIPPING_ADDRESS"
          );
        }

        const actorId = customer._id ? customer._id.toString() : (guestId || "guest");
        const actorType = isGuestOrder ? "guest" : "customer";

        const initialTimeline = [
          {
            event: "order_created",
            title: "Order Created",
            description: `Order #${orderNumber} created with total ${totals.currency} ${totals.grandTotal}.`,
            timestamp: new Date(),
            actor: {
              actorType,
              actorId,
            },
            metadata: {
              orderNumber,
              grandTotal: totals.grandTotal,
            },
          },
          {
            event: "address_selected",
            title: "Delivery Address Selected",
            description: `${fullName}, ${address.addressLine1}, ${address.city}, ${address.state} - ${address.postalCode}`,
            timestamp: new Date(),
            actor: {
              actorType,
              actorId,
            },
            metadata: {
              shippingAddressId: address._id ? address._id.toString() : null,
              postalCode: address.postalCode,
            },
          },
          {
            event: "delivery_selected",
            title: "Delivery Option Selected",
            description: `${delivery.name} (${delivery.estimatedDays}) — ${delivery.feeMinorUnits === 0 ? "FREE" : `₹${Number(delivery.cost)}`}`,
            timestamp: new Date(),
            actor: {
              actorType,
              actorId,
            },
            metadata: {
              deliveryOptionId: delivery.id,
              shippingCost: delivery.cost,
            },
          },
        ];

        if (couponResult) {
          initialTimeline.push({
            event: "coupon_applied",
            title: `Coupon ${couponResult.coupon.code} Applied`,
            description: `Discount of ₹${couponResult.discountAmount} applied to order.`,
            timestamp: new Date(),
            actor: {
              actorType,
              actorId,
            },
            metadata: {
              couponCode: couponResult.coupon.code,
              discountAmount: couponResult.discountAmount,
            },
          });
        }

        initialTimeline.push({
          event: "inventory_reserved",
          title: "Inventory Reserved",
          description: `Inventory reserved for ${finalizedOrderItems.length} items.`,
          timestamp: new Date(),
          actor: {
            actorType: "system",
            actorId: null,
          },
          metadata: {
            itemCount: finalizedOrderItems.length,
          },
        });

        const uniqueVendorIds = [
          ...new Set(finalizedOrderItems.map((it) => it.vendorId?.toString()).filter(Boolean)),
        ];
        const initialVendorFulfillments = uniqueVendorIds.map((vId) => ({
          vendorId: new mongoose.Types.ObjectId(vId),
          acceptanceStatus: "pending",
          version: 1,
        }));

        const guestOrderAccessToken = isGuestOrder
          ? `ord_tok_${crypto.randomBytes(24).toString("hex")}`
          : null;

        const createdOrder =
          await orderRepository.create(
            {
              orderNumber,

              customerId:
                customer._id || null,

              isGuestOrder,
              guestId: isGuestOrder ? guestId : null,
              guestEmail: isGuestOrder ? (guestOptions.guestEmail || address.email || null) : null,
              guestOrderAccessToken,

              vendorFulfillments: initialVendorFulfillments,

              quoteReference: quoteReference || null,

              storeId:
                cart.storeId || null,

              couponId:
                couponResult?.coupon?._id ||
                null,

              couponCode:
                couponResult?.coupon?.code ||
                null,

              status: "pending",
              paymentStatus: "pending",
              fulfillmentStatus:
                "unfulfilled",

              pricingMode:
                totals.pricingMode,

              currency,

              items: finalizedOrderItems,

              subtotal:
                totals.subtotal,

              productDiscountTotal:
                totals.productDiscountTotal ||
                minorUnitsToDecimalString(
                  finalizedOrderItems.reduce((acc, it) => {
                    const diff = Math.max(0, (Number(it.regularPrice?.toString() || 0) - Number(it.unitPrice?.toString() || 0)));
                    return acc + Math.round(diff * 100) * (it.quantity || 1);
                  }, 0)
                ),

              discountTotal:
                totals.discountTotal,

              couponDiscount:
                totals.discountTotal,

              amountPaid: "0.00",
              amountRefunded: "0.00",

              taxTotal:
                totals.taxTotal,

              taxSnapshot:
                taxCalculation.taxSnapshot,

              shippingTotal:
                totals.shippingTotal,

              grandTotal:
                totals.grandTotal,

              deliveryOption: {
                id: delivery.id,
                name: delivery.name,
                cost: delivery.cost,
                estimatedDays: delivery.estimatedDays,
              },

              shippingAddress: {
                fullName,
                phone: address.phone,
                addressLine1:
                  address.addressLine1,
                addressLine2:
                  address.addressLine2 || "",
                city: address.city,
                state: address.state,
                postalCode:
                  address.postalCode,
                country:
                  address.country || "IN",
              },

              timeline: initialTimeline,
              paymentAttempts: [],

              idempotencyKey: normalizedKey,
              idempotencyFingerprint: fingerprint,
            },
            { session }
          );

        if (couponResult && customer._id) {
          await couponRedemptionService
            .redeemCoupon({
              couponId:
                couponResult.coupon._id,
              customerId:
                customer._id,
              orderId:
                createdOrder._id,
              session,
            });
        }

        const convertedCart =
          await cartRepository
            .convertActiveCart(
              cart._id,
              { session }
            );

        if (!convertedCart) {
          throw new AppError(
            "Cart could not be converted",
            409,
            "CART_CONVERSION_FAILED"
          );
        }

        /**
         * Create the order-confirmation outbox record
         * inside the same MongoDB transaction.
         *
         * If the order transaction rolls back,
         * the notification record also rolls back.
         */
        if (customer.userId) {
          const user =
            await User.findById(
              customer.userId
            )
              .select(
                "email firstName lastName"
              )
              .session(session)
              .lean();

          if (user?.email) {
            const customerName = [
              user.firstName,
              user.lastName,
            ]
              .filter(Boolean)
              .join(" ")
              .trim();

            await notificationOutboxService.enqueue({
              type: "order_confirmation",
              channel: "email",
              recipient: user.email,
              payload: {
                customerName,
                orderNumber:
                  createdOrder.orderNumber,
              },
              session,
            });
          }
        }
        return createdOrder;
      }
    );
  } catch (error) {
    const isDuplicateKeyError =
      error?.code === 11000 ||
      Boolean(error?.message && error.message.includes("E11000"));

    if (isDuplicateKeyError && normalizedKey) {
      let winningOrder = customer._id
        ? await orderRepository.findByCustomerIdAndIdempotencyKey(
            customer._id,
            normalizedKey
          )
        : await Order.findOne({ guestId, idempotencyKey: normalizedKey }).lean();

      if (!winningOrder) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        winningOrder = customer._id
          ? await orderRepository.findByCustomerIdAndIdempotencyKey(
              customer._id,
              normalizedKey
            )
          : await Order.findOne({ guestId, idempotencyKey: normalizedKey }).lean();
      }

      if (winningOrder) {
        if (winningOrder.idempotencyFingerprint !== fingerprint) {
          throw new AppError(
            "Idempotency key already used for a different order request",
            409,
            "IDEMPOTENCY_KEY_CONFLICT"
          );
        }

        Object.defineProperty(winningOrder, "isReplay", {
          value: true,
          enumerable: false,
          configurable: true,
          writable: true,
        });

        return winningOrder;
      }
    }

    throw error;
  }

  return order;
};

/**
 * Get one order belonging to the customer.
 */
const getOrderById = async (
  orderId,
  userId,
  options = {}
) => {
  if (!orderId) {
    throw new AppError("Invalid order ID", 400, "INVALID_ORDER_ID");
  }

  const order = await orderRepository.findById(orderId);
  if (!order) {
    throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  if (options.isGuest || options.guestId || options.guestOrderAccessToken || options.token) {
    const token = options.guestOrderAccessToken || options.token;
    if (token) {
      if (order.guestOrderAccessToken !== token) {
        throw new AppError("You are not allowed to access this order", 403, "ORDER_ACCESS_DENIED");
      }
      return order;
    }
    const guestId = options.guestId || userId;
    if (guestId && order.guestId === guestId) {
      return order;
    }
    throw new AppError("You are not allowed to access this order", 403, "ORDER_ACCESS_DENIED");
  }

  const customer = await validateCustomer(userId);
  if (!order.customerId || order.customerId.toString() !== customer._id.toString()) {
    throw new AppError("You are not allowed to access this order", 403, "ORDER_ACCESS_DENIED");
  }

  return order;
};

/**
 * Link a guest order to an authenticated customer account.
 */
const linkGuestOrderToCustomer = async ({
  customerUserId,
  orderId,
  orderAccessToken,
  guestSessionToken,
}) => {
  const customer = await validateCustomer(customerUserId);
  if (!orderId) {
    throw new AppError("Invalid order ID", 400, "INVALID_ORDER_ID");
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  if (!order.isGuestOrder) {
    throw new AppError("Order is not a guest order", 400, "ORDER_ALREADY_LINKED");
  }

  if (!orderAccessToken || order.guestOrderAccessToken !== orderAccessToken) {
    throw new AppError("Invalid guest order access token", 403, "INVALID_ORDER_ACCESS_TOKEN");
  }

  order.customerId = customer._id;
  order.isGuestOrder = false;
  order.guestId = null;
  order.guestOrderAccessToken = null;
  await order.save();

  return order;
};

/**
 * Get all orders belonging to the authenticated customer.
 */
const getCustomerOrders = async (
  userId
) => {
  const customer =
    await validateCustomer(userId);

  return orderRepository.findByCustomer(
    customer._id
  );
};

/**
 * Send an order status notification.
 *
 * Cancellation uses the dedicated cancellation
 * notification template.
 *
 * Notification failure must never invalidate
 * an already successful order status transition.
 */
const sendOrderStatusNotification = async ({
  order,
}) => {
  try {
    if (!order?.customerId) {
      return;
    }

    const customer =
      await Customer.findById(
        order.customerId
      ).lean();

    if (!customer?.userId) {
      return;
    }

    const user =
      await User.findById(
        customer.userId
      )
        .select(
          "email firstName lastName"
        )
        .lean();

    if (!user?.email) {
      return;
    }

    const customerName = [
      user.firstName,
      user.lastName,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (order.status === "cancelled") {
  await notificationOutboxService.enqueue({
    type: "order_cancellation",
    channel: "email",
    recipient: user.email,
    payload: {
      customerName,
      orderNumber: order.orderNumber,
    },
  });

  return;
}

    await notificationService
      .sendOrderStatusUpdate({
        to: user.email,
        customerName,
        orderNumber:
          order.orderNumber,
        status: order.status,
      });
  } catch (error) {
    console.error(
      "Order status notification failed:",
      error
    );
  }
};

/**
 * Safely transition an order between allowed states.
 *
 * If an external MongoDB session is provided,
 * the caller owns the transaction and commit.
 *
 * Therefore notification is NOT sent here.
 */
const cancelOrder = async (orderId, options = {}) => {
  const userId = options.userId;

  if (!userId) {
    throw new AppError(
      "User ID is required",
      400,
      "USER_ID_REQUIRED"
    );
  }

  let customer = null;
  if (!options.isAdmin) {
    customer = await validateCustomer(userId);
  }

  const order = await orderRepository.findById(
    orderId,
    options
  );

  if (!order) {
    throw new AppError(
      "Order not found",
      404,
      "ORDER_NOT_FOUND"
    );
  }

  if (
    !options.isAdmin &&
    customer &&
    order.customerId.toString() !==
    customer._id.toString()
  ) {
    throw new AppError(
      "You are not allowed to access this order",
      403,
      "ORDER_ACCESS_DENIED"
    );
  }

  if (order.status === "cancelled") {
    return order;
  }

  if (
    !["pending", "confirmed", "processing"].includes(
      order.status
    )
  ) {
    throw new AppError(
      `Order cannot be cancelled from status ${order.status}`,
      409,
      "ORDER_CANNOT_BE_CANCELLED"
    );
  }

  /*
   * Dispatched order pre-shipment cancellation guard:
   * Packages in transit or delivered cannot be cancelled directly by customers.
   */
  const rawItemIds = options.itemIds || options.orderItemId;
  const targetItemIds = rawItemIds
    ? (Array.isArray(rawItemIds) ? rawItemIds.map((id) => id?.toString?.() || String(id)) : [rawItemIds?.toString?.() || String(rawItemIds)])
    : null;

  const existingShipments =
    (mongoose.Types.ObjectId.isValid(orderId)
      ? await shipmentRepository.findByOrderId(orderId, options)
      : []) || [];

  if (!options.isAdmin) {
    if (targetItemIds && targetItemIds.length > 0) {
      const dispatchedForItems = existingShipments.find((s) =>
        ["picked_up", "in_transit", "out_for_delivery", "delivered"].includes(s.status) &&
        (s.items || []).some((si) =>
          targetItemIds.includes(si.orderItemId?.toString()) ||
          targetItemIds.includes(si.productVariantId?.toString())
        )
      );
      if (dispatchedForItems) {
        throw new AppError(
          "Order item or package has already been dispatched and cannot be cancelled directly. You may refuse delivery at the doorstep or request a return after delivery.",
          409,
          "ORDER_ALREADY_DISPATCHED"
        );
      }
    } else {
      const dispatchedShipment = existingShipments.find((s) =>
        ["picked_up", "in_transit", "out_for_delivery", "delivered"].includes(s.status)
      );
      if (dispatchedShipment) {
        throw new AppError(
          "Order or package has already been dispatched and cannot be cancelled directly. You may refuse delivery at the doorstep or request a return after delivery.",
          409,
          "ORDER_ALREADY_DISPATCHED"
        );
      }
    }
  }

  let isPartialCancel = false;
  let matchingItems = [];
  let itemsToCancel = [];
  if (targetItemIds && targetItemIds.length > 0) {
    matchingItems = (order.items || []).filter((it) =>
      targetItemIds.includes(it._id?.toString()) ||
      (it.productVariantId && targetItemIds.includes(it.productVariantId.toString()))
    );

    if (matchingItems.length === 0) {
      throw new AppError("No matching order items found to cancel", 404, "ORDER_ITEMS_NOT_FOUND");
    }

    // Exclude items that are already cancelled or returned
    itemsToCancel = matchingItems.filter(
      (it) => it.fulfillmentStatus !== "cancelled" && it.returnStatus !== "completed"
    );

    // If all requested items have already been cancelled, this is an idempotent retry
    if (itemsToCancel.length === 0) {
      return order;
    }

    const hasAlreadyCancelledItems = (order.items || []).some(
      (it) => it.fulfillmentStatus === "cancelled"
    );
    const nonCancelledItems = (order.items || []).filter((it) => it.fulfillmentStatus !== "cancelled");
    const isAllItems =
      !hasAlreadyCancelledItems &&
      nonCancelledItems.length === itemsToCancel.length &&
      nonCancelledItems.every((it) =>
        itemsToCancel.some((m) => m._id?.toString() === it._id?.toString())
      );

    if (!isAllItems) {
      isPartialCancel = true;
    }
  } else {
    itemsToCancel = (order.items || []).filter(
      (it) => it.fulfillmentStatus !== "cancelled" && it.returnStatus !== "completed"
    );
  }

  /*
   * PHASE 1: Atomic Business-State Claim (Distributed Saga Mutual Exclusion)
   * Atomically claim the cancellation intent across shipments and order items
   * BEFORE initiating any irreversible external payment gateway refunds.
   * If any package has already been dispatched, the claim fails closed and
   * zero money is refunded.
   */
  const operationId = `op_cancel_${order._id.toString()}_${Date.now()}`;
  let claimResult = { claimed: true, shipments: [], dispatchedShipments: [] };

  if (typeof shipmentRepository.claimOrderShipmentsCancellation === "function") {
    claimResult = await shipmentRepository.claimOrderShipmentsCancellation(order._id, {
      targetItemIds: targetItemIds || null,
      userId,
      operationId,
    });
  } else if (!options.isAdmin) {
    const freshCheck = await shipmentRepository.findByOrderId(order._id, options);
    const dispatched = (freshCheck || []).filter((s) =>
      ["picked_up", "in_transit", "out_for_delivery", "delivered"].includes(s.status) &&
      (!targetItemIds || (s.items || []).some((si) =>
        targetItemIds.includes(si.orderItemId?.toString()) ||
        targetItemIds.includes(si.productVariantId?.toString())
      ))
    );
    if (dispatched.length > 0) {
      claimResult = { claimed: false, shipments: freshCheck, dispatchedShipments: dispatched };
    }
  }

  if (claimResult && !claimResult.claimed && !options.isAdmin) {
    throw new AppError(
      "Order item or package has already been dispatched and cannot be cancelled directly. You may refuse delivery at the doorstep or request a return after delivery.",
      409,
      "ORDER_ALREADY_DISPATCHED"
    );
  }

  // Record durable in-progress cancellation intent on order if shipments were claimed
  if (claimResult?.claimed && claimResult.shipments && claimResult.shipments.length > 0) {
    try {
      if (typeof orderRepository.updateById === "function") {
        await orderRepository.updateById(order._id, {
          cancellationStatus: "pending",
          cancellationClaim: {
            claimedAt: new Date(),
            claimedBy: userId,
            operationId,
            itemIds: itemsToCancel.map((i) => i._id?.toString() || String(i)),
          },
        });
      }
    } catch (claimErr) {
      logger.warn({ orderId, error: claimErr.message }, "Non-fatal order cancellation claim record warning");
    }
  }

  /*
   * Payment-aware cancellation.
   *
   * Captured payments must be refunded before the
   * cancellation transaction is committed.
   *
   * Pending/created/failed payments do not require
   * a refund because no captured money exists.
   */
  let payment =
    await paymentService.getLatestPaymentForOrder(
      orderId
    );

  if (
    payment &&
    ["created", "pending", "authorized"].includes(payment.status) &&
    payment.gatewayOrderId
  ) {
    const paymentReconciliationService = require("./payment-reconciliation.service");
    const reconResult = await paymentReconciliationService.reconcilePayment(payment);

    if (reconResult && !reconResult.reconciled) {
      throw new AppError(
        `Order payment reconciliation is uncertain (${reconResult.reason || "GATEWAY_UNCERTAIN"}). Cancellation blocked.`,
        409,
        "PAYMENT_UNCERTAIN_RECONCILIATION_REQUIRED"
      );
    }

    payment = await paymentService.getLatestPaymentForOrder(orderId);
  }

  let refundedPayment = null;
  if (
    payment?.status === "captured" ||
    payment?.status === "partially_refunded"
  ) {
    let refundAmountToIssue = null;
    let refundKey = `order_cancel_${order._id.toString()}`;

    if (isPartialCancel) {
      const { buildOrderItemFinancialAllocationMap } = require("./return-request.service");
      const allocMap = buildOrderItemFinancialAllocationMap(order);
      let targetRefundMinor = 0;
      for (const mItem of itemsToCancel) {
        const alloc =
          allocMap.get(mItem._id?.toString()) ||
          allocMap.get(`${mItem.productId}_${mItem.productVariantId || ""}`);
        if (alloc && alloc.itemCustomerPaidTotalMinor > 0) {
          targetRefundMinor += alloc.itemCustomerPaidTotalMinor;
        } else {
          const uPrice = Math.round(Number(mItem.unitPrice?.toString() || 0) * 100);
          targetRefundMinor += uPrice * (mItem.quantity || 1);
        }
      }
      refundAmountToIssue = Number((targetRefundMinor / 100).toFixed(2));
      refundKey = `order_cancel_item_${order._id.toString()}_${itemsToCancel.map((i) => i._id.toString()).join("_")}`;
    }

    if (!isPartialCancel || (refundAmountToIssue && refundAmountToIssue > 0)) {
      try {
        refundedPayment = await paymentService.refundPaymentForOrder(
          orderId,
          userId,
          refundAmountToIssue,
          refundKey
        );
      } catch (refError) {
        if (refError.code === "REFUND_LOCAL_SYNC_FAILED") {
          logger.warn(
            { orderId, error: refError.message },
            "Order cancellation: refund succeeded at gateway with local sync warning"
          );
        } else {
          // If refund failed before gateway execution or with unrecoverable error, release shipment claim
          if (claimResult?.claimed && typeof shipmentRepository.releaseShipmentCancellationClaim === "function") {
            for (const cs of claimResult.shipments || []) {
              await shipmentRepository.releaseShipmentCancellationClaim(cs._id, { previousStatus: "ready_to_ship" });
            }
          }
          throw refError;
        }
      }
    }
  }

  if (
    payment &&
    ![
      "created",
      "pending",
      "authorized",
      "failed",
      "captured",
      "refunded",
      "partially_refunded",
      "cancelled",
    ].includes(payment.status)
  ) {
    throw new AppError(
      `Order payment cannot be cancelled from payment status ${payment.status}`,
      409,
      "ORDER_PAYMENT_CANCELLATION_BLOCKED"
    );
  }

  let wasAlreadyCancelled = false;

  let cancelledOrder;
  try {
    cancelledOrder = await withTransaction(
      async (session) => {
        wasAlreadyCancelled = false;

        const currentOrder =
          await orderRepository.findById(
            orderId,
            { session }
          );

        if (!currentOrder) {
          throw new AppError(
            "Order not found",
            404,
            "ORDER_NOT_FOUND"
          );
        }

      if (currentOrder.status === "cancelled") {
        wasAlreadyCancelled = true;
        return currentOrder;
      }

      // Re-verify shipment dispatch status inside the transaction to eliminate cancellation vs dispatch races
      if (!options.isAdmin) {
        const freshShipments = mongoose.Types.ObjectId.isValid(orderId)
          ? await shipmentRepository.findByOrderId(orderId, { session })
          : [];

        if (isPartialCancel) {
          const dispatchedForItems = freshShipments.find((s) =>
            ["picked_up", "in_transit", "out_for_delivery", "delivered"].includes(s.status) &&
            (s.items || []).some((si) =>
              itemsToCancel.some((it) =>
                it._id?.toString() === si.orderItemId?.toString() ||
                (it.productVariantId && it.productVariantId.toString() === si.productVariantId?.toString())
              )
            )
          );
          if (dispatchedForItems) {
            throw new AppError(
              "Order item or package has already been dispatched and cannot be cancelled directly. You may refuse delivery at the doorstep or request a return after delivery.",
              409,
              "ORDER_ALREADY_DISPATCHED"
            );
          }
        } else {
          const dispatchedShipment = freshShipments.find((s) =>
            ["picked_up", "in_transit", "out_for_delivery", "delivered"].includes(s.status)
          );
          if (dispatchedShipment) {
            throw new AppError(
              "Order or package has already been dispatched and cannot be cancelled directly. You may refuse delivery at the doorstep or request a return after delivery.",
              409,
              "ORDER_ALREADY_DISPATCHED"
            );
          }
        }
      }

      if (isPartialCancel) {
        for (const item of currentOrder.items) {
          const isTarget = itemsToCancel.some(
            (m) => m._id?.toString() === item._id?.toString()
          );
          if (!isTarget || item.fulfillmentStatus === "cancelled") {
            continue;
          }

          if (
            item.inventoryStatus === "reserved" &&
            item.warehouseId &&
            !item.isVirtual &&
            !item.isDownloadable
          ) {
            const inventory =
              await inventoryRepository.findByVariantAndWarehouse(
                item.productVariantId,
                item.warehouseId,
                { session }
              );

            if (inventory) {
              const itemReleaseKey = `order-reservation-release-${currentOrder._id.toString()}-${item.productVariantId.toString()}-${item.warehouseId ? item.warehouseId.toString() : "digital"}`;
              await inventoryService.releaseStockInTransaction(
                inventory._id,
                item.quantity,
                {
                  referenceType: "order",
                  referenceId: currentOrder.orderNumber,
                  idempotencyKey: itemReleaseKey,
                  notes: "Inventory released due to partial item cancellation",
                },
                session
              );
            }
          }

          item.inventoryStatus = "released";
          item.inventoryReleasedAt = new Date();
          item.fulfillmentStatus = "cancelled";
          item.cancelledAt = new Date();
        }

        const shipments = mongoose.Types.ObjectId.isValid(orderId)
          ? await shipmentRepository.findByOrderId(orderId, { session })
          : [];

        for (const shipment of shipments) {
          if (["created", "ready_to_ship", "cancellation_pending", "booking_pending", "booked", "awb_assigned", "label_available", "pickup_scheduled"].includes(shipment.status)) {
            const shipmentItemsAllCancelled = (shipment.items || []).every((si) => {
              const oItem = currentOrder.items.find(
                (oi) => oi._id?.toString() === si.orderItemId?.toString()
              );
              return oItem?.fulfillmentStatus === "cancelled";
            });

            if (shipmentItemsAllCancelled) {
              await shipmentRepository.updateById(
                shipment._id,
                {
                  status: "cancelled",
                  cancelledAt: new Date(),
                  inventoryStatus: "released",
                  inventoryReleasedAt: new Date(),
                  dispatchBlocked: true,
                },
                { session }
              );
            }
          }
        }

        if (refundedPayment) {
          currentOrder.paymentStatus = "partially_refunded";
        }

        const hasActiveItems = currentOrder.items.some(
          (it) => it.fulfillmentStatus !== "cancelled"
        );

        if (!hasActiveItems) {
          // Revoke any digital entitlements for cancelled order
        await digitalEntitlementService.revokeEntitlementsForOrder(
          orderId,
          options.cancellationReason || "Order cancelled",
          null,
          { session }
        );

        return transitionOrderStatus(orderId, "cancelled", {
            session,
            paymentStatus: refundedPayment ? "refunded" : currentOrder.paymentStatus,
            inventoryStatus: "released",
            inventoryReleasedAt: new Date(),
            items: currentOrder.items,
            cancellationReason: options.cancellationReason,
            cancellationStatus: "completed",
          });
        }

        const anyFulfilled = currentOrder.items.some(
          (it) => it.fulfillmentStatus === "fulfilled"
        );
        currentOrder.fulfillmentStatus = anyFulfilled
          ? "partially_fulfilled"
          : "unfulfilled";

        await orderRepository.updateById(
          currentOrder._id,
          {
            items: currentOrder.items,
            paymentStatus: currentOrder.paymentStatus,
            fulfillmentStatus: currentOrder.fulfillmentStatus,
            cancellationStatus: "completed",
          },
          { session }
        );

        return currentOrder;
      }

      for (const item of currentOrder.items) {
        if (
          item.inventoryStatus === "released" ||
          item.inventoryStatus === "deducted" ||
          item.inventoryStatus === "not_required" ||
          !item.warehouseId ||
          item.isVirtual ||
          item.isDownloadable
        ) {
          continue;
        }

        const inventory =
          await inventoryRepository.findByVariantAndWarehouse(
            item.productVariantId,
            item.warehouseId,
            { session }
          );

        if (!inventory) {
          throw new AppError(
            `Inventory record not found for SKU ${item.sku}`,
            404,
            "INVENTORY_NOT_FOUND"
          );
        }

        await inventoryService.releaseStockInTransaction(
          inventory._id,
          item.quantity,
          {
            referenceType: "order",
            referenceId: currentOrder.orderNumber,
            idempotencyKey: `order-reservation-release-${currentOrder._id.toString()}-${item.productVariantId.toString()}-${item.warehouseId ? item.warehouseId.toString() : "digital"}`,
            notes:
              "Inventory released due to order cancellation",
          },
          session
        );

        item.inventoryStatus = "released";
        item.inventoryReleasedAt = new Date();
      }

      const shipments = mongoose.Types.ObjectId.isValid(orderId)
        ? await shipmentRepository.findByOrderId(orderId, { session })
        : [];

      for (const shipment of shipments) {
        if (["created", "ready_to_ship", "cancellation_pending", "booking_pending", "booked", "awb_assigned", "label_available", "pickup_scheduled"].includes(shipment.status)) {
          await shipmentRepository.updateById(
            shipment._id,
            {
              status: "cancelled",
              cancelledAt: new Date(),
              inventoryStatus: "released",
              inventoryReleasedAt: new Date(),
              dispatchBlocked: true,
            },
            { session }
          );
        } else if (shipment.inventoryStatus === "reserved") {
          await shipmentRepository.updateById(
            shipment._id,
            {
              inventoryStatus: "released",
              inventoryReleasedAt: new Date(),
            },
            { session }
          );
        }
      }

      const currentPayment =
        (await paymentRepository.findLatestByOrderId(
          orderId,
          { session }
        )) ||
        refundedPayment ||
        payment;

      let orderPaymentStatus;

      if (currentPayment) {
        if (
          ["created", "pending", "authorized"].includes(
            currentPayment.status
          )
        ) {
          const cancelledPayment =
            typeof paymentRepository.cancelPendingPayment === "function"
              ? await paymentRepository.cancelPendingPayment(
                  currentPayment._id,
                  { session }
                )
              : await paymentRepository.updateById(
                  currentPayment._id,
                  { status: "cancelled" },
                  { session }
                );

          if (!cancelledPayment) {
            throw new AppError(
              "Payment state changed during cancellation. Please retry.",
              409,
              "PAYMENT_STATE_CONFLICT"
            );
          }
        } else if (
          !refundedPayment &&
          (currentPayment.status === "captured" ||
           currentPayment.status === "partially_refunded")
        ) {
          throw new AppError(
            "Payment was captured concurrently. Please retry cancellation to trigger refund.",
            409,
            "PAYMENT_CAPTURED_CONCURRENTLY"
          );
        } else if (currentPayment.status === "refunded" || refundedPayment) {
          orderPaymentStatus = refundedPayment ? (isPartialCancel ? "partially_refunded" : "refunded") : "refunded";
        }
      }

      /*
       * Idempotently rollback coupon usage for this specific order.
       * Only decrement global usage if an active redemption for this order was deleted.
       */
      if (currentOrder.couponId) {
        const rollbackRedemption =
          await couponRedemptionRepository.deleteByOrderId(
            currentOrder._id,
            { session }
          );

        if (rollbackRedemption) {
          await couponRepository.decrementUsage(
            currentOrder.couponId,
            { session }
          );
        }
      }

        // Revoke any digital entitlements for cancelled order
        await digitalEntitlementService.revokeEntitlementsForOrder(
          orderId,
          options.cancellationReason || "Order cancelled",
          null,
          { session }
        );

        return transitionOrderStatus(
          orderId,
          "cancelled",
          {
            session,
            paymentStatus: orderPaymentStatus,
            inventoryStatus: "released",
            inventoryReleasedAt: new Date(),
            items: currentOrder.items,
            cancellationReason: options.cancellationReason,
          }
        );
      }
    );
  } catch (error) {
    const isIdempotencyConflict =
      (error?.code === 11000 || error?.message?.includes("E11000")) &&
      (error?.keyPattern?.idempotencyKey || error?.message?.includes("idempotencyKey"));

    if (isIdempotencyConflict) {
      const freshOrder = await orderRepository.findById(orderId, options);
      if (freshOrder && freshOrder.status === "cancelled") {
        return freshOrder;
      }
    }

    throw error;
  }

  if (!wasAlreadyCancelled) {
    await sendOrderStatusNotification({
      order: cancelledOrder,
    });

    try {
      const { createCustomerNotification } = require("./customer-notification.service");
      await createCustomerNotification({
        customerId: customer._id,
        userId,
        title: `Order #${cancelledOrder.orderNumber} Cancelled`,
        message: `Your order #${cancelledOrder.orderNumber} has been successfully cancelled. Reason: ${options.cancellationReason || "Customer requested cancellation"}.`,
        type: "cancellation",
        link: `/orders/${cancelledOrder._id}`,
      });
    } catch {
      // Non-blocking notification
    }

    try {
      const rewardService = require("./reward.service");
      await rewardService.adjustPointsForCancelledOrRefundedOrder(cancelledOrder._id);
    } catch {
      // Non-blocking reward adjustment
    }
  }

  return cancelledOrder;
};

const expirePendingOrder = async (orderId, options = {}) => {
  const initialOrder = await orderRepository.findById(orderId, options);

  if (!initialOrder) {
    throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  if (initialOrder.status === "cancelled") {
    return initialOrder;
  }

  if (initialOrder.status !== "pending") {
    throw new AppError(
      `Only pending orders can be expired, order is ${initialOrder.status}`,
      409,
      "ORDER_NOT_PENDING"
    );
  }

  let wasAlreadyCancelled = false;
  let expiredOrder;

  try {
    expiredOrder = await withTransaction(async (session) => {
      wasAlreadyCancelled = false;

      const currentOrder = await orderRepository.findById(orderId, { session });

      if (!currentOrder) {
        throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
      }

      if (currentOrder.status === "cancelled") {
        wasAlreadyCancelled = true;
        return currentOrder;
      }

      if (currentOrder.status !== "pending") {
        throw new AppError(
          `Order status changed to ${currentOrder.status}. Cannot expire.`,
          409,
          "ORDER_NOT_PENDING"
        );
      }

      // Re-read and inspect all payments associated with this order inside the session
      const payments = await paymentRepository.findByOrderId(orderId, { session });

      const hasCaptured = payments.some(
        (p) => p.status === "captured" || p.status === "paid"
      );
      if (hasCaptured) {
        throw new AppError(
          "Payment was captured. Cannot expire order.",
          409,
          "PAYMENT_STATE_CONFLICT"
        );
      }

      const hasAuthorized = payments.some((p) => p.status === "authorized");
      if (hasAuthorized) {
        throw new AppError(
          "Payment is authorized. Cannot expire order.",
          409,
          "PAYMENT_STATE_CONFLICT"
        );
      }

      // Atomically cancel any active uncompleted created/pending payments
      for (const payment of payments) {
        if (["created", "pending"].includes(payment.status)) {
          const cancelledPayment =
            typeof paymentRepository.cancelUncompletedPayment === "function"
              ? await paymentRepository.cancelUncompletedPayment(payment._id, { session })
              : await paymentRepository.cancelPendingPayment(payment._id, { session });

          if (!cancelledPayment) {
            throw new AppError(
              "Payment state changed concurrently during expiration.",
              409,
              "PAYMENT_STATE_CONFLICT"
            );
          }
        }
      }

      // Atomically claim the pending order before ANY inventory release
      const initialCancellationUpdate = {
        status: "cancelled",
        cancelledAt: new Date(),
        cancellationStatus: "completed",
        paymentStatus: "failed",
        inventoryStatus: "released",
        inventoryReleasedAt: new Date(),
      };

      const claimedOrder = await orderRepository.transitionStatusIfCurrent(
        orderId,
        "pending",
        initialCancellationUpdate,
        { session }
      );

      if (!claimedOrder) {
        const freshOrder = await orderRepository.findById(orderId, { session });
        if (freshOrder && freshOrder.status === "cancelled") {
          wasAlreadyCancelled = true;
          return freshOrder;
        }

        throw new AppError(
          `Order status changed concurrently to ${freshOrder?.status || "unknown"}. Cannot expire.`,
          409,
          "ORDER_NOT_PENDING"
        );
      }

      // Release reserved inventory using canonical idempotency keys
      for (const item of currentOrder.items) {
        if (
          item.inventoryStatus === "released" ||
          item.inventoryStatus === "deducted" ||
          item.inventoryStatus === "not_required" ||
          !item.warehouseId ||
          item.isVirtual ||
          item.isDownloadable
        ) {
          continue;
        }

        const inventory = await inventoryRepository.findByVariantAndWarehouse(
          item.productVariantId,
          item.warehouseId,
          { session }
        );

        if (!inventory) {
          throw new AppError(
            `Inventory record not found for SKU ${item.sku}`,
            404,
            "INVENTORY_NOT_FOUND"
          );
        }

        await inventoryService.releaseStockInTransaction(
          inventory._id,
          item.quantity,
          {
            referenceType: "order",
            referenceId: currentOrder.orderNumber,
            idempotencyKey: `order-reservation-release-${currentOrder._id.toString()}-${item.productVariantId.toString()}-${item.warehouseId ? item.warehouseId.toString() : "digital"}`,
            notes: "Inventory released due to order expiration",
          },
          session
        );

        item.inventoryStatus = "released";
        item.inventoryReleasedAt = new Date();
      }

      // Update items on the claimed order
      await orderRepository.updateById(
        orderId,
        { items: currentOrder.items },
        { session }
      );

      // Cancel and release any associated shipments
      const shipments = mongoose.Types.ObjectId.isValid(orderId)
        ? await shipmentRepository.findByOrderId(orderId, { session })
        : [];

      for (const shipment of shipments) {
        if (["created", "ready_to_ship"].includes(shipment.status)) {
          await shipmentRepository.updateById(
            shipment._id,
            {
              status: "cancelled",
              cancelledAt: new Date(),
              inventoryStatus: "released",
              inventoryReleasedAt: new Date(),
            },
            { session }
          );
        } else if (shipment.inventoryStatus === "reserved") {
          await shipmentRepository.updateById(
            shipment._id,
            {
              inventoryStatus: "released",
              inventoryReleasedAt: new Date(),
            },
            { session }
          );
        }
      }

      // Rollback coupon redemption idempotently if coupon applied
      if (currentOrder.couponId) {
        const rollbackRedemption =
          await couponRedemptionRepository.deleteByOrderId(
            currentOrder._id,
            { session }
          );

        if (rollbackRedemption) {
          await couponRepository.decrementUsage(
            currentOrder.couponId,
            { session }
          );
        }
      }

      claimedOrder.items = currentOrder.items;
      return claimedOrder;
    });
  } catch (error) {
    const isIdempotencyConflict =
      (error?.code === 11000 || error?.message?.includes("E11000")) &&
      (error?.keyPattern?.idempotencyKey || error?.message?.includes("idempotencyKey"));

    if (isIdempotencyConflict) {
      const freshOrder = await orderRepository.findById(orderId, options);
      if (freshOrder && freshOrder.status === "cancelled") {
        return freshOrder;
      }
    }

    throw error;
  }

  if (!wasAlreadyCancelled) {
    await sendOrderStatusNotification({
      order: expiredOrder,
    });
  }

  return expiredOrder;
};

const transitionOrderStatus = async (
  orderId,
  nextStatus,
  options = {}
) => {
  const order =
    await orderRepository.findById(
      orderId,
      options
    );

  if (!order) {
    throw new AppError(
      "Order not found",
      404,
      "ORDER_NOT_FOUND"
    );
  }

  if (
    !canTransitionOrderStatus(
      order.status,
      nextStatus
    )
  ) {
    throw new AppError(
      `Invalid order status transition from ${order.status} to ${nextStatus}`,
      409,
      "INVALID_ORDER_STATUS_TRANSITION"
    );
  }

  const update = {
    status: nextStatus,
  };

  if (options.paymentStatus) {
    update.paymentStatus = options.paymentStatus;
  }

  if (
    nextStatus === "confirmed" &&
    !order.placedAt
  ) {
    update.placedAt = new Date();
  }

  if (nextStatus === "cancelled") {
    update.cancelledAt = new Date();
    update.cancellationStatus = "completed";
    if (options.cancellationReason) {
      update.cancellationReason = options.cancellationReason;
    }
    await digitalEntitlementService.revokeEntitlementsForOrder(
      orderId,
      options.cancellationReason || "Order cancelled",
      null,
      { session: options.session }
    );
  }

  if (options.inventoryStatus) {
    update.inventoryStatus = options.inventoryStatus;
  }

  if (options.inventoryReleasedAt) {
    update.inventoryReleasedAt = options.inventoryReleasedAt;
  }

  if (options.items) {
    update.items = options.items;
  }

  if (
    nextStatus === "completed"
  ) {
    update.completedAt = new Date();
  }

  const updatedOrder =
    await orderRepository.updateById(
      orderId,
      update,
      options
    );

  if (!updatedOrder) {
    throw new AppError(
      "Unable to update order status",
      500,
      "ORDER_STATUS_UPDATE_FAILED"
    );
  }

  /**
   * If a transaction session was provided,
   * the caller owns the commit boundary.
   *
   * Do not send an external notification here.
   */
  if (options.session) {
    return updatedOrder;
  }

  /**
   * No external transaction exists.
   *
   * The update has completed successfully,
   * so notification can safely be attempted.
   */
  await sendOrderStatusNotification({
    order: updatedOrder,
  });

  return updatedOrder;
};

/**
 * Synchronize captured payment state with the order.
 */
const markOrderPaymentCaptured = async (
  orderId,
  options = {}
) => {
  const order =
    await orderRepository.findById(
      orderId,
      options
    );

  if (!order) {
    throw new AppError(
      "Order not found",
      404,
      "ORDER_NOT_FOUND"
    );
  }

  /**
   * Idempotent case: payment is already marked paid.
   */
  if (
    order.paymentStatus === "paid" &&
    order.status === "confirmed"
  ) {
    return order;
  }

  /**
   * A paid order must never be moved backwards.
   */
  if (
    order.paymentStatus === "paid"
  ) {
    return order;
  }

  if (
    !["pending", "confirmed"].includes(
      order.status
    )
  ) {
    throw new AppError(
      `Order cannot be confirmed from status ${order.status}`,
      409,
      "ORDER_CANNOT_BE_CONFIRMED"
    );
  }

  const update = {
    paymentStatus: "paid",
    amountPaid: order.grandTotal,
  };

  const attempts = Array.isArray(order.paymentAttempts) ? [...order.paymentAttempts] : [];
  if (attempts.length > 0) {
    const lastAttempt = attempts[attempts.length - 1];
    if (lastAttempt.status === "created" || lastAttempt.status === "pending") {
      lastAttempt.status = "successful";
      lastAttempt.completedAt = new Date();
    }
    attempts.forEach((att, idx) => {
      if (!att.attemptNumber) {
        att.attemptNumber = idx + 1;
      }
    });
  }
  update.paymentAttempts = attempts;

  const currentTimeline = Array.isArray(order.timeline) ? [...order.timeline] : [];
  currentTimeline.push(
    {
      event: "payment_successful",
      title: "Payment Captured Successfully",
      description: `Payment of ${order.currency || "INR"} ${order.grandTotal} captured.`,
      timestamp: new Date(),
      actor: { actorType: "system", actorId: null },
    },
    {
      event: "order_confirmed",
      title: "Order Confirmed",
      description: `Order #${order.orderNumber} confirmed and moving to fulfillment.`,
      timestamp: new Date(),
      actor: { actorType: "system", actorId: null },
    }
  );
  update.timeline = currentTimeline;

  if (
    order.status === "pending"
  ) {
    update.status = "confirmed";

    if (!order.placedAt) {
      update.placedAt = new Date();
    }
  }

  const updatedOrder =
    await orderRepository.updateById(
      orderId,
      update,
      options
    );

  if (!updatedOrder) {
    throw new AppError(
      "Unable to mark order payment as captured",
      500,
      "ORDER_PAYMENT_UPDATE_FAILED"
    );
  }

  // 1. Lock commission snapshots on order items
  await commissionService.lockOrderItemsCommissionSnapshot(updatedOrder, { session: options.session });

  // 2. Post financial ledger double-entry journal for captured payment
  await financialLedgerService.postOrderPaymentCaptureJournal(updatedOrder, { session: options.session });

  // 3. Create digital entitlements if applicable
  await digitalEntitlementService.createEntitlementsForOrder(updatedOrder, { session: options.session });

  return updatedOrder;
};

/**
 * Resolve the authenticated vendor profile ID from userId.
 */
const getVendorIdForOrderService = async (userId) => {
  const { resolveApprovedVendor } = require("../middlewares/vendor.middleware");
  const vendor = await resolveApprovedVendor(userId);
  return vendor._id;
};

/**
 * Strict multi-vendor order projection.
 * Filters items strictly to the authenticated vendor, recalculates vendor-scoped
 * subtotal and item count, minimizes customer fulfillment information, and strips
 * customer payment secrets, gateway internals, idempotency keys, and platform tax snapshots.
 */
const projectVendorOrder = (orderDoc, vendorId, vendorShipments = []) => {
  const order = orderDoc?.toObject ? orderDoc.toObject() : { ...orderDoc };
  const targetVendorIdStr = vendorId.toString();

  const vendorItems = (order.items || [])
    .filter(
      (item) => item.vendorId && item.vendorId.toString() === targetVendorIdStr
    )
    .map((item) => ({
      _id: item._id,
      productId: item.productId,
      productVariantId: item.productVariantId,
      warehouseId: item.warehouseId,
      vendorId: item.vendorId,
      sku: item.sku,
      productName: item.productName,
      variantName: item.variantName || "",
      quantity: item.quantity,
      unitPrice: item.unitPrice?.toString?.() ?? String(item.unitPrice ?? "0"),
      discountTotal:
        item.discountTotal?.toString?.() ?? String(item.discountTotal ?? "0"),
      taxTotal: item.taxTotal?.toString?.() ?? String(item.taxTotal ?? "0"),
      lineTotal: item.lineTotal?.toString?.() ?? String(item.lineTotal ?? "0"),
      currency: item.currency,
      inventoryStatus: item.inventoryStatus,
      inventoryReleasedAt: item.inventoryReleasedAt || null,
      fulfillmentStatus: item.fulfillmentStatus || "unfulfilled",
      vendorAcceptance: item.vendorAcceptance || { status: "pending" },
      assignedShipmentPartner: item.assignedShipmentPartner || null,
      expectedDeliveryDate: item.expectedDeliveryDate || null,
      isFulfillmentConfirmed: Boolean(item.isFulfillmentConfirmed),
      shipmentId: item.shipmentId ? encodeSecureId("shipment", item.shipmentId) : null,
      settlementId: item.settlementId ? encodeSecureId("settlement", item.settlementId) : null,
    }));

  let subtotalMinor = 0;
  let vendorItemCount = 0;

  for (const item of vendorItems) {
    vendorItemCount += item.quantity || 0;
    try {
      subtotalMinor += decimalToMinorUnits(item.lineTotal);
    } catch {
      // fallback if lineTotal conversion fails
    }
  }

  const vendorSubtotal = minorUnitsToDecimalString(subtotalMinor);

  const rawAddress = order.shippingAddress || {};
  const shippingAddress = {
    fullName: rawAddress.fullName || "",
    phone: rawAddress.phone || "",
    addressLine1: rawAddress.addressLine1 || "",
    addressLine2: rawAddress.addressLine2 || "",
    city: rawAddress.city || "",
    state: rawAddress.state || "",
    postalCode: rawAddress.postalCode || "",
    country: rawAddress.country || "IN",
  };

  const formattedShipments = (vendorShipments || []).map((s) => ({
    _id: s._id,
    secureId: encodeSecureId("shipment", s._id),
    shipmentNumber: s.shipmentNumber,
    status: s.status,
    carrier: s.carrier,
    serviceLevel: s.serviceLevel,
    trackingNumber: s.trackingNumber,
    trackingUrl: s.trackingUrl,
    shippedAt: s.shippedAt,
    deliveredAt: s.deliveredAt,
    createdAt: s.createdAt,
  }));

  const vf = (order.vendorFulfillments || []).find(
    (f) => f.vendorId && f.vendorId.toString() === targetVendorIdStr
  );

  const vendorFulfillment = vf
    ? (vf.toObject ? vf.toObject() : { ...vf })
    : {
        vendorId,
        acceptanceStatus: "pending",
        rejectionReason: null,
        rejectedAt: null,
        assignedShipmentPartner: null,
        expectedDeliveryDate: null,
        isFulfillmentConfirmed: false,
        fulfillmentConfirmedAt: null,
        fulfillmentStatus: "unfulfilled",
        version: 1,
      };

  const fulfillmentVersion = vendorFulfillment.version || 1;

  return {
    _id: order._id,
    secureId: encodeSecureId("order", order._id),
    orderNumber: order.orderNumber,
    status: order.status,
    fulfillmentStatus: order.fulfillmentStatus,
    currency: order.currency || "INR",
    items: vendorItems,
    itemCount: vendorItemCount,
    subtotal: vendorSubtotal,
    shippingAddress,
    shipments: formattedShipments,
    vendorFulfillment,
    fulfillmentVersion,
    placedAt: order.placedAt || null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
};

/**
 * Get all orders containing items belonging to the authenticated vendor.
 */
const getVendorOrders = async ({ userId, query = {} }) => {
  const vendorId = await getVendorIdForOrderService(userId);

  const safePage = Math.max(Number(query.page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const skip = (safePage - 1) * safeLimit;

  const filter = {};
  if (query.status && query.status !== "all") {
    filter.status = query.status;
  }
  if (query.fulfillmentStatus && query.fulfillmentStatus !== "all") {
    filter.fulfillmentStatus = query.fulfillmentStatus;
  }
  if (query.paymentStatus && query.paymentStatus !== "all") {
    filter.paymentStatus = query.paymentStatus;
  }
  if (query.search) {
    filter.$or = [
      { orderNumber: { $regex: query.search.trim(), $options: "i" } },
      { "items.sku": { $regex: query.search.trim(), $options: "i" } },
      { "items.productName": { $regex: query.search.trim(), $options: "i" } },
    ];
  }

  const { items: orders, total } = await orderRepository.findByVendor({
    vendorId,
    filter,
    skip,
    limit: safeLimit,
    sort: { createdAt: -1 },
  });

  const items = orders.map((order) => projectVendorOrder(order, vendorId));

  return {
    items,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
};

/**
 * Get single order details projected strictly to the authenticated vendor.
 * Returns 404 if the order does not exist or contains no items for this vendor.
 */
const getVendorOrderById = async ({ orderId, userId, strict = false }) => {
  const resolvedOrderId = decodeSecureId(orderId, "order", { strict });
  if (!mongoose.Types.ObjectId.isValid(resolvedOrderId)) {
    throw new AppError("Invalid order ID", 400, "INVALID_ORDER_ID");
  }

  const vendorId = await getVendorIdForOrderService(userId);

  const order = await orderRepository.findByIdAndVendor(resolvedOrderId, vendorId);

  if (!order) {
    throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  const Shipment = require("../models/Shipment");
  const vendorShipments = await Shipment.find({
    orderId: order._id,
    vendorId,
  }).lean();

  return projectVendorOrder(order, vendorId, vendorShipments);
};

/**
 * Transition order item state for vendor (e.g. process, ready_to_ship).
 */
const transitionVendorOrderItemStatus = async ({
  userId,
  orderId,
  action,
  notes = null,
  strict = false,
  ipAddress = null,
  userAgent = null,
}) => {
  const resolvedOrderId = decodeSecureId(orderId, "order", { strict });
  if (!mongoose.Types.ObjectId.isValid(resolvedOrderId)) {
    throw new AppError("Invalid order ID", 400, "INVALID_ORDER_ID");
  }

  const vendorId = await getVendorIdForOrderService(userId);
  const order = await Order.findOne({
    _id: resolvedOrderId,
    "items.vendorId": vendorId,
  });

  if (!order) {
    throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  if (order.paymentStatus !== "paid") {
    throw new AppError("Cannot process order before payment is verified and captured", 400, "ORDER_NOT_PAID");
  }

  if (["cancelled", "completed"].includes(order.status)) {
    throw new AppError(`Cannot update items for an order in status '${order.status}'`, 409, "INVALID_ORDER_STATUS");
  }

  const vf = (order.vendorFulfillments || []).find(
    (f) => f.vendorId && f.vendorId.toString() === vendorId.toString()
  );
  if (!vf || !vf.isFulfillmentConfirmed) {
    const { validateConfirmationPrerequisites } = require("./order-fulfillment.service");
    validateConfirmationPrerequisites(order, vendorId);
  }

  const AuditLog = require("../models/AuditLog");
  let auditAction = "";
  let targetItemStatus = "";
  let timelineTitle = "";
  let timelineDesc = "";

  if (action === "process") {
    if (!["confirmed", "processing"].includes(order.status)) {
      throw new AppError(`Cannot start processing order from status '${order.status}'`, 409, "INVALID_STATUS_TRANSITION");
    }
    targetItemStatus = "processing";
    auditAction = "ORDER_VENDOR_PROCESSING";
    timelineTitle = "Order Processing by Merchant";
    timelineDesc = notes || "Vendor has accepted the order and started preparing items.";
  } else if (action === "ready_to_ship") {
    targetItemStatus = "ready_to_ship";
    auditAction = "ORDER_READY_TO_SHIP";
    timelineTitle = "Order Marked Ready to Ship";
    timelineDesc = notes || "Vendor has packaged items and marked them ready for courier dispatch.";
  } else {
    throw new AppError(`Unsupported vendor order action: ${action}`, 400, "INVALID_ACTION");
  }

  const beforeItems = JSON.parse(JSON.stringify(order.items));

  let updatedAny = false;
  order.items.forEach((item) => {
    if (item.vendorId && item.vendorId.toString() === vendorId.toString()) {
      if (!["shipped", "delivered", "cancelled"].includes(item.fulfillmentStatus)) {
        item.fulfillmentStatus = targetItemStatus;
        updatedAny = true;
      }
    }
  });

  if (!updatedAny) {
    throw new AppError("No items available for this transition", 409, "NO_ELIGIBLE_ITEMS");
  }

  if (order.status === "confirmed") {
    order.status = "processing";
  }

  order.timeline = order.timeline || [];
  order.timeline.push({
    event: auditAction.toLowerCase(),
    title: timelineTitle,
    description: timelineDesc,
    timestamp: new Date(),
    actor: { actorType: "vendor", actorId: vendorId.toString() },
  });

  const updatedOrder = await order.save();

  await AuditLog.create({
    actorId: userId,
    targetId: order._id,
    action: auditAction,
    entityType: "order",
    beforeState: { items: beforeItems },
    afterState: { items: updatedOrder.items, status: updatedOrder.status },
    ipAddress,
    userAgent,
  }).catch(() => {});

  const Shipment = require("../models/Shipment");
  const vendorShipments = await Shipment.find({
    orderId: updatedOrder._id,
    vendorId,
  }).lean();

  return projectVendorOrder(updatedOrder, vendorId, vendorShipments);
};

/**
 * Get all platform orders for Admin with search, pagination, and multi-vendor summaries.
 */
const getAdminOrders = async ({ query = {} }) => {
  const safePage = Math.max(Number(query.page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const skip = (safePage - 1) * safeLimit;

  const filter = {};
  if (query.status && query.status !== "all") {
    filter.status = query.status;
  }
  if (query.paymentStatus && query.paymentStatus !== "all") {
    filter.paymentStatus = query.paymentStatus;
  }
  if (query.search) {
    filter.$or = [
      { orderNumber: { $regex: query.search.trim(), $options: "i" } },
      { "shippingAddress.fullName": { $regex: query.search.trim(), $options: "i" } },
      { "shippingAddress.phone": { $regex: query.search.trim(), $options: "i" } },
    ];
  }

  const { items: orders, total } = await orderRepository.findAll({
    filter,
    skip,
    limit: safeLimit,
    sort: { createdAt: -1 },
  });

  const items = orders.map((order) => {
    const rawItems = order.items || [];
    const vendorIds = new Set(rawItems.map((it) => it.vendorId?.toString()).filter(Boolean));

    return {
      _id: order._id,
      secureId: encodeSecureId("order", order._id),
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      grandTotal: order.grandTotal?.toString?.() ?? String(order.grandTotal ?? "0"),
      currency: order.currency || "INR",
      itemCount: rawItems.reduce((sum, it) => sum + (it.quantity || 0), 0),
      vendorCount: vendorIds.size,
      customer: order.customerId
        ? {
            name: `${order.customerId.firstName || ""} ${order.customerId.lastName || ""}`.trim() || order.shippingAddress?.fullName,
            email: order.customerId.email,
            phone: order.customerId.phone || order.shippingAddress?.phone,
          }
        : {
            name: order.shippingAddress?.fullName || "Guest",
            email: "N/A",
            phone: order.shippingAddress?.phone || "N/A",
          },
      shippingAddress: order.shippingAddress,
      placedAt: order.placedAt,
      createdAt: order.createdAt,
    };
  });

  return {
    items,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
};

/**
 * Get comprehensive single order details for platform admin with multi-vendor dossier.
 */
const getAdminOrderById = async (orderId) => {
  const resolvedOrderId = decodeSecureId(orderId, "order", { strict: false });
  if (!mongoose.Types.ObjectId.isValid(resolvedOrderId)) {
    throw new AppError("Invalid order ID", 400, "INVALID_ORDER_ID");
  }

  const order = await Order.findById(resolvedOrderId)
    .populate("customerId", "userId firstName lastName email phone")
    .populate("items.vendorId", "businessName storeName name businessSlug email phone")
    .populate("items.warehouseId", "name code city state")
    .lean();

  if (!order) {
    throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  const Shipment = require("../models/Shipment");
  const shipments = await Shipment.find({ orderId: order._id })
    .populate("vendorId", "storeName businessName")
    .populate("warehouseId", "name code")
    .lean();

  // 1. Payment Details
  const payments = await Payment.find({ orderId: order._id }).sort({ createdAt: -1 }).lean();
  let paymentDetails = null;

  if (payments && payments.length > 0) {
    const latestPayment = payments[0];
    const amountPaid =
      latestPayment.method === "cod" || latestPayment.status === "pending"
        ? "0.00"
        : toStandardDecimalString(latestPayment.amount);
    const amountDue =
      latestPayment.method === "cod" || latestPayment.status === "pending"
        ? toStandardDecimalString(latestPayment.amount || order.grandTotal)
        : "0.00";
    const amountRefunded = toStandardDecimalString(latestPayment.refundedAmount || "0.00");

    const sanitizedHistory = (latestPayment.history || [])
      .filter((h) => h.status !== "initiated")
      .map((h) => ({
        status: h.status,
        timestamp: h.timestamp ? (h.timestamp.toISOString ? h.timestamp.toISOString() : new Date(h.timestamp).toISOString()) : null,
        note: h.note || null,
      }));

    paymentDetails = {
      _id: latestPayment._id,
      method: latestPayment.method || "Unrecorded",
      gateway: latestPayment.gateway || "N/A",
      status: latestPayment.status,
      transactionId: latestPayment.gatewayPaymentId || latestPayment._id.toString(),
      amountPaid,
      amountDue,
      amountRefunded,
      capturedAt: latestPayment.capturedAt ? (latestPayment.capturedAt.toISOString ? latestPayment.capturedAt.toISOString() : new Date(latestPayment.capturedAt).toISOString()) : null,
      history: sanitizedHistory,
    };
  } else {
    const grandTotalStr = toStandardDecimalString(order.grandTotal);
    paymentDetails = {
      method: "Unrecorded",
      gateway: "N/A",
      status: order.paymentStatus || "unpaid",
      amountPaid: "0.00",
      amountDue: grandTotalStr,
      amountRefunded: "0.00",
      capturedAt: null,
      history: [],
    };
  }

  // 2. Estimated Delivery
  let estimatedDelivery = null;
  const isCancelled = order.status === "cancelled";
  const isDelivered = order.status === "delivered";

  if (isCancelled) {
    estimatedDelivery = {
      deliveryOptionName: order.deliveryOption?.name || null,
      estimatedDays: order.deliveryOption?.estimatedDays || null,
      estimatedDateRange: null,
      isDelivered: false,
      isCancelled: true,
      actualDeliveredAt: null,
    };
  } else if (isDelivered) {
    estimatedDelivery = {
      deliveryOptionName: order.deliveryOption?.name || null,
      estimatedDays: order.deliveryOption?.estimatedDays || null,
      estimatedDateRange: null,
      isDelivered: true,
      isCancelled: false,
      actualDeliveredAt: order.deliveredAt ? (order.deliveredAt.toISOString ? order.deliveredAt.toISOString() : new Date(order.deliveredAt).toISOString()) : null,
    };
  } else if (order.deliveryOption && order.deliveryOption.estimatedDays) {
    const days = order.deliveryOption.estimatedDays;
    const minDays = typeof days === "object" ? days.min : Number(days);
    const maxDays = typeof days === "object" ? days.max : Number(days);
    const baseDate = new Date(order.placedAt || order.createdAt || Date.now());

    const minDate = new Date(baseDate);
    minDate.setDate(minDate.getDate() + (Number.isFinite(minDays) ? minDays : 3));
    const maxDate = new Date(baseDate);
    maxDate.setDate(maxDate.getDate() + (Number.isFinite(maxDays) ? maxDays : 7));

    const formatDate = (d) => {
      const day = String(d.getDate()).padStart(2, "0");
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      return `${day} ${month} ${year}`;
    };

    estimatedDelivery = {
      deliveryOptionName: order.deliveryOption.name || "Standard Ground Delivery",
      estimatedDays: order.deliveryOption.estimatedDays,
      estimatedDateRange: `${formatDate(minDate)} - ${formatDate(maxDate)}`,
      isDelivered: false,
      isCancelled: false,
      actualDeliveredAt: null,
    };
  } else {
    estimatedDelivery = {
      deliveryOptionName: null,
      estimatedDays: null,
      estimatedDateRange: "Estimated delivery unavailable",
      isDelivered: false,
      isCancelled: false,
      actualDeliveredAt: null,
    };
  }

  // 3. Financial Breakdown
  const subtotalRaw = order.subtotal;
  const grandTotalRaw = order.grandTotal;
  const isMissingTotal =
    subtotalRaw === undefined ||
    subtotalRaw === null ||
    grandTotalRaw === undefined ||
    grandTotalRaw === null;

  let financialBreakdown = null;

  if (isMissingTotal) {
    financialBreakdown = {
      subtotal: "N/A",
      grandTotal: "N/A",
      couponDiscount: "0.00",
      productDiscounts: "0.00",
      shippingTotal: "0.00",
      taxTotal: "0.00",
      handlingFee: "0.00",
      packagingFee: "0.00",
      pricingMode: order.pricingMode || "tax_exclusive",
      reconciliationStatus: "insufficient_data",
      isReconciled: false,
      reconciliationDelta: "N/A",
      calculatedGrandTotal: "N/A",
      taxSnapshot: [],
      paymentSettlementStatus: order.paymentStatus || "unpaid",
      amountPaid: paymentDetails.amountPaid,
      amountRefunded: paymentDetails.amountRefunded,
      amountDue: paymentDetails.amountDue,
    };
  } else {
    const subtotal = toStandardDecimalString(subtotalRaw);
    const grandTotal = toStandardDecimalString(grandTotalRaw);
    const discountTotal = toStandardDecimalString(order.discountTotal || order.couponDiscount || "0.00");
    const couponDiscount = toStandardDecimalString(
      order.coupon?.discountAmount || order.couponDiscount || order.discountTotal || "0.00"
    );
    const couponCode = order.coupon?.code || order.couponCode || null;
    const taxTotal = toStandardDecimalString(order.taxTotal || "0.00");
    const shippingTotal = toStandardDecimalString(order.shippingTotal || "0.00");
    const pricingMode = order.pricingMode || "tax_exclusive";

    let calculatedGrandTotalNum = 0;
    if (pricingMode === "tax_inclusive") {
      calculatedGrandTotalNum = Number(subtotal) - Number(discountTotal) + Number(shippingTotal);
    } else {
      calculatedGrandTotalNum =
        Number(subtotal) - Number(discountTotal) + Number(shippingTotal) + Number(taxTotal);
    }

    const calculatedGrandTotal = calculatedGrandTotalNum.toFixed(2);
    const delta = Math.abs(calculatedGrandTotalNum - Number(grandTotal));
    const isReconciled = delta < 0.01;
    const reconciliationStatus = isReconciled ? "reconciled" : "mismatch";
    const reconciliationDelta = delta.toFixed(2);

    let taxSnapshotList = [];
    if (Array.isArray(order.taxSnapshot)) {
      taxSnapshotList = order.taxSnapshot.map((t) => ({
        taxType: t.taxType || t.name,
        rate: t.rate,
        amount: toStandardDecimalString(t.amount),
      }));
    }

    financialBreakdown = {
      subtotal,
      grandTotal,
      couponCode,
      couponDiscount,
      productDiscounts: "0.00",
      shippingTotal,
      taxTotal,
      handlingFee: "0.00",
      packagingFee: "0.00",
      pricingMode,
      reconciliationStatus,
      isReconciled,
      reconciliationDelta,
      calculatedGrandTotal,
      taxSnapshot: taxSnapshotList,
      paymentSettlementStatus: paymentDetails.status,
      amountPaid: paymentDetails.amountPaid,
      amountRefunded: paymentDetails.amountRefunded,
      amountDue: paymentDetails.amountDue,
    };
  }

  // 4. Map items with vendor object
  const items = (order.items || []).map((it) => {
    const vId = it.vendorId;
    const vendorName =
      (vId && typeof vId === "object"
        ? vId.storeName || vId.name || vId.businessName
        : null) || "Vendor";

    return {
      ...it,
      vendor: {
        _id: vId?._id || vId,
        name: vendorName,
        storeName: vId?.storeName || vendorName,
        businessName: vId?.businessName || vendorName,
      },
    };
  });

  const vendorFulfillments = order.vendorFulfillments || [];
  const vendorRejections = vendorFulfillments.filter((f) => f.acceptanceStatus === "rejected");
  const hasVendorRejection = vendorRejections.length > 0;

  return {
    ...order,
    items,
    secureId: encodeSecureId("order", order._id),
    subtotal: order.subtotal !== undefined && order.subtotal !== null ? toStandardDecimalString(order.subtotal) : "0.00",
    grandTotal: order.grandTotal !== undefined && order.grandTotal !== null ? toStandardDecimalString(order.grandTotal) : "0.00",
    discountTotal: order.discountTotal !== undefined && order.discountTotal !== null ? toStandardDecimalString(order.discountTotal) : "0.00",
    taxTotal: order.taxTotal !== undefined && order.taxTotal !== null ? toStandardDecimalString(order.taxTotal) : "0.00",
    shippingTotal: order.shippingTotal !== undefined && order.shippingTotal !== null ? toStandardDecimalString(order.shippingTotal) : "0.00",
    paymentDetails,
    estimatedDelivery,
    financialBreakdown,
    vendorFulfillments,
    vendorRejections,
    hasVendorRejection,
    shipments: shipments.map((s) => ({
      ...s,
      secureId: encodeSecureId("shipment", s._id),
    })),
  };
};

/**
 * Calculate authoritative checkout quote from active cart.
 */
const calculateCheckoutQuote = async ({
  userId,
  shippingAddressId = null,
  guestShippingAddress = null,
  couponCode = null,
  deliveryOptionId = "standard",
  isGuest = false,
  guestId = null,
}) => {
  let customer = null;
  let cart = null;

  if (isGuest || guestId) {
    const effectiveGuestId = guestId || userId;
    const isGuestEnabled = await storefrontSettingsService.isFeatureEnabled("guestCheckout");
    if (!isGuestEnabled) {
      throw new AppError("Guest checkout is currently disabled", 403, "GUEST_CHECKOUT_DISABLED");
    }
    cart = await cartRepository.findActiveByGuest(effectiveGuestId);
  } else {
    customer = await validateCustomer(userId);
    cart = await cartRepository.findActiveByCustomer(customer._id);
  }

  if (!cart || !cart.items || cart.items.length === 0) {
    return {
      items: [],
      subtotal: "0.00",
      productDiscount: "0.00",
      couponDiscount: "0.00",
      shippingTotal: "0.00",
      taxTotal: "0.00",
      grandTotal: "0.00",
      currency: DEFAULT_CURRENCY,
      coupon: null,
      deliveryOption: resolveDeliveryOption(deliveryOptionId, 0),
    };
  }

  const orderItems = await validateCartItems(cart);
  const currency = cart.currency || DEFAULT_CURRENCY;
  const subtotalTotals = calculateOrderTotals(orderItems, currency);
  const subtotalMinorUnits = decimalToMinorUnits(subtotalTotals.subtotal);

  const delivery = resolveDeliveryOption(deliveryOptionId, subtotalMinorUnits);

  let address = null;
  if (isGuest || guestId) {
    address = guestShippingAddress || null;
    if (!address && shippingAddressId) {
      try {
        address = await addressRepository.findById(shippingAddressId);
      } catch {}
    }
  } else if (shippingAddressId) {
    try {
      address = await getShippingAddress(userId, shippingAddressId);
    } catch {
      // Non-blocking fallback
    }
  }

  let couponResult = null;
  let couponDiscountMinorUnits = 0;
  if (couponCode) {
    try {
      const itemDisallowingCoupons = orderItems.find((it) => it.allowCoupons === false);
      if (itemDisallowingCoupons) {
        couponResult = {
          code: couponCode,
          valid: false,
          discountAmount: "0.00",
          error: `Coupon cannot be combined with promotional item '${itemDisallowingCoupons.productName}'`,
        };
        couponDiscountMinorUnits = 0;
      } else {
        let isFirstOrder = false;
        if (customer && customer._id) {
          const previousOrder = await Order.findOne({ customerId: customer._id }).select("_id").lean();
          isFirstOrder = !previousOrder;
        }
        couponResult = await couponService.validateCoupon({
          code: couponCode,
          customerId: customer?._id || null,
          orderAmount: Number(subtotalTotals.subtotal),
          items: orderItems.map((item) => ({
            productId: item.productId,
            categoryId: item.categoryId,
            vendorId: item.vendorId,
            lineTotal: item.lineTotal,
            quantity: item.quantity,
          })),
          isFirstOrder,
        });
        couponDiscountMinorUnits = decimalToMinorUnits(couponResult.discountAmount);
      }
    } catch (err) {
      couponResult = { error: err.message || "Invalid coupon" };
    }
  }

  let taxCalculation = null;
  if (address) {
    try {
      taxCalculation = await taxService.calculateOrderTax({
        items: orderItems,
        shippingAddress: address,
        couponDiscountMinorUnits: couponResult?.discountAmount ? couponDiscountMinorUnits : 0,
        shippingTotalMinorUnits: delivery.feeMinorUnits,
        pricingMode: DEFAULT_TAX_PRICING_MODE,
        currency,
      });
    } catch {
      // Non-blocking fallback
    }
  }

  const totals = calculateOrderTotals(
    taxCalculation?.items || orderItems,
    currency,
    couponResult?.discountAmount ? couponDiscountMinorUnits : 0,
    taxCalculation,
    delivery.feeMinorUnits
  );

  const finalItems = taxCalculation?.items || orderItems;

  let productDiscountMinor = 0;
  for (const it of finalItems) {
    if (it.isPromotional && it.regularPrice && it.unitPrice) {
      try {
        const reg = decimalToMinorUnits(it.regularPrice);
        const unit = decimalToMinorUnits(it.unitPrice);
        if (reg > unit) {
          productDiscountMinor += (reg - unit) * (it.quantity || 1);
        }
      } catch {}
    }
  }
  const productDiscount = minorUnitsToDecimalString(productDiscountMinor);

  const { quoteReference, expiresAt } = generateQuoteReference({
    customerId: (isGuest || guestId) ? (guestId || userId) : customer._id.toString(),
    cartId: cart._id.toString(),
    grandTotal: totals.grandTotal,
    currency,
    items: finalItems,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    shippingTotal: totals.shippingTotal,
    taxTotal: totals.taxTotal,
    deliveryOptionId: delivery.id,
    couponCode: couponResult?.coupon?.code || null,
  });

  return {
    quoteReference,
    quoteExpiresAt: expiresAt,
    items: finalItems.map((it) => ({
      productId: it.productId,
      productVariantId: it.productVariantId,
      productName: it.productName,
      variantName: it.variantName,
      sku: it.sku,
      quantity: it.quantity,
      unitPrice: it.unitPrice?.toString ? it.unitPrice.toString() : String(it.unitPrice),
      lineTotal: it.lineTotal?.toString ? it.lineTotal.toString() : String(it.lineTotal),
    })),
    subtotal: totals.subtotal,
    productDiscount,
    couponDiscount: totals.discountTotal,
    shippingTotal: totals.shippingTotal,
    taxTotal: totals.taxTotal,
    grandTotal: totals.grandTotal,
    currency,
    coupon: couponResult?.coupon
      ? {
          code: couponResult.coupon.code,
          discountAmount: couponResult.discountAmount,
          title: couponResult.coupon.title,
        }
      : couponResult?.error
      ? {
          code: couponResult.code || couponCode,
          valid: false,
          error: couponResult.error,
        }
      : null,
    couponError: couponResult?.error || null,
    deliveryOption: {
      id: delivery.id,
      name: delivery.name,
      cost: Number(delivery.cost),
      estimatedDays: delivery.estimatedDays,
    },
  };
};

/**
 * Get lifecycle activity timeline and financial breakdown for an order.
 */
const getOrderActivity = async (orderId, userId, isAdmin = false) => {
  const customer = !isAdmin ? await validateCustomer(userId) : null;
  const filter = { _id: orderId };
  if (!isAdmin && customer) {
    filter.customerId = customer._id;
  }
  const order = await Order.findOne(filter).lean();
  if (!order) {
    throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  const financialBreakdown = {
    itemsTotal: order.subtotal?.toString?.() || String(order.subtotal || "0.00"),
    productDiscount: "0.00",
    couponDiscount: order.couponDiscount?.toString?.() || order.discountTotal?.toString?.() || "0.00",
    shippingTotal: order.shippingTotal?.toString?.() || "0.00",
    taxTotal: order.taxTotal?.toString?.() || "0.00",
    grandTotal: order.grandTotal?.toString?.() || "0.00",
    amountPaid: order.amountPaid?.toString?.() || (order.paymentStatus === "paid" ? order.grandTotal?.toString?.() : "0.00"),
    amountRefunded: order.amountRefunded?.toString?.() || "0.00",
    currency: order.currency || "INR",
  };

  return {
    orderId: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    deliveryOption: order.deliveryOption || { id: "standard", name: "Standard Delivery" },
    timeline: order.timeline || [],
    paymentAttempts: order.paymentAttempts || [],
    financialBreakdown,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
};

/**
 * Update order status by administrator with optimistic concurrency control
 * and non-destructive shipment synchronization.
 */
const updateAdminOrderStatus = async ({
  orderId,
  status: targetStatus,
  reason = "",
  notes = "",
  expectedPreviousStatus = null,
  expectedVersion = null,
  isOverride = false,
  overrideReason = "",
  actor = null,
}) => {
  const order = await orderRepository.findById(orderId);
  if (!order) {
    throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  if (expectedPreviousStatus && order.status !== expectedPreviousStatus) {
    throw new AppError(
      `Order status conflict: expected '${expectedPreviousStatus}' but order is currently '${order.status}'`,
      409,
      "CONCURRENT_STATUS_CONFLICT"
    );
  }

  const currentVersion = order.version !== undefined ? order.version : 1;
  if (expectedVersion !== null && expectedVersion !== undefined && expectedVersion !== currentVersion) {
    throw new AppError(
      `Order version conflict: expected version ${expectedVersion} but order is currently at version ${currentVersion}`,
      409,
      "CONCURRENT_STATUS_CONFLICT"
    );
  }

  const isAdminActor = isOverride || (actor && ["admin", "super_admin", "superadmin"].includes(actor.role));
  if (!canTransitionOrderStatus(order.status, targetStatus) && !isAdminActor) {
    throw new AppError(
      `Invalid order status transition from ${order.status} to ${targetStatus}`,
      409,
      "INVALID_ORDER_STATUS_TRANSITION"
    );
  }

  const newVersion = currentVersion + 1;
  const updatePayload = {
    status: targetStatus,
    version: newVersion,
  };

  if (targetStatus === "delivered") {
    updatePayload.fulfillmentStatus = "fulfilled";
    updatePayload.deliveredAt = new Date();
  } else if (targetStatus === "cancelled") {
    updatePayload.fulfillmentStatus = "cancelled";
    updatePayload.cancelledAt = new Date();
  }

  const updateOptions = {};
  if (expectedVersion !== null && expectedVersion !== undefined) {
    updateOptions.expectedVersion = Number(expectedVersion);
  }

  const updatedOrder = await orderRepository.transitionStatusIfCurrent(
    orderId,
    order.status,
    updatePayload,
    updateOptions
  );

  if (!updatedOrder && expectedVersion !== null && expectedVersion !== undefined) {
    throw new AppError(
      "Concurrent status conflict: order has been modified by another operation",
      409,
      "CONCURRENT_STATUS_CONFLICT"
    );
  }

  const finalOrder = updatedOrder || (await orderRepository.updateById(orderId, updatePayload));

  // Synchronize non-terminal shipments without destroying courier evidence
  const Shipment = require("../models/Shipment");
  const shipments = await Shipment.find({ orderId });
  for (const shipment of shipments) {
    if (["cancelled", "returned", "rto_delivered"].includes(shipment.status)) {
      continue;
    }
    if (targetStatus === "delivered" && shipment.status !== "delivered") {
      const deliveredUpdate = {
        status: "delivered",
        deliveredAt: new Date(),
        version: (shipment.version || 1) + 1,
      };
      await Shipment.updateOne(
        { _id: shipment._id },
        {
          $set: deliveredUpdate,
          $push: {
            trackingEvents: {
              status: "delivered",
              milestone: "delivered",
              timestamp: new Date(),
              description: reason || "Delivered administratively",
              source: "admin_override",
            },
          },
        }
      );
    }
  }

  return finalOrder;
};

module.exports = {
  decimalToMinorUnits,
  minorUnitsToDecimalString,
  generateOrderNumber,
  validateCustomer,
  getShippingAddress,
  validateCartItems,
  calculateOrderTotals,
  reserveInventoryForOrderItems,
  createOrderFromCurrentCart,
  getOrderById,
  getCustomerOrders,
  getVendorOrders,
  getVendorOrderById,
  projectVendorOrder,
  transitionVendorOrderItemStatus,
  getAdminOrders,
  getAdminOrderById,
  updateAdminOrderStatus,
  transitionOrderStatus,
  cancelOrder,
  expirePendingOrder,
  markOrderPaymentCaptured,
  calculateCheckoutQuote,
  linkGuestOrderToCustomer,
  getOrderActivity,
  resolveDeliveryOption,
  DELIVERY_OPTIONS,
};





