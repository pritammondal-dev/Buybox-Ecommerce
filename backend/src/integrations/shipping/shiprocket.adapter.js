const CourierAdapter = require("./courier.adapter");
const env = require("../../config/env");
const crypto = require("crypto");

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
      webhookSecret:
        runtimeCredentials?.webhookSecret ||
        env.SHIPROCKET_WEBHOOK_SECRET ||
        "",
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

  async generateShippingLabel({ shipment, runtimeCredentials }) {
    const creds = this.resolveCredentials(runtimeCredentials);
    const token = await this.authenticate(creds);
    const providerShipmentId = shipment?.providerShipmentId || shipment?.metadata?.get?.("shiprocket_shipment_id");

    if (!token) {
      return {
        success: false,
        status: "not_configured",
        error: "Shiprocket credentials missing",
        labelUrl: null,
      };
    }

    try {
      const response = await fetch("https://apiv2.shiprocket.in/v1/external/courier/generate/label", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          shipment_id: [providerShipmentId || shipment?.shipmentNumber],
        }),
      });

      const data = await response.json();
      return {
        success: true,
        labelUrl: data?.label_url || null,
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

  async schedulePickup({ shipment, scheduledDate, timeSlot, runtimeCredentials }) {
    const creds = this.resolveCredentials(runtimeCredentials);
    const token = await this.authenticate(creds);
    const providerShipmentId = shipment?.providerShipmentId;

    if (!token) {
      return {
        success: false,
        status: "not_configured",
        error: "Shiprocket credentials missing",
      };
    }

    try {
      const pickupDateStr = scheduledDate ? new Date(scheduledDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];

      const response = await fetch("https://apiv2.shiprocket.in/v1/external/courier/generate/pickup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          shipment_id: [providerShipmentId || shipment?.shipmentNumber],
          pickup_date: [pickupDateStr],
        }),
      });

      const data = await response.json();
      return {
        success: true,
        pickupToken: data?.response?.pickup_token_number || `SR-PKP-${Date.now().toString(36).toUpperCase()}`,
        status: "scheduled",
        scheduledDate: pickupDateStr,
        timeSlot: timeSlot || "10:00-13:00",
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

  async cancelShipment({ shipment, reason, runtimeCredentials }) {
    const creds = this.resolveCredentials(runtimeCredentials);
    const token = await this.authenticate(creds);
    const providerOrderId = shipment?.providerOrderId || shipment?.shipmentNumber;

    if (!token) {
      return {
        success: false,
        status: "not_configured",
        error: "Shiprocket credentials missing",
      };
    }

    try {
      const response = await fetch("https://apiv2.shiprocket.in/v1/external/orders/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ids: [providerOrderId],
        }),
      });

      const data = await response.json();
      return {
        success: true,
        cancellationAcknowledged: true,
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

  async checkServiceability({ originPostalCode, destinationPostalCode, weightGrams, runtimeCredentials }) {
    const creds = this.resolveCredentials(runtimeCredentials);
    const token = await this.authenticate(creds);

    if (!token) {
      const pinRegex = /^\d{6}$/;
      return {
        serviceable: pinRegex.test(String(destinationPostalCode || "").trim()),
        carrier: "Shiprocket",
        status: "unverified_unconfigured",
        estimatedDays: 3,
      };
    }

    try {
      const weightKg = ((weightGrams || 500) / 1000).toFixed(2);
      const url = `https://apiv2.shiprocket.in/v1/external/courier/serviceability/?pickup_postcode=${encodeURIComponent(originPostalCode || "110001")}&delivery_postcode=${encodeURIComponent(destinationPostalCode)}&weight=${weightKg}&cod=0`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      const companies = data?.data?.available_courier_companies || [];
      const serviceable = companies.length > 0;

      return {
        serviceable,
        carrier: "Shiprocket",
        courierCount: companies.length,
        availableCouriers: companies.map((c) => ({
          name: c.courier_name,
          id: c.courier_company_id,
          rate: c.rate,
          etd: c.etd,
        })),
        raw: data,
      };
    } catch (err) {
      return {
        serviceable: false,
        error: err.message,
      };
    }
  }

  verifyWebhookSignature({ headers = {}, runtimeCredentials }) {
    const creds = this.resolveCredentials(runtimeCredentials);
    const key = headers["x-api-key"] || headers["x-webhook-token"];
    const expectedSecret = creds.webhookSecret || creds.apiKey;

    if (!expectedSecret) {
      // In dev/test mode where secret is unconfigured
      return Boolean(key);
    }

    if (!key || typeof key !== "string") {
      return false;
    }

    const keyBuf = Buffer.from(key.trim(), "utf8");
    const expBuf = Buffer.from(expectedSecret.trim(), "utf8");

    if (keyBuf.length !== expBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(keyBuf, expBuf);
  }
}

module.exports = ShiprocketAdapter;
