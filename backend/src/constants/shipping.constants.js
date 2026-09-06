const SHIPMENT_STATUSES = Object.freeze({
  CREATED: "created",
  READY_TO_SHIP: "ready_to_ship",
  PICKED_UP: "picked_up",
  IN_TRANSIT: "in_transit",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
  FAILED: "failed",
  CANCELLED: "cancelled",
  RETURNED: "returned",
});

const SHIPMENT_STATUS_TRANSITIONS = Object.freeze({
  created: ["ready_to_ship", "cancelled"],
  ready_to_ship: ["picked_up", "cancelled"],
  picked_up: ["in_transit", "failed"],
  in_transit: ["out_for_delivery", "delivered", "failed"],
  out_for_delivery: ["delivered", "failed"],
  delivered: ["returned"],
  failed: ["ready_to_ship", "cancelled"],
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

module.exports = {
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_TRANSITIONS,
  canTransitionShipmentStatus,
};