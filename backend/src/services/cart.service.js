
const mongoose = require("mongoose");

const cartRepository = require("../repositories/cart.repository");
const ProductVariant = require("../models/ProductVariant");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const AppError = require("../errors/AppError");

const DEFAULT_CURRENCY = "INR";
const MAX_ITEM_QUANTITY = 99;
const MINOR_UNIT_SCALE = 100;

const toDecimal128 = (value) => {
  if (value instanceof mongoose.Types.Decimal128) {
    return value;
  }

  return mongoose.Types.Decimal128.fromString(String(value));
};

const decimalToMinorUnits = (value) => {
  const decimalString = value?.toString?.() ?? String(value ?? "0");

  const [wholePart = "0", fractionalPart = ""] =
    decimalString.split(".");

  const normalizedFraction = fractionalPart
    .padEnd(2, "0")
    .slice(0, 2);

  const sign = wholePart.startsWith("-") ? -1 : 1;
  const absoluteWholePart = Math.abs(Number(wholePart));

  return (
    sign *
    (absoluteWholePart * MINOR_UNIT_SCALE +
      Number(normalizedFraction))
  );
};

const minorUnitsToDecimal128 = (minorUnits) => {
  const sign = minorUnits < 0 ? "-" : "";
  const absoluteValue = Math.abs(minorUnits);

  const wholePart = Math.floor(
    absoluteValue / MINOR_UNIT_SCALE
  );

  const fractionalPart = String(
    absoluteValue % MINOR_UNIT_SCALE
  ).padStart(2, "0");

  return mongoose.Types.Decimal128.fromString(
    `${sign}${wholePart}.${fractionalPart}`
  );
};

const calculateSubtotal = (items) => {
  const subtotalMinorUnits = items.reduce((total, item) => {
    const priceMinorUnits = decimalToMinorUnits(
      item.priceSnapshot
    );

    return total + priceMinorUnits * item.quantity;
  }, 0);

  return minorUnitsToDecimal128(subtotalMinorUnits);
};

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

const validateVariant = async (productVariantId) => {
  const variant = await ProductVariant.findOne({
    _id: productVariantId,
    isActive: true,
    deletedAt: null,
  });

  if (!variant) {
    throw new AppError(
      "Product variant not found or unavailable",
      404,
      "PRODUCT_VARIANT_NOT_FOUND"
    );
  }

  const product = await Product.findOne({
    _id: variant.productId,
    status: "active",
    deletedAt: null,
  });

  if (!product) {
    throw new AppError(
      "Product is not available",
      400,
      "PRODUCT_UNAVAILABLE"
    );
  }

  return variant;
};

const createEmptyCart = async (
  customerId,
  currency = DEFAULT_CURRENCY,
  storeId = null
) => {
  return cartRepository.create({
    customerId,
    storeId,
    status: "active",
    items: [],
    currency,
    subtotal: toDecimal128("0.00"),
    discountTotal: toDecimal128("0.00"),
    taxTotal: toDecimal128("0.00"),
    shippingTotal: toDecimal128("0.00"),
    grandTotal: toDecimal128("0.00"),
    lastActivityAt: new Date(),
  });
};

const getCart = async (userId, storeId = null) => {
  const customer = await validateCustomer(userId);

  let cart = await cartRepository.findActiveByCustomer(
    customer._id,
    storeId
  );

  if (!cart) {
    try {
      cart = await createEmptyCart(
        customer._id,
        DEFAULT_CURRENCY,
        storeId
      );
    } catch (error) {
      if (error?.code === 11000) {
        cart = await cartRepository.findActiveByCustomer(
          customer._id,
          storeId
        );
      }

      if (!cart) {
        throw error;
      }
    }
  }

  return cart;
};

const recalculateCart = async (cart) => {
  const subtotal = calculateSubtotal(cart.items);

  const discountMinorUnits = decimalToMinorUnits(
    cart.discountTotal
  );

  const taxMinorUnits = decimalToMinorUnits(cart.taxTotal);

  const shippingMinorUnits = decimalToMinorUnits(
    cart.shippingTotal
  );

  const subtotalMinorUnits = decimalToMinorUnits(subtotal);

  const grandTotalMinorUnits =
    subtotalMinorUnits -
    discountMinorUnits +
    taxMinorUnits +
    shippingMinorUnits;

  cart.subtotal = subtotal;

  cart.grandTotal = minorUnitsToDecimal128(
    Math.max(grandTotalMinorUnits, 0)
  );

  cart.lastActivityAt = new Date();

  return cart;
};

const addItem = async (
  userId,
  productVariantId,
  quantity,
  storeId = null
) => {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AppError(
      "Quantity must be a positive integer",
      400,
      "INVALID_CART_QUANTITY"
    );
  }

  if (quantity > MAX_ITEM_QUANTITY) {
    throw new AppError(
      `Quantity cannot exceed ${MAX_ITEM_QUANTITY}`,
      400,
      "CART_QUANTITY_LIMIT_EXCEEDED"
    );
  }

  const customer = await validateCustomer(userId);
  const variant = await validateVariant(productVariantId);

  let cart = await cartRepository.findActiveByCustomer(
    customer._id,
    storeId
  );

  if (!cart) {
    try {
      cart = await createEmptyCart(
        customer._id,
        variant.currency || DEFAULT_CURRENCY,
        storeId
      );
    } catch (error) {
      if (error?.code === 11000) {
        cart = await cartRepository.findActiveByCustomer(
          customer._id,
          storeId
        );
      }

      if (!cart) {
        throw error;
      }
    }
  }

  const variantCurrency =
    variant.currency || DEFAULT_CURRENCY;

  if (cart.currency !== variantCurrency) {
    throw new AppError(
      "Cart currency does not match product currency",
      400,
      "CART_CURRENCY_MISMATCH"
    );
  }

  const existingItem = cart.items.find(
    (item) =>
      item.productVariantId.toString() === productVariantId
  );

  if (existingItem) {
    const newQuantity = existingItem.quantity + quantity;

    if (newQuantity > MAX_ITEM_QUANTITY) {
      throw new AppError(
        `Quantity cannot exceed ${MAX_ITEM_QUANTITY}`,
        400,
        "CART_QUANTITY_LIMIT_EXCEEDED"
      );
    }

    existingItem.quantity = newQuantity;
    existingItem.priceSnapshot = variant.price;
    existingItem.currency = variantCurrency;
  } else {
    cart.items.push({
      productVariantId: variant._id,
      quantity,
      priceSnapshot: variant.price,
      currency: variantCurrency,
      addedAt: new Date(),
    });
  }

  await recalculateCart(cart);

  return cartRepository.updateById(cart._id, cart);
};

const updateItemQuantity = async (
  userId,
  productVariantId,
  quantity,
  storeId = null
) => {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AppError(
      "Quantity must be a positive integer",
      400,
      "INVALID_CART_QUANTITY"
    );
  }

  if (quantity > MAX_ITEM_QUANTITY) {
    throw new AppError(
      `Quantity cannot exceed ${MAX_ITEM_QUANTITY}`,
      400,
      "CART_QUANTITY_LIMIT_EXCEEDED"
    );
  }

  const customer = await validateCustomer(userId);

  const cart = await cartRepository.findActiveByCustomer(
    customer._id,
    storeId
  );

  if (!cart) {
    throw new AppError(
      "Active cart not found",
      404,
      "CART_NOT_FOUND"
    );
  }

  const item = cart.items.find(
    (cartItem) =>
      cartItem.productVariantId.toString() === productVariantId
  );

  if (!item) {
    throw new AppError(
      "Cart item not found",
      404,
      "CART_ITEM_NOT_FOUND"
    );
  }

  const variant = await validateVariant(productVariantId);

  const variantCurrency =
    variant.currency || DEFAULT_CURRENCY;

  if (cart.currency !== variantCurrency) {
    throw new AppError(
      "Cart currency does not match product currency",
      400,
      "CART_CURRENCY_MISMATCH"
    );
  }

  item.quantity = quantity;
  item.priceSnapshot = variant.price;
  item.currency = variantCurrency;

  await recalculateCart(cart);

  return cartRepository.updateById(cart._id, cart);
};

const removeItem = async (
  userId,
  productVariantId,
  storeId = null
) => {
  const customer = await validateCustomer(userId);

  const cart = await cartRepository.findActiveByCustomer(
    customer._id,
    storeId
  );

  if (!cart) {
    throw new AppError(
      "Active cart not found",
      404,
      "CART_NOT_FOUND"
    );
  }

  const originalLength = cart.items.length;

  cart.items = cart.items.filter(
    (item) =>
      item.productVariantId.toString() !== productVariantId
  );

  if (cart.items.length === originalLength) {
    throw new AppError(
      "Cart item not found",
      404,
      "CART_ITEM_NOT_FOUND"
    );
  }

  await recalculateCart(cart);

  return cartRepository.updateById(cart._id, cart);
};

const clearCart = async (userId, storeId = null) => {
  const customer = await validateCustomer(userId);

  const cart = await cartRepository.findActiveByCustomer(
    customer._id,
    storeId
  );

  if (!cart) {
    throw new AppError(
      "Active cart not found",
      404,
      "CART_NOT_FOUND"
    );
  }

  cart.items = [];
  cart.discountTotal = toDecimal128("0.00");
  cart.taxTotal = toDecimal128("0.00");
  cart.shippingTotal = toDecimal128("0.00");
  cart.subtotal = toDecimal128("0.00");
  cart.grandTotal = toDecimal128("0.00");
  cart.lastActivityAt = new Date();

  return cartRepository.updateById(cart._id, cart);
};

module.exports = {
  getCart,
  addItem,
  updateItemQuantity,
  removeItem,
  clearCart,
};
