const env = require("../config/env");
const logger = require("../config/logger");
const AppError = require("../errors/AppError");

const isDuplicateKeyError = (err) => {
  return (
    Boolean(err) &&
    (err.code === 11000 ||
      err.code === 11001 ||
      (err.name === "MongoServerError" && (err.code === 11000 || err.code === 11001)) ||
      (typeof err.message === "string" && err.message.includes("E11000 duplicate key")))
  );
};

const isCastError = (err) => {
  return Boolean(err) && err.name === "CastError";
};

const isValidationError = (err) => {
  return Boolean(err) && err.name === "ValidationError";
};

const errorMiddleware = (err, req, res, next) => {
  const isProduction =
    (process.env.NODE_ENV || env.NODE_ENV) === "production";

  let statusCode = 500;
  let code = "INTERNAL_SERVER_ERROR";
  let message = "Internal server error";

  // 1. Mongoose CastError (e.g. invalid ObjectId)
  if (isCastError(err)) {
    statusCode = 400;
    code = "INVALID_RESOURCE_ID";
    message = "Invalid resource identifier";
  }
  // 2. Mongoose ValidationError (schema validation failed)
  else if (isValidationError(err)) {
    statusCode = 400;
    code = "VALIDATION_ERROR";
    if (
      err.errors &&
      typeof err.errors === "object" &&
      Object.keys(err.errors).length > 0
    ) {
      message = Object.values(err.errors)
        .map((e) =>
          e && e.message
            ? String(e.message).replace(/^.*validation failed:\s*/i, "")
            : "Invalid value"
        )
        .join(", ");
    } else {
      message = "Validation failed";
    }
  }
  // 3. MongoDB Duplicate Key (code 11000)
  else if (isDuplicateKeyError(err)) {
    statusCode = 409;
    code = "RESOURCE_ALREADY_EXISTS";
    message = "A resource with this identifier already exists";
  }
  // 4. Operational AppError with client status (4xx)
  else if (
    err instanceof AppError ||
    (err &&
      err.isOperational &&
      typeof err.statusCode === "number" &&
      err.statusCode >= 400 &&
      err.statusCode < 500)
  ) {
    statusCode = err.statusCode || 400;
    code = typeof err.code === "string" ? err.code : "APPLICATION_ERROR";
    message =
      typeof err.message === "string" && err.message
        ? err.message
        : "Application error";
  }
  // 5. Operational AppError with 5xx status (e.g. 502 Bad Gateway)
  else if (
    err &&
    err.isOperational &&
    typeof err.statusCode === "number" &&
    err.statusCode > 500
  ) {
    statusCode = err.statusCode;
    code = typeof err.code === "string" ? err.code : "INTERNAL_SERVER_ERROR";
    message =
      typeof err.message === "string" && err.message
        ? err.message
        : "Internal server error";
  }
  // 6. Unexpected / Non-operational 500 errors
  else {
    statusCode = 500;
    code = "INTERNAL_SERVER_ERROR";
    if (
      !isProduction &&
      err &&
      typeof err.message === "string" &&
      err.message
    ) {
      message = err.message;
    } else if (!isProduction && typeof err === "string" && err) {
      message = err;
    } else {
      message = "Internal server error";
    }
  }

  // Guarantee code is strictly string
  if (typeof code !== "string") {
    code = "INTERNAL_SERVER_ERROR";
  }

  const response = {
    success: false,
    message,
    code,
    requestId: req && req.id !== undefined ? req.id : (req ? req.id : undefined),
  };

  if (statusCode >= 500) {
    logger.error(
      {
        err,
        requestId: req ? req.id : undefined,
        method: req ? req.method : undefined,
        url: req ? req.originalUrl : undefined,
      },
      "Internal server error"
    );
  } else {
    logger.warn(
      {
        requestId: req ? req.id : undefined,
        method: req ? req.method : undefined,
        url: req ? req.originalUrl : undefined,
        statusCode,
      },
      "Application error"
    );
  }

  res.status(statusCode).json(response);
};

module.exports = errorMiddleware;