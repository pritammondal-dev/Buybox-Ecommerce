const mongoose = require("mongoose");
const env = require("./env");
const logger = require("./logger");

const connectDatabase = async () => {
  try {
    const autoIndex =
      env.NODE_ENV === "development" || env.NODE_ENV === "test";

    const connection = await mongoose.connect(env.MONGODB_URI, {
      autoIndex,
    });

    logger.info(
  {
    host: connection.connection.host,
    database: connection.connection.name,
  },
  "MongoDB connected"
);
  } catch (error) {
    logger.error(
  {
    err: error,
  },
  "MongoDB connection failed"
);
    process.exit(1);
  }
};

module.exports = connectDatabase;