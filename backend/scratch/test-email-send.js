require("dotenv").config();
const EmailService = require("../src/services/email.service");

async function testEmail() {
  const emailService = new EmailService();
  console.log("Testing email service OTP dispatch to account email...");

  try {
    const result = await emailService.sendEmailVerificationOTP({
      to: "neurovault.team@gmail.com",
      customerName: "Neurovault Team",
      otp: "847291",
      expiresInMinutes: 10,
    });
    console.log("Result:", result);
  } catch (err) {
    console.error("Error:", err);
  }
}

testEmail();
