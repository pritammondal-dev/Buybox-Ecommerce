const addressRepository = require("../repositories/address.repository");
const AppError = require("../errors/AppError");

const getMyAddresses = async (userId) => {
  return addressRepository.findByUserId(userId);
};

const getMyAddress = async (userId, addressId) => {
  const address = await addressRepository.findById(
    addressId,
    userId
  );

  if (!address) {
    throw new AppError(
      "Address not found",
      404,
      "ADDRESS_NOT_FOUND"
    );
  }

  return address;
};

const createAddress = async (userId, data) => {
  if (data.isDefault) {
    await addressRepository.clearDefaultForUser(userId);
  }

  return addressRepository.create({
    userId,
    ...data,
  });
};

const updateAddress = async (
  userId,
  addressId,
  data
) => {
  const address = await addressRepository.findById(
    addressId,
    userId
  );

  if (!address) {
    throw new AppError(
      "Address not found",
      404,
      "ADDRESS_NOT_FOUND"
    );
  }

  if (data.isDefault === true) {
    await addressRepository.clearDefaultForUser(userId);
  }

  const updatedAddress =
    await addressRepository.updateById(
      addressId,
      userId,
      data
    );

  if (!updatedAddress) {
    throw new AppError(
      "Address not found",
      404,
      "ADDRESS_NOT_FOUND"
    );
  }

  return updatedAddress;
};

const deleteAddress = async (
  userId,
  addressId
) => {
  const address = await addressRepository.findById(
    addressId,
    userId
  );

  if (!address) {
    throw new AppError(
      "Address not found",
      404,
      "ADDRESS_NOT_FOUND"
    );
  }

  return addressRepository.softDeleteById(
    addressId,
    userId
  );
};

module.exports = {
  getMyAddresses,
  getMyAddress,
  createAddress,
  updateAddress,
  deleteAddress,
};