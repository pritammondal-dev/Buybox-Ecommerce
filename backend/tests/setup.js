require("dotenv").config();

// Enforce strict test database isolation: Automated tests must NEVER touch development or production databases
if (process.env.NODE_ENV !== "production") {
  process.env.NODE_ENV = "test";
}

const baseUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/buybox?replicaSet=rs0";

// Ensure process.env.MONGODB_URI uses base "/buybox?" so that individual test suites'
// .replace("/buybox?", "/buybox_<suite>_test?") can match correctly.
// If it was set to /buybox_test, normalize it back to /buybox.
process.env.MONGODB_URI = baseUri.replace(/\/buybox_test(?:\?|$)/, (m) =>
  m.startsWith("/buybox_test?") ? "/buybox?" : "/buybox"
);

// Monkey-patch mongoose.connect to ensure any attempt to connect to the raw "buybox" database
// is redirected to "buybox_test" to prevent any risk to development data,
// and to safely handle switching databases between suites under --runInBand.
const mongoose = require("mongoose");
const originalConnect = mongoose.connect.bind(mongoose);
mongoose.connect = async function (uri, options) {
  let targetUri = uri;
  if (typeof targetUri === "string") {
    targetUri = targetUri.replace(/\/buybox(?:\?|$)/, (m) =>
      m.startsWith("/buybox?") ? "/buybox_test?" : "/buybox_test"
    );
  }
  if (mongoose.connection.readyState !== 0) {
    const currentDb = mongoose.connection.name;
    const match = typeof targetUri === "string" && targetUri.match(/\/([^/?]+)(?:\?|$)/);
    const targetDb = match ? match[1] : null;
    if (targetDb && currentDb && currentDb !== targetDb) {
      await mongoose.disconnect();
    }
  }
  return originalConnect(targetUri, options);
};

// Monkey-patch mongoose.createConnection to ensure any tool/script opening independent connections
// also redirects the raw "buybox" database to "buybox_test" during automated test suites.
const originalCreateConnection = mongoose.createConnection.bind(mongoose);
mongoose.createConnection = function (uri, options) {
  let targetUri = uri;
  if (typeof targetUri === "string") {
    targetUri = targetUri.replace(/\/buybox(?:\?|$)/, (m) =>
      m.startsWith("/buybox?") ? "/buybox_test?" : "/buybox_test"
    );
  }
  return originalCreateConnection(targetUri, options);
};
