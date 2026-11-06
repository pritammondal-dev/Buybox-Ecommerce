/**
 * Fulfillment SLA Constants & Inactivity Triage Engine
 * Centralized, authoritative rules for vendor order fulfillment milestones.
 */

const VENDOR_FULFILLMENT_SLA = Object.freeze({
  ACCEPTANCE_HOURS: Number(process.env.VENDOR_ACCEPTANCE_SLA_HOURS) || 24, // 24h to accept/reject
  CONFIRMATION_HOURS: Number(process.env.VENDOR_CONFIRMATION_SLA_HOURS) || 48, // 48h to confirm fulfillment
  SHIPMENT_CREATION_HOURS: Number(process.env.VENDOR_SHIPMENT_SLA_HOURS) || 72, // 72h to create shipment
  DISPATCH_HOURS: Number(process.env.VENDOR_DISPATCH_SLA_HOURS) || 96, // 96h to dispatch/pickup
});

/**
 * Calculates authoritative fulfillment triage metrics for an order.
 * Strictly uses persisted server timestamps (placedAt, acceptedAt, fulfillmentConfirmedAt, createdAt).
 * Never mutates data, cancels orders, or issues refunds.
 */
function calculateOrderFulfillmentTriage(order, now = new Date()) {
  if (!order) return null;

  // Finished or inactive orders require no operational intervention
  if (["completed", "cancelled", "delivered", "refunded"].includes(order.status)) {
    return {
      triageStatus: "normal",
      stage: order.status,
      isOverdue: false,
      elapsedHours: 0,
      slaThresholdHours: 0,
      hoursOverdue: 0,
      recommendedAction: "No action required: order reached terminal state.",
      responsibleVendors: [],
    };
  }

  const items = order.items || [];
  const vendorFulfillments = order.vendorFulfillments || [];

  // Group items by vendorId
  const vendorMap = new Map();
  for (const it of items) {
    const vId = it.vendorId?._id?.toString() || it.vendorId?.toString();
    if (!vId) continue;
    if (!vendorMap.has(vId)) {
      vendorMap.set(vId, {
        vendorId: vId,
        storeName: it.vendorId?.storeName || it.vendorId?.businessName || "Vendor",
        items: [],
      });
    }
    vendorMap.get(vId).items.push(it);
  }

  const orderPlacedAt = order.placedAt ? new Date(order.placedAt) : new Date(order.createdAt || now);
  const orderElapsedHours = Math.max(0, (now.getTime() - orderPlacedAt.getTime()) / (1000 * 60 * 60));

  let worstStage = "completed";
  let isAnyOverdue = false;
  let maxOverdueHours = 0;
  let hasRejection = false;
  const vendorTriageList = [];

  for (const [vId, vData] of vendorMap.entries()) {
    const vItems = vData.items;
    const vf = vendorFulfillments.find((v) => (v.vendorId?._id?.toString() || v.vendorId?.toString()) === vId);

    const anyRejected = vItems.some((it) => it.vendorAcceptance?.status === "rejected") || vf?.acceptanceStatus === "rejected";
    const allAccepted = vItems.every((it) => it.vendorAcceptance?.status === "accepted") || vf?.acceptanceStatus === "accepted";
    const anyPending = vItems.some((it) => !it.vendorAcceptance || it.vendorAcceptance.status === "pending");

    let stage = "on_schedule";
    let isVendorOverdue = false;
    let threshold = VENDOR_FULFILLMENT_SLA.ACCEPTANCE_HOURS;
    let elapsed = orderElapsedHours;
    let actionDesc = "Normal fulfillment progressing.";

    if (anyRejected) {
      hasRejection = true;
      stage = "rejected_items";
      isVendorOverdue = true;
      threshold = 0;
      actionDesc = "Vendor rejected item(s). Superadmin intervention required to resolve rejection or substitute.";
    } else if (anyPending) {
      stage = "pending_acceptance";
      threshold = VENDOR_FULFILLMENT_SLA.ACCEPTANCE_HOURS;
      elapsed = orderElapsedHours;
      isVendorOverdue = elapsed > threshold;
      actionDesc = isVendorOverdue
        ? `Acceptance SLA breached (${elapsed.toFixed(1)}h > ${threshold}h). Vendor unresponsive. Superadmin override recommended.`
        : `Awaiting vendor acceptance within ${Math.max(0, threshold - elapsed).toFixed(1)}h.`;
    } else if (allAccepted) {
      const allConfirmed = vItems.every((it) => it.isFulfillmentConfirmed) || Boolean(vf?.isFulfillmentConfirmed);
      if (!allConfirmed) {
        stage = "pending_confirmation";
        threshold = VENDOR_FULFILLMENT_SLA.CONFIRMATION_HOURS;
        const acceptedAt = vf?.acceptedAt || vItems[0]?.vendorAcceptance?.acceptedAt;
        const acceptedTime = acceptedAt ? new Date(acceptedAt) : orderPlacedAt;
        elapsed = Math.max(0, (now.getTime() - acceptedTime.getTime()) / (1000 * 60 * 60));
        isVendorOverdue = elapsed > threshold;
        actionDesc = isVendorOverdue
          ? `Confirmation SLA breached (${elapsed.toFixed(1)}h > ${threshold}h). Vendor must assign courier and delivery date.`
          : `Awaiting fulfillment confirmation within ${Math.max(0, threshold - elapsed).toFixed(1)}h.`;
      } else {
        const isShipped =
          order.status === "shipped" ||
          order.fulfillmentStatus === "fulfilled" ||
          vItems.every((it) => it.fulfillmentStatus === "shipped" || it.fulfillmentStatus === "delivered") ||
          (vf?.fulfillmentStatus === "shipped" || vf?.fulfillmentStatus === "delivered");

        const allShipped = isShipped || vItems.every((it) => it.shipmentId) || (vf?.shipments && vf.shipments.length > 0);
        if (!allShipped) {
          stage = "pending_shipment";
          threshold = VENDOR_FULFILLMENT_SLA.SHIPMENT_CREATION_HOURS;
          const confirmedAt = vf?.fulfillmentConfirmedAt || vItems[0]?.fulfillmentConfirmedAt;
          const confirmedTime = confirmedAt ? new Date(confirmedAt) : orderPlacedAt;
          elapsed = Math.max(0, (now.getTime() - confirmedTime.getTime()) / (1000 * 60 * 60));
          isVendorOverdue = elapsed > threshold;
          actionDesc = isVendorOverdue
            ? `Shipment package creation SLA breached (${elapsed.toFixed(1)}h > ${threshold}h). Vendor must generate shipment.`
            : `Awaiting shipment package creation within ${Math.max(0, threshold - elapsed).toFixed(1)}h.`;
        } else if (order.status === "shipped" || isShipped) {
          stage = "shipped";
          threshold = VENDOR_FULFILLMENT_SLA.DISPATCH_HOURS;
          elapsed = orderElapsedHours;
          isVendorOverdue = false;
          actionDesc = "Order has been dispatched and is in transit.";
        } else {
          stage = "shipment_created";
          threshold = VENDOR_FULFILLMENT_SLA.DISPATCH_HOURS;
          elapsed = orderElapsedHours;
          isVendorOverdue = false;
          actionDesc = "Shipment created. Awaiting courier pickup/dispatch.";
        }
      }
    }

    if (isVendorOverdue) {
      isAnyOverdue = true;
      const overdue = Math.max(0, elapsed - threshold);
      if (overdue > maxOverdueHours) {
        maxOverdueHours = overdue;
      }
    }

    vendorTriageList.push({
      vendorId: vId,
      storeName: vData.storeName,
      stage,
      isOverdue: isVendorOverdue,
      elapsedHours: Number(elapsed.toFixed(1)),
      slaThresholdHours: threshold,
      hoursOverdue: isVendorOverdue ? Number((elapsed - threshold).toFixed(1)) : 0,
      action: actionDesc,
    });
  }

  // Determine aggregate triage status
  let triageStatus = "normal";
  if (hasRejection) {
    triageStatus = "intervention_required";
    worstStage = "rejected_items";
  } else if (isAnyOverdue) {
    triageStatus = "sla_breached";
    worstStage = vendorTriageList.find((v) => v.isOverdue)?.stage || "sla_breached";
  } else if (vendorTriageList.some((v) => v.stage === "pending_acceptance")) {
    triageStatus = "pending_action";
    worstStage = "pending_acceptance";
  } else if (vendorTriageList.some((v) => v.stage === "pending_confirmation")) {
    triageStatus = "pending_action";
    worstStage = "pending_confirmation";
  } else if (vendorTriageList.some((v) => v.stage === "pending_shipment")) {
    triageStatus = "pending_action";
    worstStage = "pending_shipment";
  } else if (vendorTriageList.some((v) => v.stage === "shipment_created")) {
    triageStatus = "normal";
    worstStage = "shipment_created";
  } else if (vendorTriageList.some((v) => v.stage === "shipped") || order.status === "shipped") {
    triageStatus = "normal";
    worstStage = "shipped";
  } else {
    triageStatus = "normal";
    worstStage = "on_schedule";
  }

  let activeVendor = vendorTriageList.find((v) => v.stage === worstStage);
  if (!activeVendor && vendorTriageList.length > 0) {
    activeVendor = vendorTriageList[0];
  }

  let aggregateThreshold = VENDOR_FULFILLMENT_SLA.ACCEPTANCE_HOURS;
  if (worstStage === "pending_acceptance") {
    aggregateThreshold = VENDOR_FULFILLMENT_SLA.ACCEPTANCE_HOURS;
  } else if (worstStage === "pending_confirmation") {
    aggregateThreshold = VENDOR_FULFILLMENT_SLA.CONFIRMATION_HOURS;
  } else if (worstStage === "pending_shipment") {
    aggregateThreshold = VENDOR_FULFILLMENT_SLA.SHIPMENT_CREATION_HOURS;
  } else if (worstStage === "shipment_created" || worstStage === "shipped") {
    aggregateThreshold = VENDOR_FULFILLMENT_SLA.DISPATCH_HOURS;
  } else if (activeVendor?.slaThresholdHours) {
    aggregateThreshold = activeVendor.slaThresholdHours;
  }

  const aggregateElapsed = activeVendor ? activeVendor.elapsedHours : Number(orderElapsedHours.toFixed(1));
  const aggregateOverdue = isAnyOverdue ? Number(maxOverdueHours.toFixed(1)) : 0;

  return {
    triageStatus,
    stage: worstStage,
    isOverdue: isAnyOverdue,
    elapsedHours: aggregateElapsed,
    slaThresholdHours: aggregateThreshold,
    hoursOverdue: aggregateOverdue,
    recommendedAction: vendorTriageList.find((v) => v.isOverdue)?.action || (vendorTriageList[0]?.action || "Normal progress"),
    responsibleVendors: vendorTriageList,
  };
}

module.exports = {
  VENDOR_FULFILLMENT_SLA,
  calculateOrderFulfillmentTriage,
};

