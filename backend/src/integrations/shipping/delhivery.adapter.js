const CourierAdapter = require("./courier.adapter");
const env = require("../../config/env");
const crypto = require("crypto");

class DelhiveryAdapter extends CourierAdapter {
  constructor() {
    super("delhivery");
  }

  resolveCredentials(runtimeCredentials = null) {
    return {
      apiKey: runtimeCredentials?.apiKey || env.DELHIVERY_API_KEY || "",
      clientId: runtimeCredentials?.clientId || env.DELHIVERY_CLIENT_ID || "",
      clientSecret: runtimeCredentials?.clientSecret || env.DELHIVERY_CLIENT_SECRET || "",
    };
  }

  generateTrackingUrl(trackingNumber) {
    if (!trackingNumber) return null;
    return `https://www.delhivery.com/track/package/${encodeURIComponent(trackingNumber)}`;
  }

  async createShipment({ shipment, origin, destination, runtimeCredentials }) {
    const creds = this.resolveCredentials(runtimeCredentials);

    if (!creds.apiKey) {
      return {
        success: false,
        status: "not_configured",
        error: "Delhivery API key is not configured",
      };
    }

    try {
      const response = await fetch("https://track.delhivery.com/api/cmu/create.json", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${creds.apiKey}`,
        },
        body: JSON.stringify({
          shipments: [
            {
              name: destination.fullName,
              add: destination.addressLine1,
              pin: destination.postalCode,
              city: destination.city,
              state: destination.state,
              country: destination.country || "India",
              phone: destination.phone,
              order: shipment.shipmentNumber,
              payment_mode: "Prepaid",
            },
          ],
        }),
      });

      const data = await response.json();
      const packageDetail = data?.packages?.[0];

      return {
        success: true,
        waybill: packageDetail?.waybill || null,
        carrier: "Delhivery",
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

    if (!creds.apiKey) {
      return {
        success: false,
        status: "not_configured",
        error: "Delhivery API credentials not configured",
      };
    }

    try {
      const response = await fetch(
        `https://track.delhivery.com/api/v1/packages/json/?waybill=${encodeURIComponent(trackingNumber)}`,
        {
          headers: {
            Authorization: `Token ${creds.apiKey}`,
          },
        }
      );

      const data = await response.json();
      return {
        success: true,
        carrier: "Delhivery",
        trackingNumber,
        status: data?.ShipmentData?.[0]?.Shipment?.Status?.Status || "in_transit",
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

  verifyWebhookSignature({ headers, body, runtimeCredentials }) {
    const creds = this.resolveCredentials(runtimeCredentials);
    const signature = headers["x-delhivery-signature"] || headers["x-webhook-signature"];

    if (!creds.clientSecret) {
      // In development/test mode where secret is unconfigured
      return signature ? true : false;
    }

    if (!signature) {
      return false;
    }

    const payload = typeof body === "object" ? JSON.stringify(body) : String(body);
    const expected = crypto.createHmac("sha256", creds.clientSecret).update(payload).digest("hex");

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(sigBuf, expBuf);
  }
}

module.exports = DelhiveryAdapter;
