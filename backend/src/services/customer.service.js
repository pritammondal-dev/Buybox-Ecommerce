const customerRepository = require("../repositories/customer.repository");
const AppError = require("../errors/AppError");

const getCustomerProfile = async (userId) => {
  const customer = await customerRepository.findByUserId(userId);

  if (!customer) {
    throw new AppError(
      "Customer profile not found",
      404,
      "CUSTOMER_NOT_FOUND"
    );
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

  return customerRepository.create({
    userId,
    ...data,
  });
};

const updateCustomerProfile = async (userId, data) => {
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