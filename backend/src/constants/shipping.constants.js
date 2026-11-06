const SHIPMENT_STATUSES = Object.freeze({
  CREATED: "created",
  BOOKING_PENDING: "booking_pending",
  BOOKED: "booked",
  AWB_ASSIGNED: "awb_assigned",
  LABEL_AVAILABLE: "label_available",
  PICKUP_SCHEDULED: "pickup_scheduled",
  READY_TO_SHIP: "ready_to_ship",
  PICKED_UP: "picked_up",
  IN_TRANSIT: "in_transit",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
  FAILED: "failed",
  EXCEPTION: "exception",
  RTO_INITIATED: "rto_initiated",
  RTO_IN_TRANSIT: "rto_in_transit",
  RTO_DELIVERED: "rto_delivered",
  CANCELLED: "cancelled",
  CANCELLATION_PENDING: "cancellation_pending",
  BOOKING_FAILED: "booking_failed",
  RETURNED: "returned",
});

const SHIPMENT_STATUS_TRANSITIONS = Object.freeze({
  created: [
    "booking_pending",
    "booked",
    "awb_assigned",
    "label_available",
    "pickup_scheduled",
    "ready_to_ship",
    "picked_up",
    "cancelled",
    "booking_failed",
  ],
  booking_pending: [
    "booked",
    "awb_assigned",
    "booking_failed",
    "cancelled",
  ],
  booked: [
    "awb_assigned",
    "label_available",
    "pickup_scheduled",
    "ready_to_ship",
    "picked_up",
    "cancelled",
    "booking_failed",
  ],
  booking_failed: ["booking_pending", "created", "booked", "cancelled"],
  awb_assigned: [
    "label_available",
    "pickup_scheduled",
    "ready_to_ship",
    "picked_up",
    "cancelled",
  ],
  label_available: [
    "pickup_scheduled",
    "ready_to_ship",
    "picked_up",
    "cancelled",
  ],
  pickup_scheduled: [
    "ready_to_ship",
    "picked_up",
    "cancelled",
  ],
  ready_to_ship: [
    "pickup_scheduled",
    "picked_up",
    "cancelled",
  ],
  picked_up: [
    "in_transit",
    "failed",
    "exception",
    "cancelled",
  ],
  in_transit: [
    "out_for_delivery",
    "delivered",
    "failed",
    "exception",
    "rto_initiated",
  ],
  out_for_delivery: [
    "delivered",
    "failed",
    "exception",
    "rto_initiated",
  ],
  failed: [
    "ready_to_ship",
    "picked_up",
    "in_transit",
    "out_for_delivery",
    "exception",
    "rto_initiated",
    "cancelled",
  ],
  exception: [
    "in_transit",
    "out_for_delivery",
    "delivered",
    "failed",
    "rto_initiated",
    "cancelled",
  ],
  rto_initiated: [
    "rto_in_transit",
    "rto_delivered",
    "returned",
  ],
  rto_in_transit: [
    "rto_delivered",
    "returned",
  ],
  rto_delivered: [],
  cancellation_pending: [
    "cancelled",
    "in_transit",
    "picked_up",
  ],
  delivered: [
    "returned",
    "rto_initiated",
  ],
  cancelled: [],
  returned: [],
});

const canTransitionShipmentStatus = (
  currentStatus,
  nextStatus
) => {
  const allowedTransitions =
    SHIPMENT_STATUS_TRANSITIONS[currentStatus] || [];

  return allowedTransitions.includes(nextStatus);
};

const VENDOR_ACCEPTANCE_STATUSES = Object.freeze({
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  PARTIALLY_ACCEPTED: "partially_accepted",
});

const SUPPORTED_SHIPMENT_PARTNERS = Object.freeze([
  {
    id: "delhivery",
    name: "Delhivery Logistics",
    code: "DELHIVERY",
    isActive: true,
    serviceCodes: ["standard", "express", "surface"],
    trackingUrlTemplate: "https://www.delhivery.com/track/package/{trackingNumber}",
  },
  {
    id: "shiprocket",
    name: "Shiprocket Fulfillment",
    code: "SHIPROCKET",
    isActive: true,
    serviceCodes: ["standard", "priority", "air"],
    trackingUrlTemplate: "https://shiprocket.co/tracking/{trackingNumber}",
  },
  {
    id: "bluedart",
    name: "Blue Dart Express",
    code: "BLUEDART",
    isActive: true,
    serviceCodes: ["standard", "dart_apex", "dart_surface"],
    trackingUrlTemplate: "https://www.bluedart.com/tracking/{trackingNumber}",
  },
  {
    id: "dtdc",
    name: "DTDC Express",
    code: "DTDC",
    isActive: true,
    serviceCodes: ["standard", "express", "plus"],
    trackingUrlTemplate: "https://www.dtdc.in/tracking/{trackingNumber}",
  },
  {
    id: "indiapost",
    name: "India Post Speed Post",
    code: "INDIAPOST",
    isActive: true,
    serviceCodes: ["speed_post", "business_parcel"],
    trackingUrlTemplate: "https://www.indiapost.gov.in/_layouts/15/dpt.cpt.ui/pinsearch.aspx",
  },
  {
    id: "custom",
    name: "Self / Merchant Fleet",
    code: "CUSTOM",
    isActive: true,
    serviceCodes: ["standard", "hyperlocal"],
    trackingUrlTemplate: "",
  },
]);

const isValidShipmentPartner = (partnerId) => {
  if (!partnerId || typeof partnerId !== "string") return false;
  const normalized = partnerId.trim().toLowerCase();
  return SUPPORTED_SHIPMENT_PARTNERS.some((p) => p.id === normalized || p.code.toLowerCase() === normalized);
};

const getShipmentPartnerById = (partnerId) => {
  if (!partnerId || typeof partnerId !== "string") return null;
  const normalized = partnerId.trim().toLowerCase();
  return (
    SUPPORTED_SHIPMENT_PARTNERS.find(
      (p) => p.id === normalized || p.code.toLowerCase() === normalized
    ) || null
  );
};

module.exports = {
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_TRANSITIONS,
  canTransitionShipmentStatus,
  VENDOR_ACCEPTANCE_STATUSES,
  SUPPORTED_SHIPMENT_PARTNERS,
  isValidShipmentPartner,
  getShipmentPartnerById,
};
