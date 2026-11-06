const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const pinoHttp = require("pino-http");
const logger = require("./config/logger");
const routes = require("./routes");
const requestIdMiddleware = require("./middlewares/request-id.middleware");
const AppError = require("./errors/AppError");
const errorMiddleware = require("./middlewares/error.middleware");
const { sendSuccess } = require("./utils/apiResponse");
const { configureTrustProxy } = require("./config/proxy");
const { globalApiLimiter } = require("./middlewares/rate-limiter.middleware");
const shipmentRoutes = require("./routes/shipment.routes");
const env = require("./config/env");

const app = express();

// Configure trusted proxy boundaries based on deployment topology
configureTrustProxy(app, env.TRUST_PROXY || process.env.TRUST_PROXY, env.NODE_ENV);

app.use(requestIdMiddleware);
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.id,
  })
);

const devOriginRegex = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const rawOrigins = [
  process.env.CORS_ORIGIN || env.CORS_ORIGIN,
  process.env.CORS_ALLOWED_ORIGINS || env.CORS_ALLOWED_ORIGINS,
  process.env.FRONTEND_URL || env.FRONTEND_URL,
].filter(Boolean).join(",");

const allowedOriginsList = rawOrigins
  ? Array.from(new Set(rawOrigins.split(",").map((o) => o.trim()).filter(Boolean)))
  : ["http://localhost:3000", "http://127.0.0.1:3000"];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (env.NODE_ENV !== "production" && devOriginRegex.test(origin)) {
      return callback(null, true);
    }

    if (allowedOriginsList.includes(origin)) {
      return callback(null, true);
    }

    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Idempotency-Key",
  ],
};

app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  })
);
app.use(cors(corsOptions));
app.use(compression());
app.use(cookieParser());

app.use(
  [
    "/api/v1/payments/webhooks/razorpay",
    "/api/v1/payments/webhooks/paypal",
  ],
  express.raw({
    type: "application/json",
    limit: "1mb",
  })
);
app.use(
  express.json({
    limit: "1mb",
    verify: (req, res, buf) => {
      // Capture exact unparsed payload bytes for webhook signature verification
      if (
        req.originalUrl &&
        (req.originalUrl.includes("/shipping/webhooks") ||
          req.originalUrl.includes("/webhooks"))
      ) {
        req.rawBody = buf;
      }
    },
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  })
);

if (process.env.NODE_ENV === "production") {
  app.use(globalApiLimiter);
}

app.get("/health", (req, res) => {
  return sendSuccess(res, {
    message: "Buybox API is healthy",
    data: {
      status: "ok",
    },
  });
});

app.get(["/liveness", "/live"], (req, res) => {
  return res.status(200).json({
    success: true,
    status: "alive",
    timestamp: new Date().toISOString(),
  });
});

app.get(["/readiness", "/ready"], (req, res) => {
  const mongoose = require("mongoose");
  const redis = require("./config/redis");

  if (app.locals.isShuttingDown) {
    return res.status(503).json({
      success: false,
      status: "terminating",
      ready: false,
      message: "Server is undergoing graceful shutdown",
      timestamp: new Date().toISOString(),
    });
  }

  const isMongoReady = mongoose.connection.readyState === 1;
  const isRedisReady = redis.status === "ready" || redis.status === "connect";

  if (!isMongoReady || !isRedisReady) {
    return res.status(503).json({
      success: false,
      status: "unavailable",
      ready: false,
      timestamp: new Date().toISOString(),
      services: {
        database: isMongoReady ? "up" : "down",
        cache: isRedisReady ? "up" : "down",
      },
    });
  }

  return res.status(200).json({
    success: true,
    status: "ready",
    ready: true,
    timestamp: new Date().toISOString(),
  });
});

const path = require("path");
app.use(
  "/uploads",
  express.static(path.join(__dirname, "../public/uploads"), {
    setHeaders: (res, filePath) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      if (filePath && filePath.toLowerCase().endsWith(".svg")) {
        res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
        res.setHeader("Content-Disposition", "attachment");
      }
    },
  })
);

app.get("/favicon.ico", (req, res) => res.status(204).end());

app.use("/api/v1", routes);

app.use(
  "/api/v1/shipments",
  shipmentRoutes
);

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