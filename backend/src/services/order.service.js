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

const paymentService = require("./payment.service");

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
const validateCartItems = async (cart) => {
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

  const variants = await ProductVariant.find({
    _id: { $in: variantIds },
    isActive: true,
    deletedAt: null,
  }).lean();

  const variantMap = new Map(
    variants.map((v) => [v._id.toString(), v])
  );

  const productIds = [
    ...new Set(variants.map((v) => v.productId.toString())),
  ];

  const products = await Product.find({
    _id: { $in: productIds },
    status: "active",
    deletedAt: null,
  }).lean();

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

    const unitPrice = variant.price;

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
      const inventories =
        await inventoryRepository.findByVariant(
          item.productVariantId,
          { session }
        );

      if (
        !inventories ||
        inventories.length === 0
      ) {
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
      const sortedInventories = [...inventories].sort((a, b) => {
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
                  actorUserId: userId,
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
  deliveryOptionId = null
) => {
  const customer =
    await validateCustomer(userId);

  const address =
    await getShippingAddress(
      userId,
      shippingAddressId
    );

  let normalizedKey = null;
  let fingerprint = null;

  if (idempotencyKey !== null && idempotencyKey !== undefined) {
    normalizedKey = validateIdempotencyKey(idempotencyKey);
    fingerprint = generateCheckoutFingerprint({
      customerId: customer._id,
      shippingAddressId,
      couponCode,
      deliveryOptionId,
    });

    const existingOrder =
      await orderRepository.findByCustomerIdAndIdempotencyKey(
        customer._id,
        normalizedKey
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

  let order;
  try {
    order = await withTransaction(
      async (session) => {
        const cart =
          await cartRepository
            .findActiveByCustomer(
              customer._id,
              null,
              { session }
            );

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
          await validateCartItems(cart);

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

        const previousOrder =
          await Order.findOne({
            customerId: customer._id,
          })
            .select("_id")
            .session(session)
            .lean();

        const isFirstOrder =
          !previousOrder;

        let couponResult = null;

        if (couponCode) {
          couponResult =
            await couponService.validateCoupon({
              code: couponCode,
              customerId: customer._id,
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
          .trim();

        if (!fullName) {
          throw new AppError(
            "Shipping address name is invalid",
            400,
            "INVALID_SHIPPING_ADDRESS"
          );
        }

        const initialTimeline = [
          {
            event: "order_created",
            title: "Order Created",
            description: `Order #${orderNumber} created with total ${totals.currency} ${totals.grandTotal}.`,
            timestamp: new Date(),
            actor: {
              actorType: "customer",
              actorId: customer._id.toString(),
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
              actorType: "customer",
              actorId: customer._id.toString(),
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
              actorType: "customer",
              actorId: customer._id.toString(),
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
              actorType: "customer",
              actorId: customer._id.toString(),
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

        const createdOrder =
          await orderRepository.create(
            {
              orderNumber,

              customerId:
                customer._id,

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

        if (couponResult) {
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

        return createdOrder;
      }
    );
  } catch (error) {
    const isDuplicateKeyError =
      error?.code === 11000 ||
      Boolean(error?.message && error.message.includes("E11000"));

    if (isDuplicateKeyError && normalizedKey) {
      let winningOrder =
        await orderRepository.findByCustomerIdAndIdempotencyKey(
          customer._id,
          normalizedKey
        );

      if (!winningOrder) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        winningOrder =
          await orderRepository.findByCustomerIdAndIdempotencyKey(
            customer._id,
            normalizedKey
          );
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
  userId
) => {
  const customer =
    await validateCustomer(userId);

  const order =
    await orderRepository.findById(
      orderId
    );

  if (!order) {
    throw new AppError(
      "Order not found",
      404,
      "ORDER_NOT_FOUND"
    );
  }

  if (
    order.customerId.toString() !==
    customer._id.toString()
  ) {
    throw new AppError(
      "You are not allowed to access this order",
      403,
      "ORDER_ACCESS_DENIED"
    );
  }

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
   * Payment-aware cancellation.
   *
   * Captured payments must be refunded before the
   * cancellation transaction is committed.
   *
   * Pending/created/failed payments do not require
   * a refund because no captured money exists.
   */
  const payment =
    await paymentService.getLatestPaymentForOrder(
      orderId
    );

  let refundedPayment = null;
  if (
    payment?.status === "captured" ||
    payment?.status === "partially_refunded"
  ) {
    refundedPayment = await paymentService.refundPaymentForOrder(
      orderId,
      userId
    );
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

      for (const item of currentOrder.items) {
        if (
          item.inventoryStatus === "released" ||
          item.inventoryStatus === "deducted"
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
            idempotencyKey: `order-reservation-release-${currentOrder._id.toString()}-${item.productVariantId.toString()}-${item.warehouseId.toString()}`,
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
          currentPayment.status === "captured" ||
          currentPayment.status === "partially_refunded"
        ) {
          throw new AppError(
            "Payment was captured concurrently. Please retry cancellation to trigger refund.",
            409,
            "PAYMENT_CAPTURED_CONCURRENTLY"
          );
        } else if (currentPayment.status === "refunded") {
          orderPaymentStatus = "refunded";
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
          item.inventoryStatus === "deducted"
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
            idempotencyKey: `order-reservation-release-${currentOrder._id.toString()}-${item.productVariantId.toString()}-${item.warehouseId.toString()}`,
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
    .populate("items.vendorId", "businessName storeName businessSlug email phone")
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

  return {
    ...order,
    secureId: encodeSecureId("order", order._id),
    subtotal: order.subtotal?.toString?.() ?? String(order.subtotal ?? "0"),
    grandTotal: order.grandTotal?.toString?.() ?? String(order.grandTotal ?? "0"),
    discountTotal: order.discountTotal?.toString?.() ?? String(order.discountTotal ?? "0"),
    taxTotal: order.taxTotal?.toString?.() ?? String(order.taxTotal ?? "0"),
    shippingTotal: order.shippingTotal?.toString?.() ?? String(order.shippingTotal ?? "0"),
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
  couponCode = null,
  deliveryOptionId = "standard",
}) => {
  const customer = await validateCustomer(userId);
  const cart = await cartRepository.findActiveByCustomer(customer._id);

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
  if (shippingAddressId) {
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
      const previousOrder = await Order.findOne({ customerId: customer._id }).select("_id").lean();
      const isFirstOrder = !previousOrder;
      couponResult = await couponService.validateCoupon({
        code: couponCode,
        customerId: customer._id,
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

  return {
    items: (taxCalculation?.items || orderItems).map((it) => ({
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
    productDiscount: "0.00",
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
  transitionOrderStatus,
  cancelOrder,
  expirePendingOrder,
  markOrderPaymentCaptured,
  calculateCheckoutQuote,
  getOrderActivity,
  resolveDeliveryOption,
  DELIVERY_OPTIONS,
};





