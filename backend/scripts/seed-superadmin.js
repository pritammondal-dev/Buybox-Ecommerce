const mongoose = require("mongoose");
require("dotenv").config();
const { bootstrapSuperadmin } = require("../src/services/bootstrap.service");

async function runBootstrap() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/buybox?replicaSet=rs0";
  await mongoose.connect(uri);
  await bootstrapSuperadmin();
  console.log("Bootstrap completed successfully");
  await mongoose.disconnect();
}

runBootstrap().catch(err => {
  console.error(err);
  process.exit(1);
});
