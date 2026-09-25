const DelhiveryAdapter = require("../integrations/shipping/delhivery.adapter");
const ShiprocketAdapter = require("../integrations/shipping/shiprocket.adapter");
const Shipment = require("../models/Shipment");
const ShipmentWebhookEvent = require("../models/ShipmentWebhookEvent");
const CredentialService = require("./credential.service");
const EmailService = require("./email.service");
const AppError = require("../errors/AppError");
const { canTransitionShipmentStatus, SHIPMENT_STATUSES } = require("../constants/shipping.constants");

const emailService = new EmailService();

class CourierService {
  constructor() {
    this.adapters = {
      delhivery: new DelhiveryAdapter(),
      shiprocket: new ShiprocketAdapter(),
    };
  }

  getAdapter(provider) {
    const adapter = this.adapters[provider?.toLowerCase()];
    if (!adapter) {
      throw new AppError(`Unsupported courier provider: ${provider}`, 400, "UNSUPPORTED_COURIER");
    }
    return adapter;
  }

  /**
   * Process and validate incoming courier webhook.
   * Guarantees:
   * 1. Signature validation.
   * 2. Idempotency (duplicate events are ignored).
   * 3. State transition validity (rejects illegal jumps).
   * 4. Customer transactional notification on status change.
   */
  async handleWebhook({ provider, headers, body }) {
    const adapter = this.getAdapter(provider);
    const creds = await CredentialService.getDecryptedCredentials(provider);

    // 1. Signature Verification
    const isAuthentic = adapter.verifyWebhookSignature({ headers, body, runtimeCredentials: creds });
    if (!isAuthentic) {
      throw new AppError("Invalid courier webhook signature", 401, "INVALID_WEBHOOK_SIGNATURE");
    }

    // 2. Extract Event Identifiers
    const eventId = String(body.event_id || body.awb || body.waybill || body.id || headers["x-request-id"] || Date.now());
    const trackingNumber = String(body.tracking_number || body.awb || body.waybill || body.shipment_id || "").trim();
    const rawStatus = String(body.status || body.current_status || "").toLowerCase();

    if (!trackingNumber) {
      throw new AppError("Tracking number missing from webhook payload", 400, "MISSING_TRACKING_NUMBER");
    }

    // 3. Idempotency Check
    const existingEvent = await ShipmentWebhookEvent.findOne({ provider, eventId });
    if (existingEvent) {
      return {
        success: true,
        duplicate: true,
        message: "Webhook event already processed",
        eventId,
      };
    }

    // 4. Resolve Target Shipment
    const shipment = await Shipment.findOne({
      $or: [{ trackingNumber }, { shipmentNumber: trackingNumber }],
    }).populate("customerId");

    if (!shipment) {
      throw new AppError(
        `No shipment found matching tracking number ${trackingNumber}`,
        404,
        "SHIPMENT_NOT_FOUND"
      );
    }

    // 5. Map Carrier Status to Internal Buybox Status
    const statusMap = {
      manifested: SHIPMENT_STATUSES.PICKED_UP,
      picked_up: SHIPMENT_STATUSES.PICKED_UP,
      in_transit: SHIPMENT_STATUSES.IN_TRANSIT,
      out_for_delivery: SHIPMENT_STATUSES.OUT_FOR_DELIVERY,
      delivered: SHIPMENT_STATUSES.DELIVERED,
      rto: SHIPMENT_STATUSES.RETURNED,
      returned: SHIPMENT_STATUSES.RETURNED,
      cancelled: SHIPMENT_STATUSES.CANCELLED,
      failed: SHIPMENT_STATUSES.FAILED,
    };

    const targetStatus = statusMap[rawStatus] || SHIPMENT_STATUSES.IN_TRANSIT;

    // If status is identical, record event and return cleanly
    if (shipment.status === targetStatus) {
      await ShipmentWebhookEvent.create({
        provider,
        eventId,
        eventType: rawStatus,
        trackingNumber,
        status: targetStatus,
        payload: body,
      });

      return {
        success: true,
        message: "Shipment status is already current",
        shipmentNumber: shipment.shipmentNumber,
        status: shipment.status,
      };
    }

    // 6. Strict State Transition Gate
    const isTransitionAllowed = canTransitionShipmentStatus(shipment.status, targetStatus);
    if (!isTransitionAllowed) {
      throw new AppError(
        `Illegal shipment status transition from '${shipment.status}' to '${targetStatus}'`,
        400,
        "INVALID_SHIPMENT_STATUS_TRANSITION"
      );
    }

    // 7. Apply Transition and Persist Event
    const previousStatus = shipment.status;
    const shipmentService = require("./shipment.service");
    await shipmentService.transitionShipmentStatus({
      shipmentId: shipment._id,
      nextStatus: targetStatus,
    });

    await ShipmentWebhookEvent.create({
      provider,
      eventId,
      eventType: rawStatus,
      trackingNumber,
      status: targetStatus,
      payload: body,
    });

    // 8. Dispatch Customer Email Notification
    const customerEmail = shipment.customerId?.email || shipment.shippingAddress?.email;
    const customerName = shipment.shippingAddress?.fullName || "Customer";

    if (customerEmail) {
      if (targetStatus === SHIPMENT_STATUSES.DELIVERED) {
        emailService.sendDeliveryConfirmation({
          to: customerEmail,
          customerName,
          orderNumber: shipment.shipmentNumber,
        }).catch(() => {});
      } else if (targetStatus === SHIPMENT_STATUSES.OUT_FOR_DELIVERY || targetStatus === SHIPMENT_STATUSES.IN_TRANSIT) {
        emailService.sendShipmentUpdate({
          to: customerEmail,
          customerName,
          orderNumber: shipment.shipmentNumber,
          carrier: shipment.carrier || provider,
          trackingNumber: shipment.trackingNumber,
          trackingUrl: shipment.trackingUrl,
        }).catch(() => {});
      }
    }

    return {
      success: true,
      shipmentNumber: shipment.shipmentNumber,
      previousStatus,
      newStatus: targetStatus,
    };
  }
}

module.exports = new CourierService();
