const customerRepository = require("../repositories/customer.repository");
const User = require("../models/User");
const AppError = require("../errors/AppError");

const getCustomerProfile = async (userId) => {
  let customer = await customerRepository.findByUserId(userId);

  if (!customer) {
    const user = await User.findById(userId);
    if (user && (user.role === "customer" || user.role === "vendor" || (user.roles || []).includes("customer"))) {
      customer = await customerRepository.create({
        userId,
        phone: user.phone || null,
      });
    } else {
      throw new AppError(
        "Customer profile not found",
        404,
        "CUSTOMER_NOT_FOUND"
      );
    }
  } else if (!customer.phone) {
    const user = await User.findById(userId).select("phone").lean();
    if (user && user.phone) {
      customer.phone = user.phone;
      await customerRepository.updateByUserId(userId, { phone: user.phone });
    }
  }

  return customer;
};

const createCustomerProfile = async (userId, data = {}) => {
  const existingCustomer =
    await customerRepository.findByUserId(userId);

  if (existingCustomer) {
    throw new AppError(
      "Customer profile already exists",
      409,
      "CUSTOMER_ALREADY_EXISTS"
    );
  }

  if (data.phone !== undefined) {
    const normalizedPhone = data.phone && String(data.phone).trim() ? String(data.phone).trim() : undefined;
    await User.findByIdAndUpdate(userId, { phone: normalizedPhone });
  }

  return customerRepository.create({
    userId,
    ...data,
  });
};

const updateCustomerProfile = async (userId, data) => {
  if (data && data.phone !== undefined) {
    const normalizedPhone = data.phone && String(data.phone).trim() ? String(data.phone).trim() : undefined;
    await User.findByIdAndUpdate(userId, { phone: normalizedPhone });
  }

  const customer = await customerRepository.updateByUserId(
    userId,
    data
  );

  if (!customer) {
    throw new AppError(
      "Customer profile not found",
      404,
      "CUSTOMER_NOT_FOUND"
    );
  }

  return customer;
};

module.exports = {
  getCustomerProfile,
  createCustomerProfile,
  updateCustomerProfile,
};