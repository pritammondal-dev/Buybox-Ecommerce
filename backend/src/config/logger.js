const pino = require("pino");

const logger = pino({
  level: process.env.LOG_LEVEL || "info",

  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "token",
      "refreshToken",
      "accessToken",
    ],
    censor: "[REDACTED]",
  },

  transport:
    process.env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        }
      : undefined,
});

module.exports = logger;