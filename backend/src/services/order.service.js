const crypto = require("crypto");

const orderRepository = require("../repositories/order.repository");
const cartRepository = require("../repositories/cart.repository");
const addressRepository = require("../repositories/address.repository");
const inventoryRepository = require("../repositories/inventory.repository");
const paymentRepository = require("../repositories/payment.repository");
const couponRepository = require("../repositories/coupon.repository");
const couponRedemptionRepository = require("../repositories/coupon-redemption.repository");

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

const AppError = require("../errors/AppError");

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
const calculateOrderTotals = (
  orderItems,
  currency,
  couponDiscountMinorUnits = 0,
  taxCalculation = null
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

  const shippingTotalMinorUnits = 0;
  const pricingMode =
    taxCalculation?.pricingMode || DEFAULT_TAX_PRICING_MODE;

  let grandTotalMinorUnits;
  if (pricingMode === TAX_PRICING_MODES.TAX_INCLUSIVE) {
    grandTotalMinorUnits =
      subtotalMinorUnits -
      couponDiscountMinorUnits +
      shippingTotalMinorUnits +
      (taxCalculation?.shippingTaxTotalMinorUnits || 0);
  } else {
    grandTotalMinorUnits =
      subtotalMinorUnits -
      couponDiscountMinorUnits +
      taxTotalMinorUnits +
      shippingTotalMinorUnits;
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
        shippingTotalMinorUnits
      ),

    grandTotal:
      minorUnitsToDecimalString(
        grandTotalMinorUnits
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

      let reservedInventory = null;

      for (const inventory of inventories) {
        const available =
          inventory.onHand -
          inventory.reserved;

        if (
          available < item.quantity
        ) {
          continue;
        }

        reservedInventory =
          await inventoryService
            .reserveStockInTransaction(
              inventory._id,
              item.quantity,
              {
                referenceType: "order",
                referenceId: orderNumber,
                actorUserId: userId,
                notes:
                  "Inventory reserved during checkout",
              },
              session
            );

        if (reservedInventory) {
          break;
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
  idempotencyKey = null
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
            shippingTotalMinorUnits: 0,
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
            taxCalculation
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

              taxTotal:
                totals.taxTotal,

              taxSnapshot:
                taxCalculation.taxSnapshot,

              shippingTotal:
                totals.shippingTotal,

              grandTotal:
                totals.grandTotal,

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

  const customer = await validateCustomer(userId);

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

  const cancelledOrder = await withTransaction(
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
            notes:
              "Inventory released due to order cancellation",
          },
          session
        );
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
        }
      );
    }
  );

  if (!wasAlreadyCancelled) {
    await sendOrderStatusNotification({
      order: cancelledOrder,
    });
  }

  return cancelledOrder;
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
  };

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
  transitionOrderStatus,
  cancelOrder,
  markOrderPaymentCaptured,
};





