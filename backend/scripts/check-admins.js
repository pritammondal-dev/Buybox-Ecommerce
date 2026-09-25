const mongoose = require("mongoose");
require("dotenv").config();

async function checkAdmins() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/buybox?replicaSet=rs0";
  await mongoose.connect(uri);
  const users = await mongoose.connection.collection("users").find({
    role: { $in: ["admin", "super_admin", "staff", "manager", "editor"] }
  }).project({ email: 1, role: 1, isEmailVerified: 1, isActive: 1 }).toArray();
  console.log("Admins found:", users);
  await mongoose.disconnect();
}

checkAdmins().catch(console.error);
