const Redis = require("ioredis");

const redisHost = process.env.REDIS_HOST || "127.0.0.1";
const redisPort = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379;
const defaultRedisUrl = `redis://${redisHost}:${redisPort}`;
const redisConnectionUrl = process.env.REDIS_URL || defaultRedisUrl;

const redis = new Redis(redisConnectionUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

redis.on("connect", () => {
  console.log("Redis connected");
});

redis.on("error", (error) => {
  console.error("Redis error:", error.message);
});

module.exports = redis;