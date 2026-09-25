const paymentMethodRepository = require("../repositories/payment-method.repository");
const orderRepository = require("../repositories/order.repository");
const paypalProvider = require("../integrations/payments/paypal.provider");
const env = require("../config/env");
const AppError = require("../errors/AppError");
const { recordAuditLog } = require("./governance.service");

const DEFAULT_PAYMENT_METHODS = [
  {
    name: "UPI",
    code: "upi",
    gateway: "razorpay",
    type: "upi",
    description: "Instant, fee-free payments with Google Pay, PhonePe, Paytm, or BHIM.",
    icon: "Zap",
    enabled: true,
    displayOrder: 1,
    supportedCountries: ["IN"],
    supportedCurrencies: ["INR"],
    minimumOrderAmount: "0.00",
    maximumOrderAmount: null,
  },
  {
    name: "Credit / Debit Cards",
    code: "card",
    gateway: "razorpay",
    type: "card",
    description: "Visa, Mastercard, RuPay, Maestro, and Diners Club cards accepted.",
    icon: "CreditCard",
    enabled: true,
    displayOrder: 2,
    supportedCountries: ["IN", "ALL"],
    supportedCurrencies: ["INR"],
    minimumOrderAmount: "0.00",
    maximumOrderAmount: null,
  },
  {
    name: "Net Banking",
    code: "netbanking",
    gateway: "razorpay",
    type: "netbanking",
    description: "Direct bank transfer from 50+ leading Indian retail and commercial banks.",
    icon: "Building2",
    enabled: true,
    displayOrder: 3,
    supportedCountries: ["IN"],
    supportedCurrencies: ["INR"],
    minimumOrderAmount: "0.00",
    maximumOrderAmount: null,
  },
  {
    name: "Wallets",
    code: "wallet",
    gateway: "razorpay",
    type: "wallet",
    description: "Pay using balance from popular digital wallets.",
    icon: "Wallet",
    enabled: true,
    displayOrder: 4,
    supportedCountries: ["IN"],
    supportedCurrencies: ["INR"],
    minimumOrderAmount: "0.00",
    maximumOrderAmount: null,
  },
  {
    name: "International Cards",
    code: "international_card",
    gateway: "razorpay",
    type: "international_card",
    description: "International credit and debit cards processed with 3D-Secure authentication.",
    icon: "Globe",
    enabled: true,
    displayOrder: 5,
    supportedCountries: ["ALL"],
    supportedCurrencies: ["INR"],
    minimumOrderAmount: "0.00",
    maximumOrderAmount: null,
  },
  {
    name: "PayPal",
    code: "paypal",
    gateway: "paypal",
    type: "paypal",
    description: "Pay securely with your PayPal account or linked international cards.",
    icon: "CreditCard",
    enabled: false, // Default disabled until admin configures PayPal client ID & secret
    displayOrder: 6,
    supportedCountries: ["ALL"],
    supportedCurrencies: ["INR", "USD", "EUR", "GBP"],
    minimumOrderAmount: "0.00",
    maximumOrderAmount: null,
  },
  {
    name: "Cash on Delivery",
    code: "cod",
    gateway: "internal",
    type: "cod",
    description: "Pay cash at doorstep upon delivery (Temporarily unavailable due to prepaid policy).",
    icon: "Banknote",
    enabled: false, // Strictly disabled until delivery cash-collection infrastructure exists
    displayOrder: 7,
    supportedCountries: ["IN"],
    supportedCurrencies: ["INR"],
    minimumOrderAmount: "0.00",
    maximumOrderAmount: "10000.00",
  },
];

/**
 * Seed default payment methods if none exist in the database.
 */
const seedDefaultPaymentMethods = async () => {
  const existingCount = await paymentMethodRepository.count();
  if (existingCount === 0) {
    for (const item of DEFAULT_PAYMENT_METHODS) {
      await paymentMethodRepository.create(item);
    }
  }
};

/**
 * Check whether a gateway is technically and securely configured server-side.
 */
const isGatewayConfigured = (gateway) => {
  const norm = String(gateway || "").toLowerCase().trim();
  if (norm === "razorpay") {
    return Boolean(
      env.RAZORPAY_KEY_ID &&
        env.RAZORPAY_KEY_ID.length > 0 &&
        env.RAZORPAY_KEY_SECRET &&
        env.RAZORPAY_KEY_SECRET.length > 0
    );
  }
  if (norm === "paypal") {
    return paypalProvider.isConfigured();
  }
  if (norm === "internal") {
    // Internal COD is currently not supported by backend fulfillment
    return false;
  }
  return false;
};

/**
 * Mask sensitive configuration values before returning to admin client.
 */
const maskMethodConfiguration = (method) => {
  if (!method) return null;
  const obj = method.toObject ? method.toObject() : { ...method };

  if (obj.configuration && typeof obj.configuration === "object") {
    const masked = {};
    for (const [k, v] of Object.entries(obj.configuration)) {
      if (
        /secret|password|private|key/i.test(k) &&
        typeof v === "string" &&
        v.length > 0
      ) {
        masked[k] = "••••••••" + v.slice(-4);
      } else {
        masked[k] = v;
      }
    }
    obj.configuration = masked;
  }

  obj.isGatewayConfigured = isGatewayConfigured(obj.gateway);
  return obj;
};

/**
 * Customer Endpoint: Get currently available, eligible payment methods.
 */
const getAvailablePaymentMethods = async ({
  country = "IN",
  currency = "INR",
  orderAmount = null,
  orderId = null,
} = {}) => {
  await seedDefaultPaymentMethods();

  let resolvedCountry = String(country || "IN").toUpperCase().trim();
  let resolvedCurrency = String(currency || "INR").toUpperCase().trim();
  let resolvedAmount = orderAmount !== null ? Number(orderAmount) : null;

  if (orderId) {
    const order = await orderRepository.findById(orderId);
    if (order) {
      resolvedAmount = Number(order.grandTotal?.toString() || 0);
      resolvedCurrency = String(order.currency || "INR").toUpperCase();
      if (order.shippingAddress?.country) {
        resolvedCountry = String(order.shippingAddress.country).toUpperCase().trim();
      }
    }
  }

  const activeMethods = await paymentMethodRepository.findActive();

  const eligible = activeMethods.filter((method) => {
    // 1. Gateway must be configured server-side
    if (!isGatewayConfigured(method.gateway)) {
      return false;
    }

    // 2. Country eligibility
    const countries = (method.supportedCountries || []).map((c) => c.toUpperCase());
    const isCountryEligible =
      countries.includes("ALL") || countries.includes(resolvedCountry);
    if (!isCountryEligible) {
      return false;
    }

    // 3. Currency eligibility
    const currencies = (method.supportedCurrencies || []).map((c) => c.toUpperCase());
    const isCurrencyEligible =
      currencies.includes("ALL") || currencies.includes(resolvedCurrency);
    if (!isCurrencyEligible) {
      return false;
    }

    // 4. Order amount limits
    if (resolvedAmount !== null && !isNaN(resolvedAmount)) {
      if (method.minimumOrderAmount) {
        const min = Number(method.minimumOrderAmount.toString());
        if (resolvedAmount < min) return false;
      }
      if (method.maximumOrderAmount) {
        const max = Number(method.maximumOrderAmount.toString());
        if (resolvedAmount > max) return false;
      }
    }

    return true;
  });

  // Return public safe presentation payload
  return eligible.map((m) => ({
    id: m._id,
    name: m.name,
    code: m.code,
    gateway: m.gateway,
    type: m.type,
    description: m.description,
    icon: m.icon,
    enabled: m.enabled,
    displayOrder: m.displayOrder,
    supportedCurrencies: m.supportedCurrencies,
  }));
};


/**
 * Admin Endpoint: List all payment methods with filters.
 */
const listAllPaymentMethods = async ({ search = "", status = "all", gateway = "all" } = {}) => {
  await seedDefaultPaymentMethods();

  const filter = {};
  if (status === "active") {
    filter.enabled = true;
  } else if (status === "disabled") {
    filter.enabled = false;
  }

  if (gateway && gateway !== "all") {
    filter.gateway = gateway.toLowerCase().trim();
  }

  let methods = await paymentMethodRepository.findAll(filter);

  if (search && search.trim().length > 0) {
    const q = search.toLowerCase().trim();
    methods = methods.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        m.gateway.toLowerCase().includes(q)
    );
  }

  return methods.map(maskMethodConfiguration);
};

/**
 * Admin Endpoint: Get payment method details by ID.
 */
const getPaymentMethodById = async (id) => {
  const method = await paymentMethodRepository.findById(id);
  if (!method || method.isDeleted) {
    throw new AppError("Payment method not found", 404, "PAYMENT_METHOD_NOT_FOUND");
  }
  return maskMethodConfiguration(method);
};

/**
 * Admin Endpoint: Create a new payment method.
 */
const createPaymentMethod = async (data, actorId) => {
  const existing = await paymentMethodRepository.findByCode(data.code);
  if (existing) {
    throw new AppError(
      `Payment method with code '${data.code}' already exists`,
      400,
      "PAYMENT_METHOD_CODE_EXISTS"
    );
  }

  // If attempting to enable upon creation, validate gateway configuration
  if (data.enabled && !isGatewayConfigured(data.gateway)) {
    throw new AppError(
      `Cannot enable payment method: Gateway '${data.gateway}' is not configured on the server`,
      400,
      "GATEWAY_NOT_CONFIGURED"
    );
  }

  const created = await paymentMethodRepository.create(data);

  if (actorId) {
    await recordAuditLog({
      actorId,
      targetId: created._id,
      action: "payment_method.create",
      entityType: "PaymentMethod",
      afterState: created.toObject(),
    }).catch(() => {});
  }

  return maskMethodConfiguration(created);
};

/**
 * Admin Endpoint: Update payment method configuration.
 */
const updatePaymentMethod = async (id, data, actorId) => {
  const method = await paymentMethodRepository.findById(id);
  if (!method || method.isDeleted) {
    throw new AppError("Payment method not found", 404, "PAYMENT_METHOD_NOT_FOUND");
  }

  const gatewayToCheck = data.gateway || method.gateway;
  if (data.enabled === true && !isGatewayConfigured(gatewayToCheck)) {
    throw new AppError(
      `Cannot activate payment method: Gateway '${gatewayToCheck}' is not configured on the server`,
      400,
      "GATEWAY_NOT_CONFIGURED"
    );
  }

  const beforeState = method.toObject();
  const updated = await paymentMethodRepository.updateById(id, data);

  if (actorId) {
    await recordAuditLog({
      actorId,
      targetId: updated._id,
      action: "payment_method.update",
      entityType: "PaymentMethod",
      beforeState,
      afterState: updated.toObject(),
    }).catch(() => {});
  }

  return maskMethodConfiguration(updated);
};

/**
 * Admin Endpoint: Toggle active/disabled status.
 */
const togglePaymentMethodStatus = async (id, actorId) => {
  const method = await paymentMethodRepository.findById(id);
  if (!method || method.isDeleted) {
    throw new AppError("Payment method not found", 404, "PAYMENT_METHOD_NOT_FOUND");
  }

  const nextState = !method.enabled;

  if (nextState === true && !isGatewayConfigured(method.gateway)) {
    throw new AppError(
      `Cannot activate '${method.name}': Gateway '${method.gateway}' is not configured with valid server credentials`,
      400,
      "GATEWAY_NOT_CONFIGURED"
    );
  }

  const beforeState = method.toObject();
  const updated = await paymentMethodRepository.updateById(id, { enabled: nextState });

  if (actorId) {
    await recordAuditLog({
      actorId,
      targetId: updated._id,
      action: nextState ? "payment_method.activate" : "payment_method.deactivate",
      entityType: "PaymentMethod",
      beforeState,
      afterState: updated.toObject(),
    }).catch(() => {});
  }

  return maskMethodConfiguration(updated);
};

/**
 * Admin Endpoint: Soft delete / archive a payment method.
 * Never modifies historical payment records.
 */
const deletePaymentMethod = async (id, actorId) => {
  const method = await paymentMethodRepository.findById(id);
  if (!method || method.isDeleted) {
    throw new AppError("Payment method not found", 404, "PAYMENT_METHOD_NOT_FOUND");
  }

  const beforeState = method.toObject();
  const deleted = await paymentMethodRepository.softDelete(id);

  if (actorId) {
    await recordAuditLog({
      actorId,
      targetId: deleted._id,
      action: "payment_method.delete",
      entityType: "PaymentMethod",
      beforeState,
      afterState: deleted.toObject(),
    }).catch(() => {});
  }

  return {
    success: true,
    softDeleted: true,
    message: `Payment method '${method.name}' archived successfully`,
  };
};

/**
 * Admin Endpoint: Reorder payment methods.
 */
const reorderPaymentMethods = async (orderedIds = [], actorId) => {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new AppError("A list of payment method IDs is required", 400, "INVALID_REORDER_PAYLOAD");
  }

  for (let i = 0; i < orderedIds.length; i++) {
    await paymentMethodRepository.updateById(orderedIds[i], { displayOrder: i + 1 });
  }

  if (actorId) {
    await recordAuditLog({
      actorId,
      action: "payment_method.reorder",
      entityType: "PaymentMethod",
      afterState: { orderedIds },
    }).catch(() => {});
  }

  return listAllPaymentMethods();
};

/**
 * Customer Endpoint: Get customer's saved tokenized payment methods.
 */
const getMyPaymentMethods = async (userId) => {
  const Customer = require("../models/Customer");
  const PaymentMethod = require("../models/PaymentMethod");

  const customer = await Customer.findOne({ userId });
  if (!customer) {
    return [];
  }

  const methods = await PaymentMethod.find({
    customerId: customer._id,
    isDeleted: false,
  })
    .sort({ isDefault: -1, createdAt: -1 })
    .lean();

  return methods.map((m) => ({
    id: m._id,
    name: m.name,
    type: m.type,
    cardBrand: m.cardBrand,
    last4: m.last4,
    expiryMonth: m.expiryMonth,
    expiryYear: m.expiryYear,
    isDefault: m.isDefault,
    createdAt: m.createdAt,
  }));
};

/**
 * Customer Endpoint: Save a tokenized payment instrument (card / UPI reference).
 * Rejects raw PAN or CVV.
 */
const saveCustomerPaymentMethod = async (userId, payload) => {
  const Customer = require("../models/Customer");
  const PaymentMethod = require("../models/PaymentMethod");

  const customer = await Customer.findOne({ userId });
  if (!customer) {
    throw new AppError("Customer profile not found", 404, "CUSTOMER_NOT_FOUND");
  }

  const {
    name = "Saved Card",
    type = "card",
    token,
    last4,
    cardBrand = "visa",
    expiryMonth,
    expiryYear,
    isDefault = false,
  } = payload;

  if (!token || !token.trim()) {
    throw new AppError("Secure token reference is required", 400, "TOKEN_REQUIRED");
  }

  if (payload.cardNumber || payload.pan || payload.cvv || payload.cvc) {
    throw new AppError("Direct card numbers and CVV codes are strictly prohibited", 400, "INSECURE_PAYLOAD");
  }

  if (last4 && !/^\d{4}$/.test(last4)) {
    throw new AppError("last4 must be exactly 4 digits", 400, "INVALID_LAST4");
  }

  const existingCount = await PaymentMethod.countDocuments({
    customerId: customer._id,
    isDeleted: false,
  });

  const shouldBeDefault = isDefault || existingCount === 0;
  if (shouldBeDefault) {
    await PaymentMethod.updateMany(
      { customerId: customer._id },
      { isDefault: false }
    );
  }

  const uniqueCode = `cust_${customer._id}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const created = await PaymentMethod.create({
    customerId: customer._id,
    name: name.trim(),
    code: uniqueCode,
    gateway: "razorpay",
    type: type || "card",
    token: token.trim(),
    last4: last4 || null,
    cardBrand: (cardBrand || "visa").toLowerCase(),
    expiryMonth: expiryMonth ? Number(expiryMonth) : null,
    expiryYear: expiryYear ? Number(expiryYear) : null,
    isDefault: shouldBeDefault,
    enabled: true,
  });

  return {
    id: created._id,
    name: created.name,
    type: created.type,
    cardBrand: created.cardBrand,
    last4: created.last4,
    expiryMonth: created.expiryMonth,
    expiryYear: created.expiryYear,
    isDefault: created.isDefault,
    createdAt: created.createdAt,
  };
};

/**
 * Customer Endpoint: Set default payment method.
 */
const setDefaultPaymentMethod = async (userId, methodId) => {
  const Customer = require("../models/Customer");
  const PaymentMethod = require("../models/PaymentMethod");

  const customer = await Customer.findOne({ userId });
  if (!customer) {
    throw new AppError("Customer profile not found", 404, "CUSTOMER_NOT_FOUND");
  }

  const method = await PaymentMethod.findOne({
    _id: methodId,
    customerId: customer._id,
    isDeleted: false,
  });

  if (!method) {
    throw new AppError("Payment method not found", 404, "PAYMENT_METHOD_NOT_FOUND");
  }

  await PaymentMethod.updateMany(
    { customerId: customer._id },
    { isDefault: false }
  );

  method.isDefault = true;
  await method.save();

  return {
    id: method._id,
    isDefault: true,
    message: "Default payment method updated successfully",
  };
};

/**
 * Customer Endpoint: Delete customer payment method.
 */
const deleteCustomerPaymentMethod = async (userId, methodId) => {
  const Customer = require("../models/Customer");
  const PaymentMethod = require("../models/PaymentMethod");

  const customer = await Customer.findOne({ userId });
  if (!customer) {
    throw new AppError("Customer profile not found", 404, "CUSTOMER_NOT_FOUND");
  }

  const method = await PaymentMethod.findOne({
    _id: methodId,
    customerId: customer._id,
    isDeleted: false,
  });

  if (!method) {
    throw new AppError("Payment method not found", 404, "PAYMENT_METHOD_NOT_FOUND");
  }

  method.isDeleted = true;
  method.deletedAt = new Date();
  await method.save();

  if (method.isDefault) {
    const nextMethod = await PaymentMethod.findOne({
      customerId: customer._id,
      isDeleted: false,
    }).sort({ createdAt: -1 });

    if (nextMethod) {
      nextMethod.isDefault = true;
      await nextMethod.save();
    }
  }

  return {
    id: methodId,
    message: "Payment method deleted successfully",
  };
};

module.exports = {
  seedDefaultPaymentMethods,
  isGatewayConfigured,
  getAvailablePaymentMethods,
  listAllPaymentMethods,
  getPaymentMethodById,
  createPaymentMethod,
  updatePaymentMethod,
  togglePaymentMethodStatus,
  deletePaymentMethod,
  reorderPaymentMethods,
  getMyPaymentMethods,
  saveCustomerPaymentMethod,
  setDefaultPaymentMethod,
  deleteCustomerPaymentMethod,
};
