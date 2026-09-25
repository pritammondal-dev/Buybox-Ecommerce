/**
 * Frontend Secure Identifier Utility
 *
 * Ensures all internal navigation and detail links use opaque/encrypted identifiers
 * rather than raw sensitive database IDs.
 */

/**
 * Extract the secure identifier from an entity object, falling back to its primary ID.
 *
 * @param {Object} entity Entity object
 * @param {string} [type] Optional entity type hint
 * @returns {string} Secure ID or raw ID
 */
export const getSecureId = (entity, type = "") => {
  if (!entity) return "";
  if (typeof entity === "string") return entity;
  return entity.secureId || entity.id || entity._id || "";
};

/**
 * Generate secure vendor console URLs
 */
export const getVendorOrderUrl = (order) => {
  const id = getSecureId(order, "order");
  return `/vendor/orders/${encodeURIComponent(id)}`;
};

export const getVendorProductUrl = (product) => {
  const id = getSecureId(product, "product");
  return `/vendor/products/${encodeURIComponent(id)}`;
};

export const getVendorShipmentUrl = (shipment) => {
  const id = getSecureId(shipment, "shipment");
  return `/vendor/shipments/${encodeURIComponent(id)}`;
};

export const getVendorReturnUrl = (returnReq) => {
  const id = getSecureId(returnReq, "return");
  return `/vendor/returns/${encodeURIComponent(id)}`;
};

export const getVendorWarehouseUrl = (warehouse) => {
  const id = getSecureId(warehouse, "warehouse");
  return `/vendor/warehouses/${encodeURIComponent(id)}`;
};

export const getAdminVendorUrl = (vendor) => {
  const id = getSecureId(vendor, "vendor");
  return `/admin/vendors/${encodeURIComponent(id)}`;
};

export const getVendorSettlementUrl = (settlement) => {
  const id = getSecureId(settlement, "settlement");
  return `/vendor/finance/settlements/${encodeURIComponent(id)}`;
};

export const getAdminOrderUrl = (order) => {
  const id = getSecureId(order, "order");
  return `/admin/orders/${encodeURIComponent(id)}`;
};

export const getAdminSettlementUrl = (settlement) => {
  const id = getSecureId(settlement, "settlement");
  return `/admin/settlements/${encodeURIComponent(id)}`;
};

const secureIdUtil = {
  getSecureId,
  getVendorOrderUrl,
  getVendorProductUrl,
  getVendorShipmentUrl,
  getVendorReturnUrl,
  getVendorWarehouseUrl,
  getAdminVendorUrl,
  getVendorSettlementUrl,
  getAdminOrderUrl,
  getAdminSettlementUrl,
};

export default secureIdUtil;
