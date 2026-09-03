const AppError = require("../errors/AppError");
const { objectIdSchema } = require("../validators/common/object-id.validator");

const validateObjectId = (paramName) => {
  return (req, res, next) => {
    const result = objectIdSchema.safeParse(
      req.params[paramName]
    );

    if (!result.success) {
      return next(
        new AppError(
          `Invalid ${paramName}`,
          400,
          "INVALID_OBJECT_ID"
        )
      );
    }

    next();
  };
};

module.exports = validateObjectId;