require("dotenv").config();
const EmailService = require("../src/services/email.service");
const ElasticEmailProvider = require("../src/integrations/email/elastic-email.provider");

async function runDirectDiagnostic(recipientEmail = null) {
  console.log("=== BUYBOX ELASTIC EMAIL DIRECT DIAGNOSTIC ===");
  const emailService = new EmailService();

  const isElasticProvider = emailService.provider instanceof ElasticEmailProvider;
  console.log(`Provider selected: ${emailService.provider.constructor.name}`);
  console.log(`Resolves to ElasticEmailProvider: ${isElasticProvider ? "YES" : "NO"}`);

  const targetEmail = recipientEmail || process.env.ELASTIC_EMAIL_FROM_EMAIL || "test@example.com";
  console.log(`Diagnostic target recipient: ${targetEmail.replace(/^(.)(.*)(@.*)$/, "$1***$3")}`);

  console.log("\nInitiating direct test transmission to Elastic Email API...");
  try {
    const result = await emailService.send({
      to: targetEmail,
      subject: "Buybox Email Delivery Test",
      text: "Buybox Elastic Email integration test.",
      html: "<p>Buybox Elastic Email integration test.</p>",
      emailType: "direct_diagnostic",
    });

    console.log("\n--- Transmission Result ---");
    console.log(`Success: ${result.success ? "PASS" : "FAIL"}`);
    console.log(`Status: ${result.status}`);
    if (result.messageId) {
      console.log(`Message/Transaction ID: ${result.messageId}`);
    }
    if (result.error) {
      console.log(`Error: ${result.error}`);
    }
    if (result.errorCode) {
      console.log(`Error Code: ${result.errorCode}`);
    }
    if (result.statusCode) {
      console.log(`HTTP Status: ${result.statusCode}`);
    }
    if (result.diagnostics) {
      console.log("Safe Diagnostics:", JSON.stringify(result.diagnostics, null, 2));
    }
    return result;
  } catch (err) {
    console.error("\nUnexpected Exception during send:", err.message);
    return { success: false, error: err.message };
  }
}

if (require.main === module) {
  const target = process.argv[2] || process.env.DIAGNOSTIC_RECIPIENT_EMAIL || null;
  runDirectDiagnostic(target).then((res) => {
    process.exitCode = res.success ? 0 : 1;
  });
}

module.exports = { runDirectDiagnostic };
