const InventoryTransaction = require("../models/InventoryTransaction");

const create = async (data, options = {}) => {
  const documents = await InventoryTransaction.create(
    [data],
    {
      session: options.session,
    }
  );

  return documents[0];
};

const findById = async (id, options = {}) => {
  return InventoryTransaction.findById(id).session(
    options.session || null
  );
};

const findByInventory = async ({
  productVariantId,
  warehouseId,
  session = null,
}) => {
  return InventoryTransaction.find({
    productVariantId,
    warehouseId,
  })
    .session(session)
    .sort({
      createdAt: -1,
    });
};

const findByVariant = async (
  productVariantId,
  options = {}
) => {
  return InventoryTransaction.find({
    productVariantId,
  })
    .session(options.session || null)
    .sort({
      createdAt: -1,
    });
};

const findByWarehouse = async (
  warehouseId,
  options = {}
) => {
  return InventoryTransaction.find({
    warehouseId,
  })
    .session(options.session || null)
    .sort({
      createdAt: -1,
    });
};

const findByIdempotencyKey = async (
  idempotencyKey,
  options = {}
) => {
  return InventoryTransaction.findOne({
    idempotencyKey,
  }).session(options.session || null);
};

module.exports = {
  create,
  findById,
  findByInventory,
  findByVariant,
  findByWarehouse,
  findByIdempotencyKey,
};