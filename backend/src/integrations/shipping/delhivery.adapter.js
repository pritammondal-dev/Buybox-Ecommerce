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
      clientSecret:
        runtimeCredentials?.clientSecret ||
        runtimeCredentials?.webhookSecret ||
        env.DELHIVERY_CLIENT_SECRET ||
        env.DELHIVERY_WEBHOOK_SECRET ||
        "",
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
        error: "Delhivery API credentials not configured",
      };
    }

    const dest = destination || shipment?.shippingAddress;
    if (!dest?.fullName || !dest?.postalCode) {
      return {
        success: false,
        status: "invalid_destination",
        error: "Destination recipient name and postal code are required",
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
              name: dest.fullName,
              add: dest.addressLine1 || "",
              pin: dest.postalCode,
              city: dest.city || "",
              state: dest.state || "",
              country: dest.country || "India",
              phone: dest.phone || "",
              order: shipment.shipmentNumber,
              payment_mode: "Prepaid",
            },
          ],
        }),
      });

      let data = null;
      try {
        data = await response.json();
      } catch {
        const text = await response.text().catch(() => "");
        data = { error: text || `HTTP ${response.status}` };
      }
      const packageDetail = data?.packages?.[0];

      if (!response.ok || !packageDetail?.waybill || packageDetail?.status === "Fail") {
        const errorMsg =
          packageDetail?.remarks?.[0] ||
          data?.error ||
          (packageDetail?.remarks ? String(packageDetail.remarks) : null) ||
          `Delhivery CMU booking rejected (HTTP ${response.status})`;

        return {
          success: false,
          status: "rejected",
          error: errorMsg,
          raw: data,
        };
      }

      return {
        success: true,
        status: "booked",
        waybill: packageDetail.waybill,
        providerShipmentId: packageDetail?.refnum || packageDetail.waybill,
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

  async generateShippingLabel({ shipment, runtimeCredentials }) {
    const creds = this.resolveCredentials(runtimeCredentials);
    const trackingNumber = shipment?.trackingNumber || shipment?.awbNumber;

    if (!creds.apiKey) {
      return {
        success: false,
        status: "not_configured",
        error: "Delhivery API credentials not configured",
        labelUrl: null,
      };
    }

    if (!trackingNumber) {
      return {
        success: false,
        status: "error",
        error: "Tracking number required to generate Delhivery label",
      };
    }

    try {
      const response = await fetch(
        `https://track.delhivery.com/api/p/packing_slip?wbns=${encodeURIComponent(trackingNumber)}`,
        {
          headers: {
            Authorization: `Token ${creds.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        return {
          success: false,
          status: "error",
          error: `Delhivery label API error: ${response.statusText}`,
        };
      }

      const data = await response.json();
      const labelUrl = data?.packages_found?.[0]?.pdf_download_link || null;

      return {
        success: true,
        carrier: "Delhivery",
        labelUrl,
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

  async schedulePickup({ shipment, scheduledDate, timeSlot, notes, runtimeCredentials }) {
    const creds = this.resolveCredentials(runtimeCredentials);

    if (!creds.apiKey) {
      return {
        success: false,
        status: "not_configured",
        error: "Delhivery API credentials not configured",
      };
    }

    try {
      const pickupDateStr = scheduledDate ? new Date(scheduledDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
      const pickupTimeStr = timeSlot?.split("-")?.[0]?.trim() || "10:00:00";

      const response = await fetch("https://track.delhivery.com/fm/request/new/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${creds.apiKey}`,
        },
        body: JSON.stringify({
          pickup_date: pickupDateStr,
          pickup_time: pickupTimeStr,
          pickup_location: shipment?.warehouseId?.name || "Primary Warehouse",
          expected_package_count: 1,
        }),
      });

      const data = await response.json();
      return {
        success: true,
        pickupToken: data?.pickup_id || data?.id || `DLV-PKP-${Date.now().toString(36).toUpperCase()}`,
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
    const trackingNumber = shipment?.trackingNumber || shipment?.awbNumber;

    if (!creds.apiKey) {
      return {
        success: false,
        status: "not_configured",
        error: "Delhivery API credentials not configured",
      };
    }

    try {
      const response = await fetch("https://track.delhivery.com/api/p/edit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${creds.apiKey}`,
        },
        body: JSON.stringify({
          waybill: trackingNumber,
          cancellation: "true",
        }),
      });

      const data = await response.json();
      return {
        success: true,
        cancellationAcknowledged: true,
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

  async checkServiceability({ originPostalCode, destinationPostalCode, weightGrams, runtimeCredentials }) {
    const creds = this.resolveCredentials(runtimeCredentials);

    if (!creds.apiKey) {
      const pinRegex = /^\d{6}$/;
      return {
        serviceable: pinRegex.test(String(destinationPostalCode || "").trim()),
        carrier: "Delhivery",
        status: "unverified_unconfigured",
        estimatedDays: 3,
      };
    }

    try {
      const response = await fetch(
        `https://track.delhivery.com/c/api/pin-codes/json/?filter_codes=${encodeURIComponent(destinationPostalCode)}`,
        {
          headers: {
            Authorization: `Token ${creds.apiKey}`,
          },
        }
      );

      const data = await response.json();
      const codeData = data?.delivery_codes?.[0]?.postal_code;
      const serviceable = Boolean(codeData && codeData.pre_paid === "Y");

      return {
        serviceable,
        carrier: "Delhivery",
        codAvailable: codeData?.cod === "Y",
        prepaidAvailable: codeData?.pre_paid === "Y",
        raw: data,
      };
    } catch (err) {
      return {
        serviceable: false,
        error: err.message,
      };
    }
  }

  verifyWebhookSignature({ headers = {}, body, rawBody, runtimeCredentials }) {
    const creds = this.resolveCredentials(runtimeCredentials);
    const secret = creds.clientSecret;
    const signature = headers["x-delhivery-signature"] || headers["x-webhook-signature"];

    // In dev/test mode where clientSecret is unconfigured, require presence of a signature header
    if (!secret) {
      return Boolean(signature);
    }

    // Missing signature header
    if (!signature || typeof signature !== "string") {
      return false;
    }

    // Rule 11: Never silently fall back to JSON.stringify(body) when the required raw payload is unavailable
    if (rawBody === undefined || rawBody === null) {
      return false;
    }

    // Resolve payload into Buffer
    let payloadBuffer;
    if (Buffer.isBuffer(rawBody)) {
      payloadBuffer = rawBody;
    } else if (typeof rawBody === "string") {
      payloadBuffer = Buffer.from(rawBody, "utf8");
    } else {
      return false;
    }

    try {
      const expectedHex = crypto
        .createHmac("sha256", secret)
        .update(payloadBuffer)
        .digest("hex");

      const normalizedSignature = signature.trim().toLowerCase();
      const normalizedExpected = expectedHex.toLowerCase();

      // Check hex format and length (SHA256 hex is 64 characters)
      if (normalizedSignature.length !== normalizedExpected.length) {
        return false;
      }
      if (!/^[0-9a-f]+$/i.test(normalizedSignature)) {
        return false;
      }

      const sigBuf = Buffer.from(normalizedSignature, "utf8");
      const expBuf = Buffer.from(normalizedExpected, "utf8");

      if (sigBuf.length !== expBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  }
}

module.exports = DelhiveryAdapter;
