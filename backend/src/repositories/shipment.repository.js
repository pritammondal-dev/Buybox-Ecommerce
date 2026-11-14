const mongoose = require("mongoose");
const Shipment = require("../models/Shipment");

const create = async (data, options = {}) => {
  const documents = await Shipment.create([data], {
    session: options.session,
  });

  return documents[0];
};

const findById = async (id, options = {}) => {
  return Shipment.findById(id).session(
    options.session || null
  );
};

const findByShipmentNumber = async (
  shipmentNumber,
  options = {}
) => {
  return Shipment.findOne({
    shipmentNumber,
  }).session(options.session || null);
};

const findByIdempotencyKey = async (
  idempotencyKey,
  options = {}
) => {
  return Shipment.findOne({
    idempotencyKey,
  }).session(options.session || null);
};

const findByOrderId = async (
  orderId,
  options = {}
) => {
  return Shipment.find({
    orderId,
  })
    .session(options.session || null)
    .sort({ createdAt: 1 });
};

const findByCustomerId = async (
  customerId,
  options = {}
) => {
  return Shipment.find({
    customerId,
  })
    .session(options.session || null)
    .sort({ createdAt: -1 });
};

const findByTrackingNumber = async (
  trackingNumber,
  options = {}
) => {
  return Shipment.findOne({
    trackingNumber,
  }).session(options.session || null);
};

const findByVendorId = async (
  vendorId,
  options = {}
) => {
  return Shipment.find({
    vendorId,
  })
    .session(options.session || null)
    .sort({ createdAt: -1 });
};

const findByWarehouseId = async (
  warehouseId,
  options = {}
) => {
  return Shipment.find({
    warehouseId,
  })
    .session(options.session || null)
    .sort({ createdAt: -1 });
};

const updateById = async (
  id,
  data,
  options = {}
) => {
  return Shipment.findByIdAndUpdate(
    id,
    data,
    {
      new: true,
      runValidators: true,
      session: options.session,
    }
  );
};

const claimReservationRelease = async (shipmentId, options = {}) => {
  return Shipment.findOneAndUpdate(
    {
      _id: shipmentId,
      inventoryStatus: "reserved",
      status: { $in: ["created", "ready_to_ship"] },
    },
    {
      $set: {
        inventoryStatus: "released",
        inventoryReleasedAt: new Date(),
      },
    },
    {
      new: true,
      runValidators: true,
      session: options.session,
    }
  );
};

const transitionStatusAtomic = async ({
  shipmentId,
  expectedStatus,
  expectedVersion,
  updateData = {},
  session = null,
} = {}) => {
  const query = { _id: shipmentId };

  if (expectedStatus !== undefined && expectedStatus !== null) {
    if (Array.isArray(expectedStatus)) {
      query.status = { $in: expectedStatus };
    } else {
      query.status = expectedStatus;
    }
  }

  if (typeof expectedVersion === "number") {
    query.version = expectedVersion;
  }

  const setOps = { ...updateData };
  const pushOps = setOps.$push;
  const incOps = setOps.$inc || {};
  delete setOps.$push;
  delete setOps.$inc;

  const updateOp = {
    $set: setOps,
    $inc: {
      ...incOps,
      version: 1,
    },
  };

  if (pushOps) {
    updateOp.$push = pushOps;
  }

  return Shipment.findOneAndUpdate(
    query,
    updateOp,
    {
      new: true,
      runValidators: true,
      session,
    }
  );
};

const claimRtoInspection = async (shipmentId, options = {}) => {
  const query = {
    _id: shipmentId,
    $or: [
      { "rtoInspection.inspectedAt": null },
      { rtoInspection: { $exists: false } },
    ],
  };

  if (options.allowedStatuses && options.allowedStatuses.length > 0) {
    query.status = { $in: options.allowedStatuses };
  }

  return Shipment.findOneAndUpdate(
    query,
    {
      $set: {
        "rtoInspection.inspectedAt": new Date(),
        "rtoInspection.inspectedBy": options.inspectedBy || null,
      },
    },
    {
      new: true,
      runValidators: true,
      session: options.session,
    }
  );
};

const claimShipmentCancellation = async (shipmentId, options = {}) => {
  const query = {
    _id: shipmentId,
    status: {
      $in: [
        "created",
        "booking_pending",
        "booked",
        "awb_assigned",
        "label_available",
        "pickup_scheduled",
        "ready_to_ship",
      ],
    },
    dispatchBlocked: { $ne: true },
  };

  const update = {
    $set: {
      status: "cancellation_pending",
      dispatchBlocked: true,
      "cancellationClaim.claimedAt": new Date(),
      "cancellationClaim.claimedBy": options.userId || null,
      "cancellationClaim.operationId": options.operationId || null,
    },
  };

  return Shipment.findOneAndUpdate(query, update, {
    new: true,
    runValidators: true,
    session: options.session,
  });
};

const releaseShipmentCancellationClaim = async (shipmentId, options = {}) => {
  const query = {
    _id: shipmentId,
    status: "cancellation_pending",
    dispatchBlocked: true,
  };

  const update = {
    $set: {
      status: options.previousStatus || "ready_to_ship",
      dispatchBlocked: false,
      "cancellationClaim.claimedAt": null,
      "cancellationClaim.claimedBy": null,
      "cancellationClaim.operationId": null,
    },
  };

  return Shipment.findOneAndUpdate(query, update, {
    new: true,
    runValidators: true,
    session: options.session,
  });
};

const claimOrderShipmentsCancellation = async (orderId, options = {}) => {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return { claimed: true, shipments: [], dispatchedShipments: [] };
  }

  const shipments = await Shipment.find({
    orderId,
    status: { $nin: ["cancelled", "returned", "rto_delivered"] },
  }).session(options.session || null);

  if (!shipments || shipments.length === 0) {
    return { claimed: true, shipments: [], dispatchedShipments: [] };
  }

  const targetItemIds = options.targetItemIds;
  const targetShipments = targetItemIds && targetItemIds.length > 0
    ? shipments.filter((s) =>
        (s.items || []).some(
          (si) =>
            targetItemIds.includes(si.orderItemId?.toString()) ||
            targetItemIds.includes(si.productVariantId?.toString())
        )
      )
    : shipments;

  const dispatchedShipments = targetShipments.filter((s) =>
    ["picked_up", "in_transit", "out_for_delivery", "delivered"].includes(s.status)
  );

  if (dispatchedShipments.length > 0) {
    return { claimed: false, shipments: targetShipments, dispatchedShipments };
  }

  const claimedShipments = [];
  for (const s of targetShipments) {
    const claimed = await claimShipmentCancellation(s._id, options);
    if (!claimed) {
      for (const prev of claimedShipments) {
        await releaseShipmentCancellationClaim(prev._id, { previousStatus: prev.status });
      }
      return { claimed: false, shipments: targetShipments, dispatchedShipments: [s] };
    }
    claimedShipments.push(claimed);
  }

  return { claimed: true, shipments: claimedShipments, dispatchedShipments: [] };
};

module.exports = {
  create,
  findById,
  findByShipmentNumber,
  findByIdempotencyKey,
  findByOrderId,
  findByCustomerId,
  findByTrackingNumber,
  findByVendorId,
  findByWarehouseId,
  updateById,
  claimReservationRelease,
  claimRtoInspection,
  claimShipmentCancellation,
  releaseShipmentCancellationClaim,
  claimOrderShipmentsCancellation,
  transitionStatusAtomic,
};

