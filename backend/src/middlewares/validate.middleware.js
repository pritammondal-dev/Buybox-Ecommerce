const AppError = require("../errors/AppError");

const validate = (schema, source = "body") => {
  return (req, res, next) => {
    const dataToValidate =
      req[source] !== undefined && req[source] !== null
        ? req[source]
        : source === "body"
        ? {}
        : req[source];
    const result = schema.safeParse(dataToValidate);

    if (!result.success) {
      const message = result.error.issues
        .map((issue) => issue.message)
        .join(", ");

      return next(
        new AppError(
          message,
          400,
          "VALIDATION_ERROR"
        )
      );
    }

    req[source] = result.data;

    next();
  };
};

module.exports = validate;