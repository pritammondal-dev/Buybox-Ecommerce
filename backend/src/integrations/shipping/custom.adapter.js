const CourierAdapter = require("./courier.adapter");
const { getShipmentPartnerById } = require("../../constants/shipping.constants");

class CustomCourierAdapter extends CourierAdapter {
  constructor(name = "custom") {
    super(name);
  }

  generateTrackingUrl(trackingNumber, partnerId = null) {
    if (!trackingNumber) return null;
    const partner = getShipmentPartnerById(partnerId || this.name);
    if (partner?.trackingUrlTemplate) {
      return partner.trackingUrlTemplate.replace("{trackingNumber}", encodeURIComponent(trackingNumber));
    }
    return null;
  }

  async createShipment({ shipment, origin, destination, runtimeCredentials }) {
    const carrierName = runtimeCredentials?.carrierName || shipment?.carrier || "Self / Merchant Fleet";
    const awb =
      (runtimeCredentials?.awbNumber && String(runtimeCredentials.awbNumber).trim()) ||
      (shipment?.awbNumber && String(shipment.awbNumber).trim()) ||
      (shipment?.trackingNumber && String(shipment.trackingNumber).trim()) ||
      null;

    if (!awb) {
      // In Demo/Manual mode without a real AWB: do NOT synthesize a fake AWB or mark status as 'booked'
      return {
        success: true,
        waybill: null,
        trackingNumber: null,
        trackingUrl: null,
        carrier: carrierName,
        status: "created",
        raw: {
          createdVia: "custom_adapter",
          mode: "manual_or_demo",
          timestamp: new Date().toISOString(),
          orderNumber: shipment?.shipmentNumber,
          destination: destination?.city,
          note: "No external AWB provided; internal shipment record initialized awaiting dispatch",
        },
      };
    }

    const trackingUrl =
      shipment?.trackingUrl ||
      this.generateTrackingUrl(awb, runtimeCredentials?.partnerId || shipment?.provider);

    return {
      success: true,
      waybill: awb,
      trackingNumber: awb,
      trackingUrl,
      carrier: carrierName,
      status: "booked",
      raw: {
        createdVia: "custom_adapter",
        timestamp: new Date().toISOString(),
        orderNumber: shipment?.shipmentNumber,
        destination: destination?.city,
      },
    };
  }

  async trackShipment(trackingNumber, runtimeCredentials) {
    if (!trackingNumber) {
      return {
        success: false,
        status: "error",
        error: "Tracking number required",
      };
    }

    return {
      success: true,
      carrier: runtimeCredentials?.carrierName || "Merchant Fleet",
      trackingNumber,
      status: "in_transit",
      trackingUrl: this.generateTrackingUrl(trackingNumber),
      data: {
        trackingNumber,
        lastUpdated: new Date().toISOString(),
      },
    };
  }

  async generateShippingLabel({ shipment, origin, destination }) {
    const labelData = {
      shipmentNumber: shipment?.shipmentNumber,
      awbNumber: shipment?.awbNumber || shipment?.trackingNumber,
      carrier: shipment?.carrier || "Custom Logistics",
      sender: {
        name: origin?.name || "Buybox Merchant Fulfillment",
        address: origin?.address || "",
        phone: origin?.phone || "",
      },
      consignee: {
        fullName: destination?.fullName || shipment?.shippingAddress?.fullName,
        phone: destination?.phone || shipment?.shippingAddress?.phone,
        addressLine1: destination?.addressLine1 || shipment?.shippingAddress?.addressLine1,
        addressLine2: destination?.addressLine2 || shipment?.shippingAddress?.addressLine2,
        city: destination?.city || shipment?.shippingAddress?.city,
        state: destination?.state || shipment?.shippingAddress?.state,
        postalCode: destination?.postalCode || shipment?.shippingAddress?.postalCode,
        country: destination?.country || shipment?.shippingAddress?.country || "India",
      },
      items: (shipment?.items || []).map((it) => ({
        name: it.name,
        sku: it.sku,
        quantity: it.quantity,
      })),
      packageDetails: shipment?.packageDetails || {
        weightGrams: 500,
        packageType: "box",
      },
      generatedAt: new Date().toISOString(),
    };

    return {
      success: true,
      carrier: shipment?.carrier || "Custom",
      labelData,
      labelUrl: shipment?.labelUrl || null,
    };
  }

  async schedulePickup({ shipment, scheduledDate, timeSlot, notes }) {
    const pickupToken = `PKP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    return {
      success: true,
      pickupToken,
      scheduledDate: scheduledDate || new Date(),
      timeSlot: timeSlot || "10:00-13:00",
      status: "scheduled",
      notes: notes || null,
      message: "Carrier pickup booked successfully",
    };
  }

  async cancelShipment({ shipment, reason }) {
    return {
      success: true,
      cancellationAcknowledged: true,
      cancelledAt: new Date().toISOString(),
      reason: reason || "Vendor requested cancellation",
    };
  }

  async checkServiceability({ originPostalCode, destinationPostalCode, weightGrams }) {
    const pinRegex = /^\d{6}$/;
    const isOriginValid = pinRegex.test(String(originPostalCode || "").trim());
    const isDestValid = pinRegex.test(String(destinationPostalCode || "").trim());

    if (!isDestValid) {
      return {
        serviceable: false,
        error: "Invalid destination postal code (must be 6 digits)",
      };
    }

    return {
      serviceable: true,
      carrier: this.name,
      originPostalCode,
      destinationPostalCode,
      estimatedDeliveryDays: 3,
      codAvailable: false,
      prepaidAvailable: true,
    };
  }

  verifyWebhookSignature({ headers, body }) {
    return true;
  }
}

module.exports = CustomCourierAdapter;

