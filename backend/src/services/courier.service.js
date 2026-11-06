const DelhiveryAdapter = require("../integrations/shipping/delhivery.adapter");
const ShiprocketAdapter = require("../integrations/shipping/shiprocket.adapter");
const CustomCourierAdapter = require("../integrations/shipping/custom.adapter");
const Shipment = require("../models/Shipment");
const ShipmentWebhookEvent = require("../models/ShipmentWebhookEvent");
const CredentialService = require("./credential.service");
const EmailService = require("./email.service");
const AppError = require("../errors/AppError");
const {
  canTransitionShipmentStatus,
  SHIPMENT_STATUSES,
  isValidShipmentPartner,
} = require("../constants/shipping.constants");

const emailService = new EmailService();

class CourierService {
  constructor() {
    this.adapters = {
      delhivery: new DelhiveryAdapter(),
      shiprocket: new ShiprocketAdapter(),
      custom: new CustomCourierAdapter("custom"),
      bluedart: new CustomCourierAdapter("bluedart"),
      dtdc: new CustomCourierAdapter("dtdc"),
      indiapost: new CustomCourierAdapter("indiapost"),
      self: new CustomCourierAdapter("custom"),
      merchant_fleet: new CustomCourierAdapter("custom"),
    };
  }

  getAdapter(provider) {
    const key = provider?.toLowerCase()?.trim();
    if (this.adapters[key]) {
      return this.adapters[key];
    }

    if (isValidShipmentPartner(key)) {
      return new CustomCourierAdapter(key);
    }

    throw new AppError(`Unsupported courier provider: ${provider}`, 400, "UNSUPPORTED_COURIER");
  }

  async checkServiceability({ provider = "delhivery", originPostalCode, destinationPostalCode, weightGrams }) {
    const adapter = this.getAdapter(provider);
    const creds = await CredentialService.getDecryptedCredentials(provider).catch(() => null);
    return adapter.checkServiceability({
      originPostalCode,
      destinationPostalCode,
      weightGrams,
      runtimeCredentials: creds,
    });
  }

  async createCourierShipment({ provider = "custom", shipment, origin, destination }) {
    const adapter = this.getAdapter(provider);
    const creds = await CredentialService.getDecryptedCredentials(provider).catch(() => null);
    return adapter.createShipment({
      shipment,
      origin,
      destination,
      runtimeCredentials: creds,
    });
  }

  async trackCourierShipment({ provider = "custom", trackingNumber }) {
    const adapter = this.getAdapter(provider);
    const creds = await CredentialService.getDecryptedCredentials(provider).catch(() => null);
    return adapter.trackShipment(trackingNumber, creds);
  }

  async generateShippingLabel({ provider = "custom", shipment, origin, destination }) {
    const adapter = this.getAdapter(provider);
    const creds = await CredentialService.getDecryptedCredentials(provider).catch(() => null);
    return adapter.generateShippingLabel({
      shipment,
      origin,
      destination,
      runtimeCredentials: creds,
    });
  }

  async schedulePickup({ provider = "custom", shipment, scheduledDate, timeSlot, notes }) {
    const adapter = this.getAdapter(provider);
    const creds = await CredentialService.getDecryptedCredentials(provider).catch(() => null);
    return adapter.schedulePickup({
      shipment,
      scheduledDate,
      timeSlot,
      notes,
      runtimeCredentials: creds,
    });
  }

  async cancelCourierShipment({ provider = "custom", shipment, reason }) {
    const adapter = this.getAdapter(provider);
    const creds = await CredentialService.getDecryptedCredentials(provider).catch(() => null);
    return adapter.cancelShipment({
      shipment,
      reason,
      runtimeCredentials: creds,
    });
  }

  /**
   * Process and validate incoming courier webhook.
   * Guarantees:
   * 1. Signature validation.
   * 2. Idempotency (duplicate events are ignored).
   * 3. State transition validity (rejects illegal jumps).
   * 4. Appends milestone to shipment.trackingEvents.
   * 5. Customer transactional notification on status change.
   */
  async handleWebhook({ provider, headers = {}, body, rawBody }) {
    const adapter = this.getAdapter(provider);
    const creds = await CredentialService.getDecryptedCredentials(provider);

    // If body is a Buffer, parse it to an object while preserving original rawBody bytes
    let parsedBody = body;
    let actualRawBody = rawBody;

    if (Buffer.isBuffer(body)) {
      actualRawBody = body;
      try {
        parsedBody = JSON.parse(body.toString("utf8"));
      } catch {
        throw new AppError("Malformed JSON webhook payload", 400, "MALFORMED_WEBHOOK_PAYLOAD");
      }
    } else if (!actualRawBody && typeof body === "string") {
      actualRawBody = Buffer.from(body, "utf8");
      try {
        parsedBody = JSON.parse(body);
      } catch {
        // preserve string
      }
    }

    // 1. Signature Verification
    const isAuthentic = adapter.verifyWebhookSignature({
      headers,
      body: parsedBody,
      rawBody: actualRawBody,
      runtimeCredentials: creds,
    });
    if (!isAuthentic) {
      throw new AppError("Invalid courier webhook signature", 401, "INVALID_WEBHOOK_SIGNATURE");
    }

    if (!parsedBody || typeof parsedBody !== "object") {
      throw new AppError("Invalid or empty webhook payload body", 400, "INVALID_WEBHOOK_PAYLOAD");
    }

    // 2. Extract Event Identifiers
    const trackingNumber = String(parsedBody.tracking_number || parsedBody.awb || parsedBody.waybill || parsedBody.shipment_id || "").trim();
    const rawStatus = String(parsedBody.status || parsedBody.current_status || "").toLowerCase();
    const location = String(parsedBody.location || parsedBody.city || parsedBody.activity_location || "").trim() || null;

    if (!trackingNumber) {
      throw new AppError("Tracking number missing from webhook payload", 400, "MISSING_TRACKING_NUMBER");
    }

    // Compound deterministic event ID when explicit unique event_id is absent (F-03)
    const rawTimestamp = String(parsedBody.activity_date || parsedBody.timestamp || parsedBody.status_date || parsedBody.updated_at || parsedBody.scan_date_time || "").trim();
    const explicitEventId = parsedBody.event_id || (parsedBody.id && String(parsedBody.id) !== trackingNumber ? parsedBody.id : null);
    const eventId = String(
      explicitEventId ||
      (rawTimestamp
        ? `${trackingNumber}_${rawStatus}_${rawTimestamp}`
        : `${trackingNumber}_${rawStatus}`)
    );

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
      $or: [{ trackingNumber }, { awbNumber: trackingNumber }, { shipmentNumber: trackingNumber }],
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
      rto: SHIPMENT_STATUSES.RTO_INITIATED,
      rto_initiated: SHIPMENT_STATUSES.RTO_INITIATED,
      rto_in_transit: SHIPMENT_STATUSES.RTO_IN_TRANSIT,
      rto_delivered: SHIPMENT_STATUSES.RTO_DELIVERED,
      returned: SHIPMENT_STATUSES.RETURNED,
      cancelled: SHIPMENT_STATUSES.CANCELLED,
      failed: SHIPMENT_STATUSES.FAILED,
      exception: SHIPMENT_STATUSES.EXCEPTION,
    };

    const targetStatus = statusMap[rawStatus];

    // Handle unknown tracking states without corrupting shipment status
    if (!targetStatus) {
      try {
        await ShipmentWebhookEvent.create({
          provider,
          eventId,
          eventType: rawStatus,
          trackingNumber,
          status: shipment.status,
          payload: parsedBody,
        });
      } catch (evtErr) {
        if (evtErr?.code === 11000) {
          return {
            success: true,
            duplicate: true,
            message: "Webhook event already processed",
            eventId,
          };
        }
        throw evtErr;
      }

      return {
        success: true,
        unmapped: true,
        message: `Unknown courier status '${rawStatus}' recorded without mutating shipment status`,
        shipmentNumber: shipment.shipmentNumber,
        status: shipment.status,
      };
    }

    // If status is identical, record event and return cleanly
    if (shipment.status === targetStatus) {
      try {
        await ShipmentWebhookEvent.create({
          provider,
          eventId,
          eventType: rawStatus,
          trackingNumber,
          status: targetStatus,
          payload: parsedBody,
        });
      } catch (evtErr) {
        if (evtErr?.code === 11000) {
          return {
            success: true,
            duplicate: true,
            message: "Webhook event already processed",
            eventId,
          };
        }
        throw evtErr;
      }

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
      // If the shipment is already in a terminal state or later progress,
      // safely record the out-of-order event and acknowledge without crashing or reverting.
      const isTerminalOrLater = [
        SHIPMENT_STATUSES.DELIVERED,
        SHIPMENT_STATUSES.CANCELLED,
        SHIPMENT_STATUSES.RETURNED,
        SHIPMENT_STATUSES.RTO_DELIVERED,
      ].includes(shipment.status);

      if (isTerminalOrLater) {
        try {
          await ShipmentWebhookEvent.create({
            provider,
            eventId,
            eventType: rawStatus,
            trackingNumber,
            status: shipment.status,
            payload: parsedBody,
          });
        } catch (evtErr) {
          if (evtErr?.code === 11000) {
            return {
              success: true,
              duplicate: true,
              message: "Webhook event already processed",
              eventId,
            };
          }
          throw evtErr;
        }

        return {
          success: true,
          stale: true,
          message: `Stale out-of-order webhook event (${rawStatus}) safely ignored for shipment in status ${shipment.status}`,
          shipmentNumber: shipment.shipmentNumber,
          status: shipment.status,
        };
      }

      throw new AppError(
        `Illegal shipment status transition from '${shipment.status}' to '${targetStatus}'`,
        400,
        "INVALID_SHIPMENT_STATUS_TRANSITION"
      );
    }

    // 7. Atomic Idempotency Event Reservation (F-09)
    try {
      await ShipmentWebhookEvent.create({
        provider,
        eventId,
        eventType: rawStatus,
        trackingNumber,
        status: targetStatus,
        payload: parsedBody,
      });
    } catch (evtErr) {
      if (evtErr?.code === 11000) {
        return {
          success: true,
          duplicate: true,
          message: "Webhook event already processed",
          eventId,
        };
      }
      throw evtErr;
    }

    // 8. Apply Transition
    const previousStatus = shipment.status;
    const shipmentService = require("./shipment.service");
    await shipmentService.transitionShipmentStatus({
      shipmentId: shipment._id,
      nextStatus: targetStatus,
      carrier: shipment.carrier || provider,
      trackingNumber: shipment.trackingNumber || trackingNumber,
      notes: `Courier webhook update from ${provider}: ${rawStatus}`,
      location,
      source: "carrier_webhook",
      rawPayload: parsedBody,
    });

    // 8. Dispatch Customer Email Notification
    const customerEmail = shipment.customerId?.email || shipment.shippingAddress?.email;
    const customerName = shipment.shippingAddress?.fullName || "Customer";

    if (customerEmail) {
      if (targetStatus === SHIPMENT_STATUSES.DELIVERED && !shipment.deliveredAt) {
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
      } else if (targetStatus === SHIPMENT_STATUSES.RTO_INITIATED || targetStatus === SHIPMENT_STATUSES.EXCEPTION || targetStatus === SHIPMENT_STATUSES.FAILED) {
        try {
          const { createCustomerNotification } = require("./customer-notification.service");
          createCustomerNotification({
            customerId: shipment.customerId?._id || shipment.customerId,
            title: "Delivery Exception / Return to Origin Initiated",
            message: `Delivery attempt for package #${shipment.shipmentNumber} could not be completed. The package is returning to origin.`,
            type: "rto",
            link: `/orders/${shipment.orderId}`,
          }).catch(() => {});
        } catch {}
      } else if (targetStatus === SHIPMENT_STATUSES.RTO_DELIVERED) {
        try {
          const { createCustomerNotification } = require("./customer-notification.service");
          createCustomerNotification({
            customerId: shipment.customerId?._id || shipment.customerId,
            title: "Returned Package Received at Origin",
            message: `Package #${shipment.shipmentNumber} has arrived back at our facility and is pending inspection.`,
            type: "rto",
            link: `/orders/${shipment.orderId}`,
          }).catch(() => {});
        } catch {}
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
