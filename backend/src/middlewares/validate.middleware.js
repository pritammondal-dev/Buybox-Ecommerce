const AppError = require("../errors/AppError");

const validate = (schema, source = "body") => {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

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