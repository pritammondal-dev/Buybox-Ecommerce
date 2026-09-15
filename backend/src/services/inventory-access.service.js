const ProductVariant = require("../models/ProductVariant");
const Product = require("../models/Product");
const Vendor = require("../models/Vendor");
const Employee = require("../models/Employee");
const AppError = require("../errors/AppError");
const { ROLES } = require("../constants/auth.constants");
const { SCOPE_TYPES } = require("../constants/scope.constants");
const { hasScopeAccess } = require("./scope-authorization.service");

const ensureWarehouseScopeForActor = async (user, warehouseId, isMutation = false) => {
  if (!warehouseId) return;

  const employee = await Employee.findOne({
    userId: user.id || user._id,
  }).lean();

  if (!employee) {
    if (user.role === ROLES.ADMIN || user.role === ROLES.SUPER_ADMIN) {
      return;
    }
    throw new AppError(
      "Employee profile required for scoped access",
      403,
      "EMPLOYEE_PROFILE_REQUIRED"
    );
  }

  if (employee.status !== "active") {
    throw new AppError(
      "Employee account is not active",
      403,
      "INSUFFICIENT_SCOPE"
    );
  }

  const isSuperAdmin = user.role === ROLES.SUPER_ADMIN;
  const allowGlobal = isMutation ? isSuperAdmin : true;

  const hasAccess = await hasScopeAccess({
    employeeId: employee._id,
    scopeType: SCOPE_TYPES.WAREHOUSE,
    scopeId: warehouseId,
    allowGlobal,
    isPlatformActor: true,
  });

  if (!hasAccess) {
    throw new AppError(
      "You do not have scope access to this warehouse resource",
      403,
      "INSUFFICIENT_SCOPE"
    );
  }
};

const ensureInventoryAccess = async ({
  user,
  productVariantId,
  warehouseId,
  isMutation = false,
}) => {
  if (!user) {
    throw new AppError(
      "Authentication required",
      401,
      "AUTHENTICATION_REQUIRED"
    );
  }

  const isPlatformActor = !["customer", "vendor"].includes(user.role);

  if (isPlatformActor) {
    if (warehouseId) {
      await ensureWarehouseScopeForActor(user, warehouseId, isMutation);
    }
    return;
  }

  if (user.role !== ROLES.VENDOR) {
    throw new AppError(
      "You do not have permission to manage this inventory",
      403,
      "INSUFFICIENT_PERMISSIONS"
    );
  }

  const variant = await ProductVariant.findById(
    productVariantId
  );

  if (!variant) {
    throw new AppError(
      "Product variant not found",
      404,
      "PRODUCT_VARIANT_NOT_FOUND"
    );
  }

  const product = await Product.findById(
    variant.productId
  );

  if (!product) {
    throw new AppError(
      "Product not found",
      404,
      "PRODUCT_NOT_FOUND"
    );
  }

  const vendor = await Vendor.findOne({
    userId: user.id || user._id,
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

  if (
    !product.vendorId ||
    product.vendorId.toString() !==
      vendor._id.toString()
  ) {
    throw new AppError(
      "You do not have access to this inventory",
      403,
      "INVENTORY_ACCESS_DENIED"
    );
  }
};

const ensureInventoryIdAccess = async ({
  user,
  inventory,
  isMutation = false,
}) => {
  return ensureInventoryAccess({
    user,
    productVariantId: inventory.productVariantId,
    warehouseId: inventory.warehouseId,
    isMutation,
  });
};

module.exports = {
  ensureInventoryAccess,
  ensureInventoryIdAccess,
  ensureWarehouseScopeForActor,
};