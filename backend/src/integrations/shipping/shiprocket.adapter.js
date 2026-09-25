const CourierAdapter = require("./courier.adapter");
const env = require("../../config/env");

class ShiprocketAdapter extends CourierAdapter {
  constructor() {
    super("shiprocket");
    this.cachedToken = null;
    this.tokenExpiry = null;
  }

  resolveCredentials(runtimeCredentials = null) {
    return {
      email: runtimeCredentials?.email || env.SHIPROCKET_EMAIL || "",
      password: runtimeCredentials?.password || env.SHIPROCKET_PASSWORD || "",
      apiKey: runtimeCredentials?.apiKey || env.SHIPROCKET_API_KEY || "",
    };
  }

  generateTrackingUrl(trackingNumber) {
    if (!trackingNumber) return null;
    return `https://shiprocket.co/tracking/${encodeURIComponent(trackingNumber)}`;
  }

  async authenticate(creds) {
    if (this.cachedToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.cachedToken;
    }

    if (!creds.email || !creds.password) {
      return null;
    }

    try {
      const response = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: creds.email,
          password: creds.password,
        }),
      });

      if (!response.ok) return null;
      const data = await response.json();
      this.cachedToken = data.token;
      this.tokenExpiry = Date.now() + 9 * 24 * 60 * 60 * 1000; // ~9 days
      return this.cachedToken;
    } catch {
      return null;
    }
  }

  async createShipment({ shipment, destination, runtimeCredentials }) {
    const creds = this.resolveCredentials(runtimeCredentials);
    const token = await this.authenticate(creds);

    if (!token) {
      return {
        success: false,
        status: "not_configured",
        error: "Shiprocket credentials missing or authentication failed",
      };
    }

    try {
      const response = await fetch("https://apiv2.shiprocket.in/v1/external/orders/create/adhoc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          order_id: shipment.shipmentNumber,
          order_date: new Date().toISOString().split("T")[0],
          billing_customer_name: destination.fullName,
          billing_address: destination.addressLine1,
          billing_city: destination.city,
          billing_pincode: destination.postalCode,
          billing_state: destination.state,
          billing_country: destination.country || "India",
          billing_phone: destination.phone,
          payment_method: "Prepaid",
        }),
      });

      const data = await response.json();
      return {
        success: true,
        orderId: data.order_id,
        shipmentId: data.shipment_id,
        carrier: "Shiprocket",
        raw: data,
      };
    } catch (err) {
      return {
        success: false,
        status: "error",
        error: err.message,
      };
    }
  }

  async trackShipment(trackingNumber, runtimeCredentials) {
    const creds = this.resolveCredentials(runtimeCredentials);
    const token = await this.authenticate(creds);

    if (!token) {
      return {
        success: false,
        status: "not_configured",
        error: "Shiprocket credentials missing",
      };
    }

    try {
      const response = await fetch(
        `https://apiv2.shiprocket.in/v1/external/courier/track/awb/${encodeURIComponent(trackingNumber)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      return {
        success: true,
        carrier: "Shiprocket",
        trackingNumber,
        status: data?.tracking_data?.track_status === 1 ? "in_transit" : "processing",
        data,
      };
    } catch (err) {
      return {
        success: false,
        status: "error",
        error: err.message,
      };
    }
  }

  verifyWebhookSignature({ headers, runtimeCredentials }) {
    const creds = this.resolveCredentials(runtimeCredentials);
    const key = headers["x-api-key"] || headers["x-webhook-token"];

    if (!creds.apiKey) {
      // In dev/test mode where secret is unconfigured
      return key ? true : false;
    }

    return key === creds.apiKey;
  }
}

module.exports = ShiprocketAdapter;
