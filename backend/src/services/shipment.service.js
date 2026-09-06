const mongoose = require("mongoose");

const shipmentRepository = require("../repositories/shipment.repository");
const orderRepository = require("../repositories/order.repository");
const inventoryRepository = require("../repositories/inventory.repository");

const inventoryService = require("./inventory.service");
const orderService = require("./order.service");

const Customer = require("../models/Customer");
const Vendor = require("../models/Vendor");
const Warehouse = require("../models/Warehouse");

const AppError = require("../errors/AppError");

const {
  canTransitionShipmentStatus,
} = require("../constants/shipping.constants");

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

const generateShipmentNumber = () => {
  const timestamp = Date.now()
    .toString(36)
    .toUpperCase();

  const random = Math.random()
    .toString(36)
    .slice(2, 10)
    .toUpperCase();

  return `SHP-${timestamp}-${random}`;
};

const validateObjectId = (
  value,
  fieldName
) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new AppError(
      `Invalid ${fieldName}`,
      400,
      `INVALID_${fieldName.toUpperCase()}`
    );
  }
};

const validateIdempotencyKey = (
  idempotencyKey
) => {
  if (
    typeof idempotencyKey !== "string" ||
    idempotencyKey.trim().length < 8 ||
    idempotencyKey.trim().length > 128
  ) {
    throw new AppError(
      "A valid Idempotency-Key header is required",
      400,
      "INVALID_IDEMPOTENCY_KEY"
    );
  }

  return idempotencyKey.trim();
};

/*
 * ============================================================
 * VENDOR / WAREHOUSE VALIDATION
 * ============================================================
 */

const validateVendor = async (
  vendorId,
  options = {}
) => {
  validateObjectId(
    vendorId,
    "vendorId"
  );

  const vendor =
    await Vendor.findOne({
      _id: vendorId,
      isActive: true,
      deletedAt: null,
    }).session(
      options.session || null
    );

  if (!vendor) {
    throw new AppError(
      "Vendor not found",
      404,
      "VENDOR_NOT_FOUND"
    );
  }

  return vendor;
};

/*
 * Warehouses are not vendor-owned.
 *
 * Vendor ownership is established through:
 *
 * Order Item
 *   -> vendorId
 *   -> warehouseId
 *
 * Therefore the warehouse only needs to be an active,
 * non-deleted warehouse.
 */
const validateWarehouse = async (
  warehouseId,
  options = {}
) => {
  validateObjectId(
    warehouseId,
    "warehouseId"
  );

  const warehouse =
    await Warehouse.findOne({
      _id: warehouseId,
      isActive: true,
      deletedAt: null,
    }).session(
      options.session || null
    );

  if (!warehouse) {
    throw new AppError(
      "Warehouse not found",
      404,
      "WAREHOUSE_NOT_FOUND"
    );
  }

  return warehouse;
};

/*
 * Resolve authenticated User -> Vendor.
 *
 * This is used only for vendor self-service operations.
 */
const getVendorIdByUserId = async (
  userId
) => {
  validateObjectId(
    userId,
    "userId"
  );

  const vendor =
    await Vendor.findOne({
      userId,
      isActive: true,
      deletedAt: null,
    });

  if (!vendor) {
    throw new AppError(
      "Vendor profile not found",
      404,
      "VENDOR_NOT_FOUND"
    );
  }

  return vendor._id;
};

/*
 * ============================================================
 * ORDER / SHIPMENT ASSIGNMENT
 * ============================================================
 */

const getShipmentAssignment = (
  order
) => {
  if (
    !order.items ||
    order.items.length === 0
  ) {
    throw new AppError(
      "Order has no items to fulfill",
      409,
      "ORDER_HAS_NO_ITEMS"
    );
  }

  const vendorIds = [
    ...new Set(
      order.items.map(
        (item) =>
          item.vendorId?.toString()
      )
    ),
  ];

  const warehouseIds = [
    ...new Set(
      order.items.map(
        (item) =>
          item.warehouseId?.toString()
      )
    ),
  ];

  /*
   * Current shipment implementation creates one shipment
   * when all order items belong to the same vendor and
   * warehouse.
   *
   * Multi-vendor / multi-warehouse orders will later be
   * split into multiple shipments.
   */
  if (
    vendorIds.length !== 1 ||
    warehouseIds.length !== 1
  ) {
    throw new AppError(
      "Order requires multiple shipments",
      409,
      "MULTIPLE_SHIPMENTS_REQUIRED"
    );
  }

  if (
    !vendorIds[0] ||
    !warehouseIds[0]
  ) {
    throw new AppError(
      "Order items must have vendor and warehouse assignments",
      409,
      "ORDER_FULFILLMENT_ASSIGNMENT_MISSING"
    );
  }

  return {
    vendorId: vendorIds[0],
    warehouseId: warehouseIds[0],
  };
};

const buildShipmentItems = ({
  order,
  vendorId,
  warehouseId,
}) => {
  const shipmentItems =
    order.items.filter(
      (item) =>
        item.vendorId.toString() ===
          vendorId.toString() &&
        item.warehouseId.toString() ===
          warehouseId.toString()
    );

  if (
    shipmentItems.length === 0
  ) {
    throw new AppError(
      "Order contains no items for this shipment",
      409,
      "SHIPMENT_ITEMS_NOT_FOUND"
    );
  }

  return shipmentItems.map(
    (item) => ({
      productId:
        item.productId,
      productVariantId:
        item.productVariantId,
      sku:
        item.sku,
      name:
        item.productName,
      quantity:
        item.quantity,
    })
  );
};

/*
 * ============================================================
 * CREATE SHIPMENT
 * ============================================================
 *
 * userId:
 * - supplied for vendor self-service
 * - omitted for admin / manager operations
 */
const createShipment = async ({
  orderId,
  carrier = null,
  serviceLevel = null,
  idempotencyKey,
  userId = null,
}) => {
  validateObjectId(
    orderId,
    "orderId"
  );

  const normalizedIdempotencyKey =
    validateIdempotencyKey(
      idempotencyKey
    );

  /*
   * Resolve vendor identity when this is a vendor operation.
   *
   * Admin / manager operations intentionally skip this.
   */
  let authenticatedVendorId =
    null;

  if (userId) {
    authenticatedVendorId =
      await getVendorIdByUserId(
        userId
      );
  }

  /*
   * Fast idempotency lookup before opening
   * a MongoDB transaction.
   */
  const existingByKey =
    await shipmentRepository
      .findByIdempotencyKey(
        normalizedIdempotencyKey
      );

  if (existingByKey) {
    if (
      existingByKey.orderId.toString() !==
      orderId.toString()
    ) {
      throw new AppError(
        "Idempotency key is already associated with another order",
        409,
        "IDEMPOTENCY_KEY_CONFLICT"
      );
    }

    /*
     * Vendor must not be able to use another vendor's
     * existing idempotent shipment.
     */
    if (
      authenticatedVendorId &&
      existingByKey.vendorId.toString() !==
        authenticatedVendorId.toString()
    ) {
      throw new AppError(
        "Shipment not found",
        404,
        "SHIPMENT_NOT_FOUND"
      );
    }

    return existingByKey;
  }

  const session =
    await mongoose.startSession();

  try {
    session.startTransaction();

    const order =
      await orderRepository.findById(
        orderId,
        { session }
      );

    if (!order) {
      throw new AppError(
        "Order not found",
        404,
        "ORDER_NOT_FOUND"
      );
    }

    if (
      ![
        "confirmed",
        "processing",
      ].includes(order.status)
    ) {
      throw new AppError(
        "Order is not ready for shipment",
        409,
        "ORDER_NOT_READY_FOR_SHIPMENT"
      );
    }

    if (
      order.paymentStatus !== "paid"
    ) {
      throw new AppError(
        "Order payment must be completed before shipment",
        409,
        "ORDER_PAYMENT_NOT_COMPLETED"
      );
    }

    const {
      vendorId,
      warehouseId,
    } = getShipmentAssignment(
      order
    );

    /*
     * Critical vendor isolation check.
     *
     * Vendor 2 must never create a shipment for
     * Vendor 1's order.
     */
    if (
      authenticatedVendorId &&
      vendorId.toString() !==
        authenticatedVendorId.toString()
    ) {
      throw new AppError(
        "You do not have access to this order's shipment",
        404,
        "SHIPMENT_NOT_FOUND"
      );
    }

    await validateVendor(
      vendorId,
      { session }
    );

    /*
     * Warehouse is globally/shared.
     * Do NOT check warehouse.vendorId.
     */
    await validateWarehouse(
      warehouseId,
      { session }
    );

    const existingShipments =
      await shipmentRepository
        .findByOrderId(
          order._id,
          { session }
        );

    const duplicateShipment =
      existingShipments.find(
        (shipment) =>
          shipment.vendorId.toString() ===
            vendorId.toString() &&
          shipment.warehouseId.toString() ===
            warehouseId.toString() &&
          ![
            "cancelled",
            "returned",
          ].includes(
            shipment.status
          )
      );

    if (duplicateShipment) {
      throw new AppError(
        "Shipment already exists for this vendor and warehouse",
        409,
        "SHIPMENT_ALREADY_EXISTS"
      );
    }

    const items =
      buildShipmentItems({
        order,
        vendorId,
        warehouseId,
      });

    const shipment =
      await shipmentRepository.create(
        {
          orderId:
            order._id,

          customerId:
            order.customerId,

          vendorId,

          warehouseId,

          shipmentNumber:
            generateShipmentNumber(),

          idempotencyKey:
            normalizedIdempotencyKey,

          status:
            "created",

          carrier,

          serviceLevel,

          shippingAddress:
            order.shippingAddress,

          items,
        },
        { session }
      );

    await session.commitTransaction();

    return shipment;
  } catch (error) {
    try {
      await session.abortTransaction();
    } catch (abortError) {
      // Preserve original error.
    }

    /*
     * Handle concurrent idempotent requests.
     */
    if (
      error?.code === 11000
    ) {
      const existing =
        await shipmentRepository
          .findByIdempotencyKey(
            normalizedIdempotencyKey
          );

      if (existing) {
        if (
          existing.orderId.toString() !==
          orderId.toString()
        ) {
          throw new AppError(
            "Idempotency key is already associated with another order",
            409,
            "IDEMPOTENCY_KEY_CONFLICT"
          );
        }

        if (
          authenticatedVendorId &&
          existing.vendorId.toString() !==
            authenticatedVendorId.toString()
        ) {
          throw new AppError(
            "Shipment not found",
            404,
            "SHIPMENT_NOT_FOUND"
          );
        }

        return existing;
      }
    }

    throw error;
  } finally {
    await session.endSession();
  }
};

/*
 * ============================================================
 * ORDER SYNCHRONIZATION
 * ============================================================
 */

const synchronizeOrderForShipmentStatus =
  async ({
    order,
    shipmentStatus,
    session,
  }) => {
    if (
      shipmentStatus === "created"
    ) {
      return order;
    }

    if (
      shipmentStatus ===
      "ready_to_ship"
    ) {
      if (
        order.status === "confirmed"
      ) {
        return orderService
          .transitionOrderStatus(
            order._id,
            "processing",
            { session }
          );
      }

      return order;
    }

    if (
      shipmentStatus === "picked_up"
    ) {
      if (
        order.status === "processing"
      ) {
        return orderService
          .transitionOrderStatus(
            order._id,
            "shipped",
            { session }
          );
      }

      if (
        order.status === "shipped"
      ) {
        return order;
      }

      throw new AppError(
        `Order cannot be shipped from status ${order.status}`,
        409,
        "ORDER_CANNOT_BE_SHIPPED"
      );
    }

    if (
      shipmentStatus ===
        "in_transit" ||
      shipmentStatus ===
        "out_for_delivery"
    ) {
      if (
        order.status ===
        "processing"
      ) {
        return orderService
          .transitionOrderStatus(
            order._id,
            "shipped",
            { session }
          );
      }

      return order;
    }

    if (
      shipmentStatus === "delivered"
    ) {
      let currentOrder = order;

      if (
        currentOrder.status ===
        "shipped"
      ) {
        currentOrder =
          await orderService
            .transitionOrderStatus(
              currentOrder._id,
              "delivered",
              { session }
            );
      }

      if (
        currentOrder.status ===
        "delivered"
      ) {
        const updatedOrder =
          await orderRepository
            .updateById(
              currentOrder._id,
              {
                fulfillmentStatus:
                  "fulfilled",
              },
              { session }
            );

        if (!updatedOrder) {
          throw new AppError(
            "Unable to update order fulfillment status",
            500,
            "ORDER_FULFILLMENT_UPDATE_FAILED"
          );
        }

        return updatedOrder;
      }

      return currentOrder;
    }

    if (
      shipmentStatus === "failed"
    ) {
      return order;
    }

    if (
      shipmentStatus === "cancelled"
    ) {
      if (
        [
          "confirmed",
          "processing",
        ].includes(order.status)
      ) {
        const cancelledOrder =
          await orderService
            .transitionOrderStatus(
              order._id,
              "cancelled",
              { session }
            );

        const updatedOrder =
          await orderRepository
            .updateById(
              cancelledOrder._id,
              {
                fulfillmentStatus:
                  "cancelled",
              },
              { session }
            );

        if (!updatedOrder) {
          throw new AppError(
            "Unable to update order fulfillment status",
            500,
            "ORDER_FULFILLMENT_UPDATE_FAILED"
          );
        }

        return updatedOrder;
      }

      if (
        order.status === "cancelled"
      ) {
        return order;
      }

      return order;
    }

    if (
      shipmentStatus === "returned"
    ) {
      return order;
    }

    return order;
  };

/*
 * ============================================================
 * INVENTORY
 * ============================================================
 */

const findShipmentInventory = async ({
  item,
  shipment,
  session,
}) => {
  const inventories =
    await inventoryRepository
      .findByVariant(
        item.productVariantId,
        { session }
      );

  const inventory =
    inventories.find(
      (record) =>
        record.warehouseId.toString() ===
        shipment.warehouseId.toString()
    );

  if (!inventory) {
    throw new AppError(
      "Inventory record not found for shipment item",
      404,
      "SHIPMENT_INVENTORY_NOT_FOUND"
    );
  }

  return inventory;
};

const deductShipmentInventory = async ({
  shipment,
  session,
}) => {
  for (const item of shipment.items) {
    const inventory =
      await findShipmentInventory({
        item,
        shipment,
        session,
      });

    await inventoryService
      .deductReservedStockInTransaction(
        inventory._id,
        item.quantity,
        {
          referenceType:
            "shipment",

          referenceId:
            shipment._id.toString(),

          idempotencyKey:
            `shipment-picked-up-${shipment._id.toString()}-${item.productVariantId.toString()}`,

          notes:
            "Reserved stock deducted when shipment was picked up",
        },
        session
      );
  }
};

const releaseShipmentInventory = async ({
  shipment,
  session,
}) => {
  for (const item of shipment.items) {
    const inventory =
      await findShipmentInventory({
        item,
        shipment,
        session,
      });

    await inventoryService
      .releaseStockInTransaction(
        inventory._id,
        item.quantity,
        {
          referenceType:
            "shipment",

          referenceId:
            shipment._id.toString(),

          idempotencyKey:
            `shipment-cancelled-${shipment._id.toString()}-${item.productVariantId.toString()}`,

          notes:
            "Reserved stock released when shipment was cancelled",
        },
        session
      );
  }
};

/*
 * ============================================================
 * SHIPMENT STATUS TRANSITION
 * ============================================================
 *
 * userId:
 * - supplied for vendor self-service
 * - omitted for admin / manager operations
 */
const transitionShipmentStatus =
  async ({
    shipmentId,
    nextStatus,
    trackingNumber = undefined,
    trackingUrl = undefined,
    failureReason = undefined,
    userId = null,
  }) => {
    validateObjectId(
      shipmentId,
      "shipmentId"
    );

    /*
     * Resolve authenticated vendor before transaction
     * when this is a vendor operation.
     */
    let authenticatedVendorId =
      null;

    if (userId) {
      authenticatedVendorId =
        await getVendorIdByUserId(
          userId
        );
    }

    const session =
      await mongoose.startSession();

    try {
      session.startTransaction();

      const shipment =
        await shipmentRepository
          .findById(
            shipmentId,
            { session }
          );

      if (!shipment) {
        throw new AppError(
          "Shipment not found",
          404,
          "SHIPMENT_NOT_FOUND"
        );
      }

      /*
       * Critical vendor isolation check.
       */
      if (
        authenticatedVendorId &&
        shipment.vendorId.toString() !==
          authenticatedVendorId.toString()
      ) {
        throw new AppError(
          "Shipment not found",
          404,
          "SHIPMENT_NOT_FOUND"
        );
      }

      const order =
        await orderRepository.findById(
          shipment.orderId,
          { session }
        );

      if (!order) {
        throw new AppError(
          "Local order record not found",
          404,
          "ORDER_NOT_FOUND"
        );
      }

      /*
       * Repeated same-status request is idempotent.
       */
      if (
        shipment.status === nextStatus
      ) {
        await synchronizeOrderForShipmentStatus(
          {
            order,
            shipmentStatus:
              nextStatus,
            session,
          }
        );

        await session.commitTransaction();

        return shipment;
      }

      if (
        !canTransitionShipmentStatus(
          shipment.status,
          nextStatus
        )
      ) {
        throw new AppError(
          `Invalid shipment status transition from ${shipment.status} to ${nextStatus}`,
          409,
          "INVALID_SHIPMENT_STATUS_TRANSITION"
        );
      }

      /*
       * Reserved inventory becomes sold inventory
       * when the shipment is picked up.
       */
      if (
        nextStatus === "picked_up"
      ) {
        await deductShipmentInventory({
          shipment,
          session,
        });
      }

      /*
       * Reserved inventory is released when a shipment
       * is cancelled before pickup.
       */
      if (
        nextStatus === "cancelled" &&
        [
          "created",
          "ready_to_ship",
        ].includes(
          shipment.status
        )
      ) {
        await releaseShipmentInventory({
          shipment,
          session,
        });
      }

      const update = {
        status: nextStatus,
      };

      if (
        trackingNumber !==
        undefined
      ) {
        update.trackingNumber =
          trackingNumber;
      }

      if (
        trackingUrl !==
        undefined
      ) {
        update.trackingUrl =
          trackingUrl;
      }

      if (
        failureReason !==
        undefined
      ) {
        update.failureReason =
          failureReason;
      }

      if (
        nextStatus === "picked_up" ||
        nextStatus === "in_transit"
      ) {
        update.shippedAt =
          shipment.shippedAt ||
          new Date();
      }

      if (
        nextStatus === "delivered"
      ) {
        update.deliveredAt =
          new Date();
      }

      if (
        nextStatus === "cancelled"
      ) {
        update.cancelledAt =
          new Date();
      }

      if (
        nextStatus === "returned"
      ) {
        update.returnedAt =
          new Date();
      }

      const updatedShipment =
        await shipmentRepository
          .updateById(
            shipment._id,
            update,
            { session }
          );

      if (!updatedShipment) {
        throw new AppError(
          "Unable to update shipment",
          500,
          "SHIPMENT_UPDATE_FAILED"
        );
      }

      await synchronizeOrderForShipmentStatus(
        {
          order,
          shipmentStatus:
            nextStatus,
          session,
        }
      );

      await session.commitTransaction();

      return updatedShipment;
    } catch (error) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        // Preserve original error.
      }

      throw error;
    } finally {
      await session.endSession();
    }
  };

/*
 * ============================================================
 * GENERAL RETRIEVAL
 * ============================================================
 */

const getShipmentById = async (
  shipmentId
) => {
  validateObjectId(
    shipmentId,
    "shipmentId"
  );

  const shipment =
    await shipmentRepository.findById(
      shipmentId
    );

  if (!shipment) {
    throw new AppError(
      "Shipment not found",
      404,
      "SHIPMENT_NOT_FOUND"
    );
  }

  return shipment;
};

const getShipmentsByOrderId = async (
  orderId
) => {
  validateObjectId(
    orderId,
    "orderId"
  );

  return shipmentRepository
    .findByOrderId(orderId);
};

const getShipmentsByVendorId =
  async (vendorId) => {
    validateObjectId(
      vendorId,
      "vendorId"
    );

    return shipmentRepository
      .findByVendorId(vendorId);
  };

const getShipmentsByWarehouseId =
  async (warehouseId) => {
    validateObjectId(
      warehouseId,
      "warehouseId"
    );

    return shipmentRepository
      .findByWarehouseId(
        warehouseId
      );
  };

const getShipmentByTrackingNumber =
  async (trackingNumber) => {
    if (
      typeof trackingNumber !==
        "string" ||
      !trackingNumber.trim()
    ) {
      throw new AppError(
        "Tracking number is required",
        400,
        "INVALID_TRACKING_NUMBER"
      );
    }

    const shipment =
      await shipmentRepository
        .findByTrackingNumber(
          trackingNumber.trim()
        );

    if (!shipment) {
      throw new AppError(
        "Shipment not found",
        404,
        "SHIPMENT_NOT_FOUND"
      );
    }

    return shipment;
  };

/*
 * ============================================================
 * CUSTOMER SELF-SERVICE
 * ============================================================
 */

const getCustomerIdByUserId =
  async (userId) => {
    validateObjectId(
      userId,
      "userId"
    );

    const customer =
      await Customer.findOne({
        userId,
        isActive: true,
        deletedAt: null,
      });

    if (!customer) {
      throw new AppError(
        "Customer profile not found",
        404,
        "CUSTOMER_NOT_FOUND"
      );
    }

    return customer._id;
  };

const getCustomerShipmentById =
  async (
    shipmentId,
    userId
  ) => {
    validateObjectId(
      shipmentId,
      "shipmentId"
    );

    const customerId =
      await getCustomerIdByUserId(
        userId
      );

    const shipment =
      await shipmentRepository
        .findById(shipmentId);

    if (!shipment) {
      throw new AppError(
        "Shipment not found",
        404,
        "SHIPMENT_NOT_FOUND"
      );
    }

    if (
      shipment.customerId.toString() !==
      customerId.toString()
    ) {
      throw new AppError(
        "Shipment not found",
        404,
        "SHIPMENT_NOT_FOUND"
      );
    }

    return shipment;
  };

const getCustomerShipments =
  async (userId) => {
    const customerId =
      await getCustomerIdByUserId(
        userId
      );

    return shipmentRepository
      .findByCustomerId(
        customerId
      );
  };

/*
 * ============================================================
 * VENDOR SELF-SERVICE
 * ============================================================
 */

const getVendorShipmentById =
  async (
    shipmentId,
    userId
  ) => {
    validateObjectId(
      shipmentId,
      "shipmentId"
    );

    const vendorId =
      await getVendorIdByUserId(
        userId
      );

    const shipment =
      await shipmentRepository
        .findById(shipmentId);

    if (!shipment) {
      throw new AppError(
        "Shipment not found",
        404,
        "SHIPMENT_NOT_FOUND"
      );
    }

    if (
      shipment.vendorId.toString() !==
      vendorId.toString()
    ) {
      throw new AppError(
        "Shipment not found",
        404,
        "SHIPMENT_NOT_FOUND"
      );
    }

    return shipment;
  };

const getMyVendorShipments =
  async (userId) => {
    const vendorId =
      await getVendorIdByUserId(
        userId
      );

    return shipmentRepository
      .findByVendorId(
        vendorId
      );
  };

/*
 * ============================================================
 * EXPORTS
 * ============================================================
 */

module.exports = {
  createShipment,
  transitionShipmentStatus,

  getShipmentById,
  getCustomerShipmentById,
  getCustomerShipments,

  getShipmentsByOrderId,
  getShipmentsByVendorId,
  getShipmentsByWarehouseId,
  getShipmentByTrackingNumber,

  getMyShipments:
    getCustomerShipments,

  getMyShipmentById:
    getCustomerShipmentById,

  getVendorShipmentById,
  getMyVendorShipments,

  generateShipmentNumber,
};

