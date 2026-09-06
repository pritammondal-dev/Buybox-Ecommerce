require("dotenv").config();

const mongoose = require("mongoose");
const Order = require("../src/models/Order");

const ORDER_ID = "6a9bf3809b092436094f8c1a";
const VENDOR_ID = "6a9955e001560df0f8e2ad6c";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const result = await Order.updateOne(
    { _id: ORDER_ID },
    {
      $set: {
        vendorId: VENDOR_ID,
        status: "pending",
        paymentStatus: "pending",
        fulfillmentStatus: "unfulfilled",
      },
    }
  );

  console.log("Order fixture updated:", result.modifiedCount);

  const order = await Order.findById(ORDER_ID)
    .select(
      "_id vendorId status paymentStatus fulfillmentStatus"
    )
    .lean();

  console.log(order);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });