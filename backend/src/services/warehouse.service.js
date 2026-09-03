const warehouseRepository = require("../repositories/warehouse.repository");
const AppError = require("../errors/AppError");

const createWarehouse = async (data) => {
  const existing =
    await warehouseRepository.findByCode(data.code);

  if (existing) {
    throw new AppError(
      "Warehouse code is already in use",
      409,
      "WAREHOUSE_CODE_ALREADY_EXISTS"
    );
  }

  return warehouseRepository.create(data);
};

const getWarehouse = async (id) => {
  const warehouse =
    await warehouseRepository.findById(id);

  if (!warehouse) {
    throw new AppError(
      "Warehouse not found",
      404,
      "WAREHOUSE_NOT_FOUND"
    );
  }

  return warehouse;
};

const listWarehouses = async () => {
  return warehouseRepository.findAll();
};

const updateWarehouse = async (id, data) => {
  const warehouse =
    await warehouseRepository.findById(id);

  if (!warehouse) {
    throw new AppError(
      "Warehouse not found",
      404,
      "WAREHOUSE_NOT_FOUND"
    );
  }

  return warehouseRepository.updateById(
    id,
    data
  );
};

const deleteWarehouse = async (id) => {
  const warehouse =
    await warehouseRepository.findById(id);

  if (!warehouse) {
    throw new AppError(
      "Warehouse not found",
      404,
      "WAREHOUSE_NOT_FOUND"
    );
  }

  return warehouseRepository.softDeleteById(id);
};

module.exports = {
  createWarehouse,
  getWarehouse,
  listWarehouses,
  updateWarehouse,
  deleteWarehouse,
};