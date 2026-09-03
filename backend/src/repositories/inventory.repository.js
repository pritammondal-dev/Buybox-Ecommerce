const Inventory = require("../models/Inventory");

const create = async (data, options = {}) => {
  return Inventory.create([data], options).then(
    (documents) => documents[0]
  );
};

const findById = async (id, options = {}) => {
  return Inventory.findById(id).session(
    options.session || null
  );
};

const findByVariantAndWarehouse = async (
  productVariantId,
  warehouseId,
  options = {}
) => {
  return Inventory.findOne({
    productVariantId,
    warehouseId,
  }).session(options.session || null);
};

const findByVariant = async (
  productVariantId,
  options = {}
) => {
  return Inventory.find({
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
  return Inventory.find({
    warehouseId,
  })
    .session(options.session || null)
    .sort({
      createdAt: -1,
    });
};

const updateById = async (
  id,
  data,
  options = {}
) => {
  return Inventory.findByIdAndUpdate(
    id,
    data,
    {
      new: true,
      runValidators: true,
      session: options.session,
    }
  );
};

const adjustStock = async (
  inventoryId,
  quantity,
  options = {}
) => {
  const filter =
    quantity > 0
      ? {
          _id: inventoryId,
        }
      : {
          _id: inventoryId,
          $expr: {
            $gte: [
              {
                $add: ["$onHand", quantity],
              },
              "$reserved",
            ],
          },
        };

  return Inventory.findOneAndUpdate(
    filter,
    {
      $inc: {
        onHand: quantity,
        version: 1,
      },
      $set: {
        lastStockUpdateAt: new Date(),
      },
    },
    {
      new: true,
      runValidators: true,
      session: options.session,
    }
  );
};

const reserveAvailableStock = async (
  inventoryId,
  quantity,
  options = {}
) => {
  return Inventory.findOneAndUpdate(
    {
      _id: inventoryId,
      $expr: {
        $gte: [
          {
            $subtract: [
              "$onHand",
              "$reserved",
            ],
          },
          quantity,
        ],
      },
    },
    {
      $inc: {
        reserved: quantity,
        version: 1,
      },
      $set: {
        lastStockUpdateAt: new Date(),
      },
    },
    {
      new: true,
      runValidators: true,
      session: options.session,
    }
  );
};

const releaseReservedStock = async (
  inventoryId,
  quantity,
  options = {}
) => {
  return Inventory.findOneAndUpdate(
    {
      _id: inventoryId,
      reserved: {
        $gte: quantity,
      },
    },
    {
      $inc: {
        reserved: -quantity,
        version: 1,
      },
      $set: {
        lastStockUpdateAt: new Date(),
      },
    },
    {
      new: true,
      runValidators: true,
      session: options.session,
    }
  );
};

const deductReservedStock = async (
  inventoryId,
  quantity,
  options = {}
) => {
  return Inventory.findOneAndUpdate(
    {
      _id: inventoryId,
      reserved: {
        $gte: quantity,
      },
      onHand: {
        $gte: quantity,
      },
    },
    {
      $inc: {
        onHand: -quantity,
        reserved: -quantity,
        version: 1,
      },
      $set: {
        lastStockUpdateAt: new Date(),
      },
    },
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
  findByVariantAndWarehouse,
  findByVariant,
  findByWarehouse,
  updateById,
  adjustStock,
  reserveAvailableStock,
  releaseReservedStock,
  deductReservedStock,
};