require("dotenv").config();

// Enforce strict test database isolation: Automated tests must NEVER touch development or production databases
if (process.env.NODE_ENV !== "production") {
  process.env.NODE_ENV = "test";
}

if (process.env.MONGODB_URI) {
  process.env.MONGODB_URI = process.env.MONGODB_URI.replace(/\/buybox(\?|$)/, "/buybox_test$1");
} else {
  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/buybox_test?replicaSet=rs0";
}