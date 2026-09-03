const { randomUUID } = require("crypto");

const requestIdMiddleware = (req, res, next) => {
  const requestId = req.get("X-Request-ID") || randomUUID();

  req.id = requestId;

  res.setHeader("X-Request-ID", requestId);

  next();
};

module.exports = requestIdMiddleware;
