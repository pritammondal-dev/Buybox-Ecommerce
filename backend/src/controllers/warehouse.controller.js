const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const warehouseService = require("../services/warehouse.service");

const createWarehouse = asyncHandler(
  async (req, res) => {
    const warehouse =
      await warehouseService.createWarehouse(
        req.body
      );

    return sendSuccess(res, {
      statusCode: 201,
      message: "Warehouse created successfully",
      data: {
        warehouse,
      },
    });
  }
);

const getWarehouse = asyncHandler(
  async (req, res) => {
    const warehouse =
      await warehouseService.getWarehouse(
        req.params.id
      );

    return sendSuccess(res, {
      message: "Warehouse retrieved successfully",
      data: {
        warehouse,
      },
    });
  }
);

const listWarehouses = asyncHandler(
  async (req, res) => {
    const warehouses =
      await warehouseService.listWarehouses();

    return sendSuccess(res, {
      message: "Warehouses retrieved successfully",
      data: {
        warehouses,
      },
    });
  }
);

const updateWarehouse = asyncHandler(
  async (req, res) => {
    const warehouse =
      await warehouseService.updateWarehouse(
        req.params.id,
        req.body
      );

    return sendSuccess(res, {
      message: "Warehouse updated successfully",
      data: {
        warehouse,
      },
    });
  }
);

const deleteWarehouse = asyncHandler(
  async (req, res) => {
    await warehouseService.deleteWarehouse(
      req.params.id
    );

    return sendSuccess(res, {
      message: "Warehouse deleted successfully",
      data: null,
    });
  }
);

module.exports = {
  createWarehouse,
  getWarehouse,
  listWarehouses,
  updateWarehouse,
  deleteWarehouse,
};