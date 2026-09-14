const mongoose = require("mongoose");
const WorkAssignment = require("../models/WorkAssignment");
const Employee = require("../models/Employee");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const Inventory = require("../models/Inventory");
const Warehouse = require("../models/Warehouse");
const Shipment = require("../models/Shipment");
const SupportTicket = require("../models/SupportTicket");
const AppError = require("../errors/AppError");
const {
  SCOPE_TYPES,
  ALLOWED_SCOPE_TYPES,
} = require("../constants/scope.constants");

/**
 * Normalize an ID to a trimmed string.
 *
 * @param {string|import("mongoose").Types.ObjectId} id
 * @returns {string|null}
 */
const normalizeScopeId = (id) => {
  if (!id) return null;
  const str = String(id).trim();
  return str.length > 0 ? str : null;
};

/**
 * Retrieve active, non-expired WorkAssignments for an employee.
 * Suspended or terminated employees receive NO operational scope.
 *
 * @param {string|import("mongoose").Types.ObjectId|Object} employeeId Or Employee document/lean object
 * @param {Object} [options]
 * @param {Date} [options.now]
 * @returns {Promise<Array<Object>>}
 */
const getActiveAssignments = async (employeeId, options = {}) => {
  if (!employeeId) {
    return [];
  }

  const now = options.now instanceof Date ? options.now : new Date();

  // 1. Resolve employee profile
  let employee = null;
  if (
    typeof employeeId === "object" &&
    employeeId !== null &&
    employeeId._id &&
    employeeId.status
  ) {
    employee = employeeId;
  } else {
    if (!mongoose.isValidObjectId(employeeId)) {
      return [];
    }
    employee = await Employee.findById(employeeId).lean();
  }

  // 2. Status Gate: Suspended or Terminated employees receive NO operational scope
  if (!employee || employee.status !== "active") {
    return [];
  }

  // 3. Query active assignments
  // Supports optional future expiration (expiresAt is null, undefined, or in the future)
  const assignments = await WorkAssignment.find({
    employeeId: employee._id,
    isActive: true,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: now } },
    ],
  }).lean();

  return assignments;
};

/**
 * Check whether an employee holds an active assignment for a specific scope.
 *
 * @param {string|import("mongoose").Types.ObjectId} employeeId
 * @param {string} scopeType
 * @param {string|import("mongoose").Types.ObjectId} scopeId
 * @param {Object} [options]
 * @returns {Promise<boolean>}
 */
const hasAssignment = async (employeeId, scopeType, scopeId, options = {}) => {
  if (!employeeId || !scopeType || !scopeId) {
    return false;
  }

  const targetType = String(scopeType).trim();
  const targetId = normalizeScopeId(scopeId);

  if (!ALLOWED_SCOPE_TYPES.includes(targetType) || !targetId) {
    return false;
  }

  const activeAssignments = await getActiveAssignments(employeeId, options);
  return activeAssignments.some(
    (a) => a.scopeType === targetType && normalizeScopeId(a.scopeId) === targetId,
  );
};

/**
 * Check whether an employee holds AT LEAST ONE of the specified scope assignments.
 *
 * @param {string|import("mongoose").Types.ObjectId} employeeId
 * @param {Array<{ scopeType: string, scopeId: string }>} assignments
 * @param {Object} [options]
 * @returns {Promise<boolean>}
 */
const hasAnyAssignment = async (employeeId, assignments = [], options = {}) => {
  if (!employeeId || !Array.isArray(assignments) || assignments.length === 0) {
    return false;
  }

  const activeAssignments = await getActiveAssignments(employeeId, options);
  if (activeAssignments.length === 0) {
    return false;
  }

  return assignments.some((target) => {
    if (!target || !target.scopeType || !target.scopeId) return false;
    const targetType = String(target.scopeType).trim();
    const targetId = normalizeScopeId(target.scopeId);
    return activeAssignments.some(
      (a) =>
        a.scopeType === targetType && normalizeScopeId(a.scopeId) === targetId,
    );
  });
};

/**
 * Check whether an employee holds ALL of the specified scope assignments.
 *
 * @param {string|import("mongoose").Types.ObjectId} employeeId
 * @param {Array<{ scopeType: string, scopeId: string }>} assignments
 * @param {Object} [options]
 * @returns {Promise<boolean>}
 */
const hasAllAssignments = async (
  employeeId,
  assignments = [],
  options = {},
) => {
  if (!employeeId || !Array.isArray(assignments) || assignments.length === 0) {
    return false;
  }

  const activeAssignments = await getActiveAssignments(employeeId, options);
  if (activeAssignments.length === 0) {
    return false;
  }

  return assignments.every((target) => {
    if (!target || !target.scopeType || !target.scopeId) return false;
    const targetType = String(target.scopeType).trim();
    const targetId = normalizeScopeId(target.scopeId);
    return activeAssignments.some(
      (a) =>
        a.scopeType === targetType && normalizeScopeId(a.scopeId) === targetId,
    );
  });
};

/**
 * Assert that an employee has the required scope assignment. Throws AppError(403) on failure.
 *
 * @param {string|import("mongoose").Types.ObjectId} employeeId
 * @param {{ scopeType: string, scopeId: string }} requiredScope
 * @param {Object} [options]
 * @throws {AppError} 403 INSUFFICIENT_SCOPE
 */
const assertScope = async (employeeId, requiredScope, options = {}) => {
  if (!requiredScope || !requiredScope.scopeType || !requiredScope.scopeId) {
    throw new AppError(
      "Required scope specification is incomplete",
      403,
      "UNRESOLVED_SCOPE",
    );
  }

  const ok = await hasAssignment(
    employeeId,
    requiredScope.scopeType,
    requiredScope.scopeId,
    options,
  );

  if (!ok) {
    throw new AppError(
      "You do not have scope access to this resource",
      403,
      "INSUFFICIENT_SCOPE",
    );
  }

  return true;
};

/**
 * Evaluate scope access for an operation:
 * - Fails closed if employee is missing, suspended, or terminated.
 * - If employee has active assignments of this scopeType: requires match with scopeId.
 * - If employee has NO assignments of this scopeType:
 *   - Allows global access ONLY when allowGlobal is true AND isPlatformActor is true.
 *   - Otherwise fails closed (403).
 *
 * @param {Object} params
 * @param {string|import("mongoose").Types.ObjectId} params.employeeId
 * @param {string} params.scopeType
 * @param {string|import("mongoose").Types.ObjectId} params.scopeId
 * @param {boolean} [params.allowGlobal=false]
 * @param {boolean} [params.isPlatformActor=false]
 * @param {Object} [params.options={}]
 * @returns {Promise<boolean>}
 */
const hasScopeAccess = async ({
  employeeId,
  scopeType,
  scopeId,
  allowGlobal = false,
  isPlatformActor = false,
  options = {},
}) => {
  if (!employeeId || !scopeType || !scopeId) {
    return false;
  }

  const targetType = String(scopeType).trim();
  const targetId = normalizeScopeId(scopeId);

  if (!ALLOWED_SCOPE_TYPES.includes(targetType) || !targetId) {
    return false;
  }

  const active = await getActiveAssignments(employeeId, options);

  // Filter assignments for the queried scopeType
  const typeAssignments = active.filter((a) => a.scopeType === targetType);

  if (typeAssignments.length > 0) {
    // Scoped employee: MUST match one of the assigned scopeIds
    return typeAssignments.some(
      (a) => normalizeScopeId(a.scopeId) === targetId,
    );
  }

  // Employee has NO assignments for this scopeType
  // May operate globally ONLY if explicitly allowed and caller is a platform actor
  if (allowGlobal === true && isPlatformActor === true) {
    return true;
  }

  // Otherwise fail closed
  return false;
};

/* =========================================================================
   Domain Resource Scope Resolvers
   Inspects actual models and resolves associated scope types & IDs.
   All resolvers fail closed (return null) if resource is missing or invalid.
   ========================================================================= */

/**
 * Resolve Product scope (vendorId, categoryId).
 *
 * @param {string|import("mongoose").Types.ObjectId|Object} productOrId
 * @returns {Promise<{ vendorId: string|null, categoryId: string|null }|null>}
 */
const resolveProductScope = async (productOrId) => {
  if (!productOrId) return null;

  let product = null;
  if (
    typeof productOrId === "object" &&
    productOrId !== null &&
    productOrId.vendorId &&
    productOrId.categoryId
  ) {
    product = productOrId;
  } else {
    const id = productOrId._id || productOrId;
    if (!mongoose.isValidObjectId(id)) return null;
    product = await Product.findById(id).select("vendorId categoryId").lean();
  }

  if (!product || !product.vendorId || !product.categoryId) {
    return null;
  }

  return {
    vendorId: normalizeScopeId(product.vendorId),
    categoryId: normalizeScopeId(product.categoryId),
  };
};

/**
 * Resolve ProductVariant scope via parent Product (vendorId, categoryId).
 *
 * @param {string|import("mongoose").Types.ObjectId|Object} variantOrId
 * @returns {Promise<{ vendorId: string|null, categoryId: string|null }|null>}
 */
const resolveProductVariantScope = async (variantOrId) => {
  if (!variantOrId) return null;

  let variant = null;
  if (
    typeof variantOrId === "object" &&
    variantOrId !== null &&
    variantOrId.productId
  ) {
    variant = variantOrId;
  } else {
    const id = variantOrId._id || variantOrId;
    if (!mongoose.isValidObjectId(id)) return null;
    variant = await ProductVariant.findById(id).select("productId").lean();
  }

  if (!variant || !variant.productId) {
    return null;
  }

  return resolveProductScope(variant.productId);
};

/**
 * Resolve Inventory scope (warehouseId, and via variant: vendorId, categoryId).
 *
 * @param {string|import("mongoose").Types.ObjectId|Object} inventoryOrId
 * @returns {Promise<{ warehouseId: string|null, vendorId: string|null, categoryId: string|null }|null>}
 */
const resolveInventoryScope = async (inventoryOrId) => {
  if (!inventoryOrId) return null;

  let inventory = null;
  if (
    typeof inventoryOrId === "object" &&
    inventoryOrId !== null &&
    inventoryOrId.warehouseId
  ) {
    inventory = inventoryOrId;
  } else {
    const id = inventoryOrId._id || inventoryOrId;
    if (!mongoose.isValidObjectId(id)) return null;
    inventory = await Inventory.findById(id)
      .select("warehouseId productVariantId")
      .lean();
  }

  if (!inventory || !inventory.warehouseId) {
    return null;
  }

  let productScope = null;
  if (inventory.productVariantId) {
    productScope = await resolveProductVariantScope(inventory.productVariantId);
  }

  return {
    warehouseId: normalizeScopeId(inventory.warehouseId),
    vendorId: productScope ? productScope.vendorId : null,
    categoryId: productScope ? productScope.categoryId : null,
  };
};

/**
 * Resolve Warehouse scope (warehouseId).
 *
 * @param {string|import("mongoose").Types.ObjectId|Object} warehouseOrId
 * @returns {Promise<{ warehouseId: string|null }|null>}
 */
const resolveWarehouseScope = async (warehouseOrId) => {
  if (!warehouseOrId) return null;

  let warehouse = null;
  if (
    typeof warehouseOrId === "object" &&
    !(warehouseOrId instanceof mongoose.Types.ObjectId) &&
    (warehouseOrId.name || warehouseOrId.code)
  ) {
    warehouse = warehouseOrId;
  } else {
    const id =
      warehouseOrId instanceof mongoose.Types.ObjectId
        ? warehouseOrId
        : warehouseOrId._id || warehouseOrId;
    if (!mongoose.isValidObjectId(id)) return null;
    warehouse = await Warehouse.findById(id).select("_id").lean();
  }

  if (!warehouse || !warehouse._id) {
    return null;
  }

  return {
    warehouseId: normalizeScopeId(warehouse._id),
  };
};

/**
 * Resolve Shipment scope (vendorId, warehouseId).
 *
 * @param {string|import("mongoose").Types.ObjectId|Object} shipmentOrId
 * @returns {Promise<{ vendorId: string|null, warehouseId: string|null }|null>}
 */
const resolveShipmentScope = async (shipmentOrId) => {
  if (!shipmentOrId) return null;

  let shipment = null;
  if (
    typeof shipmentOrId === "object" &&
    shipmentOrId !== null &&
    shipmentOrId.vendorId &&
    shipmentOrId.warehouseId
  ) {
    shipment = shipmentOrId;
  } else {
    const id = shipmentOrId._id || shipmentOrId;
    if (!mongoose.isValidObjectId(id)) return null;
    shipment = await Shipment.findById(id)
      .select("vendorId warehouseId orderId")
      .lean();
  }

  if (!shipment || !shipment.vendorId || !shipment.warehouseId) {
    return null;
  }

  return {
    vendorId: normalizeScopeId(shipment.vendorId),
    warehouseId: normalizeScopeId(shipment.warehouseId),
  };
};

/**
 * Resolve SupportTicket scope (support_queue, customerId).
 *
 * @param {string|import("mongoose").Types.ObjectId|Object} ticketOrId
 * @returns {Promise<{ supportQueue: string|null, customerId: string|null }|null>}
 */
const resolveSupportTicketScope = async (ticketOrId) => {
  if (!ticketOrId) return null;

  let ticket = null;
  if (
    typeof ticketOrId === "object" &&
    ticketOrId !== null &&
    ticketOrId.category
  ) {
    ticket = ticketOrId;
  } else {
    const id = ticketOrId._id || ticketOrId;
    if (!mongoose.isValidObjectId(id)) return null;
    ticket = await SupportTicket.findById(id)
      .select("category metadata customerId")
      .lean();
  }

  if (!ticket || !ticket.category) {
    return null;
  }

  let queueName = ticket.category;
  if (ticket.metadata) {
    if (ticket.metadata instanceof Map && ticket.metadata.has("queue")) {
      queueName = ticket.metadata.get("queue");
    } else if (ticket.metadata.queue) {
      queueName = ticket.metadata.queue;
    }
  }

  return {
    supportQueue: normalizeScopeId(queueName),
    customerId: normalizeScopeId(ticket.customerId),
  };
};

module.exports = {
  normalizeScopeId,
  getActiveAssignments,
  hasAssignment,
  hasAnyAssignment,
  hasAllAssignments,
  assertScope,
  hasScopeAccess,
  resolveProductScope,
  resolveProductVariantScope,
  resolveInventoryScope,
  resolveWarehouseScope,
  resolveShipmentScope,
  resolveSupportTicketScope,
};
