const logger = require("../config/logger");

const errorMiddleware = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  const response = {
    success: false,
    message: err.message || "Internal server error",
    code: err.code || "INTERNAL_SERVER_ERROR",
    requestId: req.id,
  };

  if (statusCode >= 500) {
    logger.error(
      {
        err,
        requestId: req.id,
        method: req.method,
        url: req.originalUrl,
      },
      "Internal server error"
    );
  } else {
    logger.warn(
      {
        requestId: req.id,
        method: req.method,
        url: req.originalUrl,
        statusCode,
      },
      "Application error"
    );
  }

  res.status(statusCode).json(response);
};

module.exports = errorMiddleware;