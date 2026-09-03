const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

const routes = require("./routes");

const app = express();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(cookieParser());

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
  res.status(200).json({
    success: true,
    message: "Buybox API is healthy",
  });
});

app.use("/api/v1", routes);

module.exports = app;