const { z } = require("zod");

const objectIdSchema = z
  .string()
  .regex(
    /^[a-f\d]{24}$/i,
    "Invalid MongoDB ObjectId"
  );

module.exports = {
  objectIdSchema,
};