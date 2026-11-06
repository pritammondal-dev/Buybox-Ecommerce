require("dotenv").config();
const mongoose = require("mongoose");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  await mongoose.connection.collection("users").updateOne(
    { email: "vendor-mv3gtndx@buybox.test" },
    { $set: { isEmailVerified: true, isActive: true } }
  );
  console.log("Verified vendor-mv3gtndx@buybox.test successfully");
  await mongoose.disconnect();
})();
