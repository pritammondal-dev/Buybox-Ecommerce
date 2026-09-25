const axios = require("axios");
const env = require("../../config/env");
const AppError = require("../../errors/AppError");

let cachedToken = null;
let tokenExpiresAt = 0;

const getBaseUrl = () => {
  return env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
};

const isConfigured = () => {
  return Boolean(
    env.PAYPAL_CLIENT_ID &&
      env.PAYPAL_CLIENT_ID.trim().length > 0 &&
      env.PAYPAL_CLIENT_SECRET &&
      env.PAYPAL_CLIENT_SECRET.trim().length > 0
  );
};

const getAccessToken = async () => {
  if (!isConfigured()) {
    throw new AppError(
      "PayPal payment provider is not configured",
      503,
      "PAYPAL_NOT_CONFIGURED"
    );
  }

  const now = Date.now();
  if (cachedToken && tokenExpiresAt > now + 60000) {
    return cachedToken;
  }

  const auth = Buffer.from(
    `${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  try {
    const response = await axios.post(
      `${getBaseUrl()}/v1/oauth2/token`,
      "grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 10000,
      }
    );

    cachedToken = response.data.access_token;
    tokenExpiresAt = now + (response.data.expires_in || 3600) * 1000;
    return cachedToken;
  } catch (error) {
    throw new AppError(
      "Failed to authenticate with PayPal API",
      502,
      "PAYPAL_AUTHENTICATION_FAILED"
    );
  }
};

const createOrder = async ({ amount, currency = "INR", receipt, referenceId }) => {
  const token = await getAccessToken();

  const body = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: referenceId || receipt || "buybox-order",
        custom_id: receipt || undefined,
        amount: {
          currency_code: String(currency).toUpperCase(),
          value: Number(amount).toFixed(2),
        },
      },
    ],
    application_context: {
      brand_name: "Buybox Store",
      landing_page: "NO_PREFERENCE",
      user_action: "PAY_NOW",
    },
  };

  try {
    const response = await axios.post(
      `${getBaseUrl()}/v2/checkout/orders`,
      body,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    return response.data;
  } catch (error) {
    const detail =
      error?.response?.data?.message ||
      error?.response?.data?.details?.[0]?.description ||
      "Unable to create PayPal order";
    throw new AppError(detail, 502, "PAYPAL_ORDER_CREATION_FAILED");
  }
};

const captureOrder = async (paypalOrderId) => {
  if (!paypalOrderId || typeof paypalOrderId !== "string" || !paypalOrderId.trim()) {
    throw new AppError(
      "Invalid PayPal order ID",
      400,
      "INVALID_PAYPAL_ORDER_ID"
    );
  }

  const token = await getAccessToken();

  try {
    const response = await axios.post(
      `${getBaseUrl()}/v2/checkout/orders/${paypalOrderId.trim()}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    return response.data;
  } catch (error) {
    const detail =
      error?.response?.data?.message ||
      error?.response?.data?.details?.[0]?.description ||
      "Unable to capture PayPal payment";
    throw new AppError(detail, 502, "PAYPAL_CAPTURE_FAILED");
  }
};

const refundCapture = async (captureId, { amount, currency, note }) => {
  if (!captureId || typeof captureId !== "string" || !captureId.trim()) {
    throw new AppError(
      "Invalid capture ID for refund",
      400,
      "INVALID_CAPTURE_ID"
    );
  }

  const token = await getAccessToken();

  const body = {};
  if (amount) {
    body.amount = {
      value: Number(amount).toFixed(2),
      currency_code: String(currency || "INR").toUpperCase(),
    };
  }
  if (note) {
    body.note_to_payer = String(note).slice(0, 255);
  }

  try {
    const response = await axios.post(
      `${getBaseUrl()}/v2/payments/captures/${captureId.trim()}/refund`,
      body,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    return response.data;
  } catch (error) {
    const detail =
      error?.response?.data?.message ||
      error?.response?.data?.details?.[0]?.description ||
      "Unable to process PayPal refund";
    throw new AppError(detail, 502, "PAYPAL_REFUND_FAILED");
  }
};

module.exports = {
  isConfigured,
  getBaseUrl,
  getAccessToken,
  createOrder,
  captureOrder,
  refundCapture,
};
