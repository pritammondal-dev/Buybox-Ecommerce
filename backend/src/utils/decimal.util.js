const mongoose = require("mongoose");

/**
 * Checks if a value is a MongoDB Decimal128 instance.
 *
 * @param {*} val
 * @returns {boolean}
 */
function isDecimal128(val) {
  return val instanceof mongoose.Types.Decimal128;
}

/**
 * Checks if a value is an Extended JSON Decimal128 object: { $numberDecimal: "..." }.
 *
 * @param {*} val
 * @returns {boolean}
 */
function isExtendedJsonDecimal(val) {
  return (
    val !== null &&
    typeof val === "object" &&
    typeof val.$numberDecimal === "string"
  );
}

/**
 * Recursively converts any Decimal128 instances or Extended JSON decimal objects
 * into their canonical decimal string representations.
 * Preserves full decimal precision without passing through JavaScript floating point numbers.
 *
 * Handles:
 * - mongoose.Types.Decimal128 instances -> canonical decimal string (e.g. "18.00", "0.00")
 * - Extended JSON { $numberDecimal: "18.00" } -> "18.00"
 * - Mongoose Documents -> calls toObject() and normalizes fields
 * - Nested objects and arrays containing decimals
 * - Preserves numbers, strings, booleans, Dates, ObjectIds, null, and undefined
 *
 * @param {*} value - The input value to serialize.
 * @returns {*} Serialized value with all Decimal128 values converted to canonical strings.
 */
function serializeDecimals(value) {
  if (value === null || value === undefined) {
    return value;
  }

  // Handle Mongoose Decimal128 instance directly
  if (isDecimal128(value)) {
    return value.toString();
  }

  // Handle BSON Extended JSON object: { $numberDecimal: "..." }
  if (isExtendedJsonDecimal(value)) {
    return value.$numberDecimal;
  }

  // If it's a Mongoose document, extract plain object
  if (typeof value.toObject === "function") {
    value = value.toObject();
  }

  // Handle arrays recursively
  if (Array.isArray(value)) {
    return value.map((item) => serializeDecimals(item));
  }

  // Handle plain objects recursively (excluding Date, RegExp, Buffer, ObjectId)
  if (
    typeof value === "object" &&
    !(value instanceof Date) &&
    !(value instanceof RegExp) &&
    !(value instanceof mongoose.Types.ObjectId)
  ) {
    const serialized = {};
    for (const [key, val] of Object.entries(value)) {
      serialized[key] = serializeDecimals(val);
    }
    return serialized;
  }

  return value;
}

module.exports = {
  isDecimal128,
  isExtendedJsonDecimal,
  serializeDecimals,
};
