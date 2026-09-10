const crypto = require("crypto");

const {
  verifyRazorpaySignature,
} = require("../src/services/payment-verification.service");

describe("Razorpay Payment Verification", () => {
  it("accepts a valid Razorpay signature", () => {
    const razorpayOrderId = "order_TEST123";
    const razorpayPaymentId = "pay_TEST123";

    const razorpaySignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    expect(
      verifyRazorpaySignature({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      })
    ).toBe(true);
  });

  it("rejects an invalid Razorpay signature", () => {
    expect(() =>
      verifyRazorpaySignature({
        razorpayOrderId: "order_TEST123",
        razorpayPaymentId: "pay_TEST123",
        razorpaySignature: "invalid-signature",
      })
    ).toThrow("Invalid Razorpay payment signature");
  });
});
