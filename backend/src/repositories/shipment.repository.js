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
};

