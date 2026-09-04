const crypto = require("crypto");

const orderRepository = require("../repositories/order.repository");
const cartRepository = require("../repositories/cart.repository");
const addressRepository = require("../repositories/address.repository");
const inventoryRepository = require("../repositories/inventory.repository");

const inventoryService = require("./inventory.service");
const withTransaction = require("../utils/withTransaction");

const ProductVariant = require("../models/ProductVariant");
const Product = require("../models/Product");
const Customer = require("../models/Customer");

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

  const normalizedValue = decimalString.trim();

  if (!/^-?\d+(\.\d+)?$/.test(normalizedValue)) {
    throw new AppError(
      "Invalid monetary value",
      500,
      "INVALID_MONEY_VALUE"
    );
  }

  const sign = normalizedValue.startsWith("-") ? -1 : 1;

  const unsignedValue = normalizedValue.replace("-", "");

  const [wholePart = "0", fractionalPart = ""] =
    unsignedValue.split(".");

  const normalizedFraction = fractionalPart
    .padEnd(2, "0")
    .slice(0, 2);

  const wholeMinorUnits =
    Number(wholePart) * MINOR_UNIT_SCALE;

  const fractionalMinorUnits =
    Number(normalizedFraction);

  const minorUnits =
    wholeMinorUnits + fractionalMinorUnits;

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
const minorUnitsToDecimalString = (minorUnits) => {
  if (!Number.isSafeInteger(minorUnits)) {
    throw new AppError(
      "Invalid minor unit amount",
      500,
      "INVALID_MINOR_UNIT_AMOUNT"
    );
  }

  const sign = minorUnits < 0 ? "-" : "";

  const absoluteValue = Math.abs(minorUnits);

  const wholePart = Math.floor(
    absoluteValue / MINOR_UNIT_SCALE
  );

  const fractionalPart = String(
    absoluteValue % MINOR_UNIT_SCALE
  ).padStart(2, "0");

  return `${sign}${wholePart}.${fractionalPart}`;
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
  const customer = await Customer.findOne({
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
  if (!cart || cart.status !== "active") {
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

  const orderItems = [];

  for (const cartItem of cart.items) {
    const variant =
      await ProductVariant.findOne({
        _id: cartItem.productVariantId,
        isActive: true,
        deletedAt: null,
      });

    if (!variant) {
      throw new AppError(
        "A product variant in your cart is no longer available",
        400,
        "CART_ITEM_UNAVAILABLE"
      );
    }

    const product =
      await Product.findOne({
        _id: variant.productId,
        status: "active",
        deletedAt: null,
      });

    if (!product) {
      throw new AppError(
        "A product in your cart is no longer available",
        400,
        "PRODUCT_UNAVAILABLE"
      );
    }

    const variantCurrency =
      variant.currency || DEFAULT_CURRENCY;

    const cartCurrency =
      cart.currency || DEFAULT_CURRENCY;

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

      sku: variant.sku,

      productName: product.name,

      variantName: variant.name || "",

      quantity: cartItem.quantity,

      unitPrice,

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
 * so those values remain zero for this phase.
 */
const calculateOrderTotals = (
  orderItems,
  currency
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

  const discountTotalMinorUnits = 0;
  const taxTotalMinorUnits = 0;
  const shippingTotalMinorUnits = 0;

  const grandTotalMinorUnits =
    subtotalMinorUnits -
    discountTotalMinorUnits +
    taxTotalMinorUnits +
    shippingTotalMinorUnits;

  return {
    currency,

    subtotal:
      minorUnitsToDecimalString(
        subtotalMinorUnits
      ),

    discountTotal:
      minorUnitsToDecimalString(
        discountTotalMinorUnits
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
 *
 * One warehouse is selected for each order line.
 * The reservation itself is atomic at the database level.
 */
const reserveInventoryForOrderItems = async (
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

      if (available < item.quantity) {
        continue;
      }

      reservedInventory =
        await inventoryService.reserveStockInTransaction(
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
 *
 * Critical checkout operations are executed inside
 * one MongoDB transaction:
 *
 * 1. Load active cart
 * 2. Validate authoritative catalog data
 * 3. Calculate totals
 * 4. Reserve inventory
 * 5. Create order
 * 6. Convert cart
 *
 * Payment remains pending.
 *
 * IMPORTANT:
 * Razorpay API calls must NOT happen inside this
 * MongoDB transaction.
 */
const createOrderFromCurrentCart = async (
  userId,
  shippingAddressId
) => {
  const customer =
    await validateCustomer(userId);

  const address =
    await getShippingAddress(
      userId,
      shippingAddressId
    );

  return withTransaction(async (session) => {
    const cart =
      await cartRepository.findActiveByCustomer(
        customer._id,
        null,
        { session }
      );

    if (!cart) {
      throw new AppError(
        "Active cart not found",
        404,
        "CART_NOT_FOUND"
      );
    }

    const orderItems =
      await validateCartItems(cart);

    const currency =
      cart.currency || DEFAULT_CURRENCY;

    const totals =
      calculateOrderTotals(
        orderItems,
        currency
      );

    const orderNumber =
      generateOrderNumber();

    await reserveInventoryForOrderItems(
      orderItems,
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

    const order =
      await orderRepository.create(
        {
          orderNumber,

          customerId:
            customer._id,

          storeId:
            cart.storeId || null,

          status: "pending",

          paymentStatus: "pending",

          fulfillmentStatus:
            "unfulfilled",

          currency,

          items: orderItems,

          subtotal:
            totals.subtotal,

          discountTotal:
            totals.discountTotal,

          taxTotal:
            totals.taxTotal,

          shippingTotal:
            totals.shippingTotal,

          grandTotal:
            totals.grandTotal,

          shippingAddress: {
            fullName,

            phone:
              address.phone,

            addressLine1:
              address.addressLine1,

            addressLine2:
              address.addressLine2 || "",

            city:
              address.city,

            state:
              address.state,

            postalCode:
              address.postalCode,

            country:
              address.country || "IN",
          },
        },
        { session }
      );

    const convertedCart =
      await cartRepository.convertActiveCart(
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

    return order;
  });
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
 * Safely transition an order between allowed states.
 */
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

  if (
    nextStatus === "confirmed" &&
    !order.placedAt
  ) {
    update.placedAt = new Date();
  }

  if (
    nextStatus === "cancelled"
  ) {
    update.cancelledAt =
      new Date();
  }

  if (
    nextStatus === "completed"
  ) {
    update.completedAt =
      new Date();
  }

  return orderRepository.updateById(
    orderId,
    update,
    options
  );
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
};
