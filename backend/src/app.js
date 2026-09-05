const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const pinoHttp = require("pino-http");
const logger = require("./config/logger");

const routes = require("./routes");
const requestIdMiddleware = require("./middlewares/request-id.middleware");
const AppError = require("./errors/AppError");
const errorMiddleware = require("./middlewares/error.middleware");
const { sendSuccess } = require("./utils/apiResponse");

const app = express();
app.use(requestIdMiddleware);
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.id,
  })
);

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(cookieParser());

app.use(
  "/api/v1/payments/webhooks/razorpay",
  express.raw({
    type: "application/json",
    limit: "1mb",
  })
);
app.use(
  express.json({
    limit: "1mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  })
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get("/health", (req, res) => {
  return sendSuccess(res, {
    message: "Buybox API is healthy",
    data: {
      status: "ok",
    },
  });
});

app.use("/api/v1", routes);

app.use((req, res, next) => {
  next(
    new AppError(
      `Route not found: ${req.method} ${req.originalUrl}`,
      404,
      "ROUTE_NOT_FOUND"
    )
  );
});

app.use(errorMiddleware);

module.exports = app;