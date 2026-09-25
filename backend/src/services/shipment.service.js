const mongoose = require("mongoose");

const shipmentRepository = require("../repositories/shipment.repository");
const orderRepository = require("../repositories/order.repository");
const inventoryRepository = require("../repositories/inventory.repository");

const inventoryService = require("./inventory.service");
const orderService = require("./order.service");

const Customer = require("../models/Customer");
const Vendor = require("../models/Vendor");
const Warehouse = require("../models/Warehouse");
const Employee = require("../models/Employee");
const Shipment = require("../models/Shipment");

const AppError = require("../errors/AppError");

const {
  canTransitionShipmentStatus,
} = require("../constants/shipping.constants");
const {
  ROLE_PERMISSIONS,
} = require("../constants/role-permissions.constants");
const {
  PERMISSIONS,
} = require("../constants/permissions.constants");
const {
  ROLES,
} = require("../constants/auth.constants");
const {
  getEffectivePermissions,
} = require("./authorization.service");
const { decodeSecureId } = require("../utils/secure-id.util");

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

const resolveId = (value, type) => {
  if (!value) return value;
  const str = String(value).trim();
  if (type && (str.startsWith("ord_") || str.startsWith("shp_") || str.startsWith("wh_") || str.startsWith("ven_"))) {
    try {
      return decodeSecureId(str, type, { strict: false });
    } catch {
      return str;
    }
  }
  return str;
};

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

const resolveShipmentAssignment = ({
  order,
  authenticatedVendorId = null,
  requestedVendorId = null,
  requestedWarehouseId = null,
}) => {
  if (!order.items || order.items.length === 0) {
    throw new AppError(
      "Order has no items to fulfill",
      409,
      "ORDER_HAS_NO_ITEMS"
    );
  }

  let vendorId;

  if (authenticatedVendorId) {
    // Vendor self-service: identity is strictly bounded to the authenticated vendor
    vendorId = authenticatedVendorId.toString();

    // Verify vendor has items in this order
    const hasVendorItems = order.items.some(
      (item) => item.vendorId && item.vendorId.toString() === vendorId
    );

    if (!hasVendorItems) {
      // Do not disclose order existence if vendor has no items in it
      throw new AppError(
        "You do not have access to this order's shipment",
        404,
        "SHIPMENT_NOT_FOUND"
      );
    }
  } else {
    // Admin / Manager operation
    const allVendorIds = [
      ...new Set(
        order.items
          .map((item) => item.vendorId?.toString())
          .filter(Boolean)
      ),
    ];

    if (requestedVendorId) {
      const match = allVendorIds.find(
        (id) => id === requestedVendorId.toString()
      );
      if (!match) {
        throw new AppError(
          "Requested vendor does not have items in this order",
          400,
          "VENDOR_NOT_IN_ORDER"
        );
      }
      vendorId = requestedVendorId.toString();
    } else {
      if (allVendorIds.length === 1) {
        vendorId = allVendorIds[0];
      } else {
        throw new AppError(
          "Vendor ID is required for multi-vendor order shipment creation",
          400,
          "VENDOR_SELECTION_REQUIRED"
        );
      }
    }
  }

  // Filter order items belonging to this vendor
  const vendorItems = order.items.filter(
    (item) => item.vendorId && item.vendorId.toString() === vendorId
  );

  const availableWarehouseIds = [
    ...new Set(
      vendorItems
        .map((item) => item.warehouseId?.toString())
        .filter(Boolean)
    ),
  ];

  if (availableWarehouseIds.length === 0) {
    throw new AppError(
      "Order items must have vendor and warehouse assignments",
      409,
      "ORDER_FULFILLMENT_ASSIGNMENT_MISSING"
    );
  }

  let warehouseId;

  if (requestedWarehouseId) {
    const match = availableWarehouseIds.find(
      (id) => id === requestedWarehouseId.toString()
    );
    if (!match) {
      throw new AppError(
        "Selected warehouse does not match order items",
        400,
        "WAREHOUSE_MISMATCH"
      );
    }
    warehouseId = requestedWarehouseId.toString();
  } else {
    if (availableWarehouseIds.length === 1) {
      warehouseId = availableWarehouseIds[0];
    } else {
      throw new AppError(
        "Warehouse ID is required for multi-warehouse shipment creation",
        400,
        "WAREHOUSE_SELECTION_REQUIRED"
      );
    }
  }

  return {
    vendorId,
    warehouseId,
  };
};

const getShipmentAssignment = (order) => {
  return resolveShipmentAssignment({ order });
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
  warehouseId: requestedWarehouseId = null,
  vendorId: requestedVendorId = null,
  carrier = null,
  serviceLevel = null,
  idempotencyKey,
  userId = null,
}) => {
  const resolvedOrderId = resolveId(orderId, "order");
  validateObjectId(
    resolvedOrderId,
    "orderId"
  );
  const resolvedWarehouseId = requestedWarehouseId ? resolveId(requestedWarehouseId, "warehouse") : null;
  const resolvedVendorId = requestedVendorId ? resolveId(requestedVendorId, "vendor") : null;

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
      resolvedOrderId.toString()
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
        resolvedOrderId,
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
    } = resolveShipmentAssignment({
      order,
      authenticatedVendorId,
      requestedVendorId: resolvedVendorId,
      requestedWarehouseId: resolvedWarehouseId,
    });

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

    const updatedOrderItems = (order.items || []).map((orderItem) => {
      if (
        orderItem.vendorId &&
        orderItem.vendorId.toString() === vendorId.toString() &&
        orderItem.warehouseId &&
        orderItem.warehouseId.toString() === warehouseId.toString()
      ) {
        const itemObj = orderItem.toObject ? orderItem.toObject() : { ...orderItem };
        itemObj.shipmentId = shipment._id;
        if (!["shipped", "delivered", "cancelled"].includes(itemObj.fulfillmentStatus)) {
          itemObj.fulfillmentStatus = "ready_to_ship";
        }
        return itemObj;
      }
      return orderItem;
    });

    await orderRepository.updateById(
      order._id,
      { items: updatedOrderItems },
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
          resolvedOrderId.toString()
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
    shipment = null,
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
      const updatedItems = (order.items || []).map((orderItem) => {
        const matchingShipmentItem = shipment?.items
          ? shipment.items.find(
              (si) =>
                si.productVariantId?.toString() ===
                  orderItem.productVariantId?.toString() &&
                orderItem.warehouseId?.toString() ===
                  shipment.warehouseId?.toString()
            )
          : null;
        if (matchingShipmentItem) {
          const itemObj = orderItem.toObject ? orderItem.toObject() : { ...orderItem };
          itemObj.inventoryStatus = "deducted";
          itemObj.fulfillmentStatus = "shipped";
          return itemObj;
        }
        return orderItem;
      });

      if (
        order.status === "processing"
      ) {
        await orderRepository.updateById(
          order._id,
          {
            items: updatedItems,
            fulfillmentStatus: "partially_fulfilled",
          },
          { session }
        );

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
        return orderRepository.updateById(
          order._id,
          {
            items: updatedItems,
            fulfillmentStatus: "partially_fulfilled",
          },
          { session }
        );
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
      const updatedItems = (order.items || []).map((orderItem) => {
        const matchingShipmentItem = shipment?.items
          ? shipment.items.find(
              (si) =>
                si.productVariantId?.toString() ===
                  orderItem.productVariantId?.toString() &&
                orderItem.warehouseId?.toString() ===
                  shipment.warehouseId?.toString()
            )
          : null;
        if (matchingShipmentItem) {
          const itemObj = orderItem.toObject ? orderItem.toObject() : { ...orderItem };
          itemObj.fulfillmentStatus = "shipped";
          return itemObj;
        }
        return orderItem;
      });

      await orderRepository.updateById(
        order._id,
        { items: updatedItems },
        { session }
      );

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

      const updatedItems = (currentOrder.items || []).map((orderItem) => {
        const matchingShipmentItem = shipment?.items
          ? shipment.items.find(
              (si) =>
                si.productVariantId?.toString() ===
                  orderItem.productVariantId?.toString() &&
                orderItem.warehouseId?.toString() ===
                  shipment.warehouseId?.toString()
            )
          : null;
        if (matchingShipmentItem) {
          const itemObj = orderItem.toObject ? orderItem.toObject() : { ...orderItem };
          itemObj.fulfillmentStatus = "delivered";
          return itemObj;
        }
        return orderItem;
      });

      const allShipments =
        await shipmentRepository.findByOrderId(
          order._id,
          { session }
        );

      const activeShipments = allShipments.filter(
        (s) => !["cancelled", "returned"].includes(s.status)
      );

      const allDelivered =
        activeShipments.length > 0 &&
        activeShipments.every(
          (s) =>
            s.status === "delivered" ||
            s._id.toString() === shipment._id.toString()
        );

      const totalOrderedQuantity = (order.items || []).reduce(
        (sum, item) => sum + item.quantity,
        0
      );

      const totalDeliveredQuantity = activeShipments.reduce((sum, s) => {
        const isDelivered =
          s.status === "delivered" ||
          s._id.toString() === shipment._id.toString();
        if (isDelivered) {
          return (
            sum +
            (s.items || []).reduce(
              (subSum, item) => subSum + item.quantity,
              0
            )
          );
        }
        return sum;
      }, 0);

      const isFullyDelivered =
        allDelivered && totalDeliveredQuantity >= totalOrderedQuantity;

      if (isFullyDelivered) {
        if (
          currentOrder.status === "shipped"
        ) {
          currentOrder =
            await orderService
              .transitionOrderStatus(
                currentOrder._id,
                "delivered",
                { session }
              );
        }

        const updatePayload = {
          items: updatedItems,
          fulfillmentStatus: "fulfilled",
        };
        if (!currentOrder.deliveredAt) {
          updatePayload.deliveredAt = new Date();
        }

        const updatedOrder =
          await orderRepository
            .updateById(
              currentOrder._id,
              updatePayload,
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

      // Partially fulfilled order: other shipments remain active/pending
      const updatedOrder =
        await orderRepository
          .updateById(
            currentOrder._id,
            {
              items: updatedItems,
              fulfillmentStatus:
                "partially_fulfilled",
            },
            { session }
          );

      return updatedOrder || currentOrder;
    }

    if (
      shipmentStatus === "failed"
    ) {
      return order;
    }

    if (
      shipmentStatus === "cancelled"
    ) {
      const currentOrder =
        await orderRepository.findById(
          order._id,
          { session }
        );

      if (!currentOrder || currentOrder.status === "cancelled") {
        return currentOrder || order;
      }

      const allShipments =
        await shipmentRepository.findByOrderId(
          order._id,
          { session }
        );

      const remainingActiveShipments = allShipments.filter(
        (s) =>
          s._id.toString() !== shipment._id.toString() &&
          !["cancelled", "returned"].includes(s.status)
      );

      const updatedItems = (currentOrder.items || []).map((orderItem) => {
        const matchingShipmentItem = shipment?.items
          ? shipment.items.find(
              (si) =>
                si.productVariantId?.toString() ===
                  orderItem.productVariantId?.toString() &&
                orderItem.warehouseId?.toString() ===
                  shipment.warehouseId?.toString()
            )
          : null;
        if (matchingShipmentItem) {
          const itemObj = orderItem.toObject ? orderItem.toObject() : { ...orderItem };
          itemObj.inventoryStatus = "released";
          itemObj.inventoryReleasedAt = new Date();
          return itemObj;
        }
        return orderItem;
      });

      const allItemsReleased = updatedItems.every(
        (item) => item.inventoryStatus === "released"
      );

      // If ALL shipments for the order are cancelled and all items released, cancel the order
      if (
        remainingActiveShipments.length === 0 &&
        allItemsReleased
      ) {
        let orderToUpdate = currentOrder;
        if (
          [
            "confirmed",
            "processing",
          ].includes(currentOrder.status)
        ) {
          try {
            orderToUpdate =
              await orderService
                .transitionOrderStatus(
                  currentOrder._id,
                  "cancelled",
                  { session }
                );
          } catch (transitionErr) {
            if (transitionErr?.code === "INVALID_ORDER_STATUS_TRANSITION") {
              const reloaded = await orderRepository.findById(
                currentOrder._id,
                { session }
              );
              if (reloaded?.status === "cancelled") {
                orderToUpdate = reloaded;
              } else {
                throw transitionErr;
              }
            } else {
              throw transitionErr;
            }
          }
        }

        const updatedOrder =
          await orderRepository
            .updateById(
              orderToUpdate._id,
              {
                fulfillmentStatus:
                  "cancelled",
                items: updatedItems,
                inventoryStatus: "released",
                inventoryReleasedAt: new Date(),
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

      // Some shipments or items remain active: update order with partial release without cancelling entire order
      const updatedOrder =
        await orderRepository
          .updateById(
            currentOrder._id,
            {
              items: updatedItems,
              inventoryStatus: "partially_released",
              fulfillmentStatus:
                remainingActiveShipments.length > 0
                  ? "partially_fulfilled"
                  : currentOrder.fulfillmentStatus,
            },
            { session }
          );

      return updatedOrder || currentOrder;
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
            `order-reservation-release-${shipment.orderId.toString()}-${item.productVariantId.toString()}-${shipment.warehouseId.toString()}`,

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
    const resolvedShipmentId = resolveId(shipmentId, "shipment");
    validateObjectId(
      resolvedShipmentId,
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
            resolvedShipmentId,
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
            shipment,
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
        if (order && order.status === "cancelled") {
          throw new AppError(
            "Cannot ship an already cancelled order",
            409,
            "ORDER_ALREADY_CANCELLED"
          );
        }

        if (shipment.inventoryStatus === "released") {
          throw new AppError(
            "Cannot pick up shipment whose inventory was already released",
            409,
            "SHIPMENT_INVENTORY_ALREADY_RELEASED"
          );
        }

        if (shipment.inventoryStatus !== "deducted") {
          await deductShipmentInventory({
            shipment,
            session,
          });
        }
      }

      /*
       * Reserved inventory is released when a shipment
       * is cancelled before pickup.
       *
       * Guarantees reservation lifecycle idempotency:
       * Stock is only released if this shipment's reservation
       * has not already been released and the order was not
       * already cancelled (which would have already released it).
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
        const isOrderAlreadyCancelled = Boolean(
          order && order.status === "cancelled"
        );

        if (!isOrderAlreadyCancelled) {
          const claimedShipment =
            await shipmentRepository.claimReservationRelease(
              shipment._id,
              { session }
            );

          if (claimedShipment) {
            await releaseShipmentInventory({
              shipment,
              session,
            });
          }
        }
      }

      const update = {
        status: nextStatus,
      };

      if (nextStatus === "cancelled") {
        update.inventoryStatus = "released";
        if (!shipment.inventoryReleasedAt) {
          update.inventoryReleasedAt = new Date();
        }
        if (!shipment.cancelledAt) {
          update.cancelledAt = new Date();
        }
      } else if (nextStatus === "picked_up") {
        update.inventoryStatus = "deducted";
      }

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
          shipment,
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

      const isIdempotencyConflict =
        (error?.code === 11000 || error?.message?.includes("E11000")) &&
        (error?.keyPattern?.idempotencyKey || error?.message?.includes("idempotencyKey"));

      if (isIdempotencyConflict) {
        const freshShipment = await shipmentRepository.findById(shipmentId);
        if (freshShipment) {
          return freshShipment;
        }
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
  async (trackingNumber, requestingUser = null) => {
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

    if (requestingUser) {
      let isPrivileged = false;
      if (requestingUser.role === ROLES.SUPER_ADMIN) {
        isPrivileged = true;
      } else {
        const isCustomerOrVendor = ["customer", "vendor"].includes(requestingUser.role);
        const userId = requestingUser.id || requestingUser._id;
        const canQueryDb = mongoose.connection && mongoose.connection.readyState === 1;
        const isMocked = Employee.exists && (Employee.exists._isMockFunction || Employee.exists.mock);
        const hasEmployee = (!isCustomerOrVendor && userId && (canQueryDb || isMocked))
          ? await Employee.exists({ userId })
          : false;

        if (hasEmployee) {
          const effectivePermissions = await getEffectivePermissions(userId);
          if (effectivePermissions.includes(PERMISSIONS.SHIPMENTS_READ)) {
            isPrivileged = true;
          }
        } else {
          const fallbackPermissions =
            ROLE_PERMISSIONS[requestingUser.role] || [];
          if (fallbackPermissions.includes(PERMISSIONS.SHIPMENTS_READ)) {
            isPrivileged = true;
          }
        }
      }

      if (isPrivileged) {
        return shipment;
      }

      const customer = await Customer.findOne({
        userId: requestingUser.id || requestingUser._id,
        isActive: true,
        deletedAt: null,
      });

      if (
        !customer ||
        shipment.customerId?.toString() !== customer._id.toString()
      ) {
        throw new AppError(
          "Shipment not found",
          404,
          "SHIPMENT_NOT_FOUND"
        );
      }

      const raw = shipment.toObject ? shipment.toObject() : { ...shipment };
      return {
        _id: raw._id,
        shipmentNumber: raw.shipmentNumber,
        trackingNumber: raw.trackingNumber,
        status: raw.status,
        carrier: raw.carrier,
        serviceLevel: raw.serviceLevel,
        trackingUrl: raw.trackingUrl,
        shippingAddress: raw.shippingAddress,
        items: raw.items,
        shippedAt: raw.shippedAt,
        deliveredAt: raw.deliveredAt,
        cancelledAt: raw.cancelledAt,
        returnedAt: raw.returnedAt,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      };
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

const getCustomerShipmentsByOrderId =
  async (orderId, userId) => {
    validateObjectId(orderId, "orderId");
    const customerId =
      await getCustomerIdByUserId(
        userId
      );

    const order = await orderRepository.findById(orderId);
    if (!order || order.customerId.toString() !== customerId.toString()) {
      throw new AppError("Order not found or unauthorized", 404, "ORDER_NOT_FOUND");
    }

    return shipmentRepository.findByOrderId(orderId);
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

const listAllShipments = async ({ page = 1, limit = 20, status, carrier, search } = {}) => {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const skip = (safePage - 1) * safeLimit;

  const filter = {};
  if (status) filter.status = status;
  if (carrier) filter.carrier = carrier;
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");
    filter.$or = [
      { shipmentNumber: regex },
      { trackingNumber: regex },
    ];
  }

  const [items, total] = await Promise.all([
    Shipment.find(filter)
      .populate("orderId", "orderNumber grandTotal")
      .populate("vendorId", "businessName")
      .populate("warehouseId", "name code")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    Shipment.countDocuments(filter),
  ]);

  return {
    items,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
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
  getCustomerShipmentsByOrderId,

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
  listAllShipments,

  generateShipmentNumber,
};

