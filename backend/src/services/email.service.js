const ElasticEmailProvider = require("../integrations/email/elastic-email.provider");
const SmtpProvider = require("../integrations/email/smtp.provider");
const templates = require("./email-templates.service");
const env = require("../config/env");

class EmailService {
  constructor(provider = null) {
    if (provider) {
      this.provider = provider;
    } else {
      const providerType = (env.EMAIL_PROVIDER || process.env.EMAIL_PROVIDER || "elastic_email")
        .toLowerCase()
        .trim();

      if (providerType === "smtp") {
        this.provider = new SmtpProvider();
      } else {
        this.provider = new ElasticEmailProvider();
      }
    }
  }

  async send({ to, subject, html, text, replyTo, emailType = "generic", metadata = {}, runtimeCredentials }) {
    if (!to) {
      throw new Error("Email recipient is required");
    }

    if (!subject) {
      throw new Error("Email subject is required");
    }

    if (!html && !text) {
      throw new Error("Email content is required");
    }

    return this.provider.send({
      to,
      subject,
      html,
      text,
      replyTo,
      emailType,
      metadata,
      runtimeCredentials,
    });
  }

  // 1. Email Verification OTP
  async sendEmailVerificationOTP({ to, customerName, otp, expiresInMinutes = 10 }) {
    const template = templates.emailVerificationOtpTemplate({ customerName, otp, expiresInMinutes });
    return this.send({
      to,
      ...template,
      emailType: "email_verification_otp",
      metadata: { customerName },
    });
  }

  // 2. Password Reset OTP
  async sendPasswordResetOTP({ to, customerName, otp, expiresInMinutes = 10 }) {
    const template = templates.passwordResetOtpTemplate({ customerName, otp, expiresInMinutes });
    return this.send({
      to,
      ...template,
      emailType: "password_reset_otp",
      metadata: { customerName },
    });
  }

  // 3. Welcome Email
  async sendWelcomeEmail({ to, customerName, loginUrl }) {
    const template = templates.welcomeEmailTemplate({ customerName, loginUrl });
    return this.send({
      to,
      ...template,
      emailType: "welcome_email",
      metadata: { customerName },
    });
  }

  // 4. Order Confirmation
  async sendOrderConfirmation({ to, customerName, orderNumber, totalAmount }) {
    const template = templates.orderConfirmationTemplate({ customerName, orderNumber, totalAmount });
    return this.send({
      to,
      ...template,
      emailType: "order_confirmation",
      metadata: { customerName, orderNumber },
    });
  }

  // 5. Payment Success
  async sendPaymentSuccess({ to, customerName, orderNumber, amount }) {
    const template = templates.paymentSuccessTemplate({ customerName, orderNumber, amount });
    return this.send({
      to,
      ...template,
      emailType: "payment_success",
      metadata: { customerName, orderNumber, amount },
    });
  }

  // 6. Payment Failure
  async sendPaymentFailure({ to, customerName, orderNumber, reason }) {
    const template = templates.paymentFailureTemplate({ customerName, orderNumber, reason });
    return this.send({
      to,
      ...template,
      emailType: "payment_failure",
      metadata: { customerName, orderNumber, reason },
    });
  }

  // 7. Shipment Dispatched Update
  async sendShipmentUpdate({ to, customerName, orderNumber, carrier, trackingNumber, trackingUrl }) {
    const template = templates.shipmentUpdateTemplate({
      customerName,
      orderNumber,
      carrier,
      trackingNumber,
      trackingUrl,
    });
    return this.send({
      to,
      ...template,
      emailType: "shipment_update",
      metadata: { customerName, orderNumber, carrier, trackingNumber },
    });
  }

  // 8. Delivery Confirmation
  async sendDeliveryConfirmation({ to, customerName, orderNumber }) {
    const template = templates.deliveryConfirmationTemplate({ customerName, orderNumber });
    return this.send({
      to,
      ...template,
      emailType: "delivery_confirmation",
      metadata: { customerName, orderNumber },
    });
  }

  // 9. Order Cancellation
  async sendCancellation({ to, customerName, orderNumber, reason }) {
    const template = templates.orderCancellationTemplate({ customerName, orderNumber, reason });
    return this.send({
      to,
      ...template,
      emailType: "order_cancellation",
      metadata: { customerName, orderNumber, reason },
    });
  }

  // 10. Return Status Update
  async sendReturnUpdate({ to, customerName, orderNumber, returnStatus }) {
    const template = templates.returnUpdateTemplate({ customerName, orderNumber, returnStatus });
    return this.send({
      to,
      ...template,
      emailType: "return_update",
      metadata: { customerName, orderNumber, returnStatus },
    });
  }

  // 11. Refund Update
  async sendRefundUpdate({ to, customerName, orderNumber, amount }) {
    const template = templates.refundConfirmationTemplate({ customerName, orderNumber, amount });
    return this.send({
      to,
      ...template,
      emailType: "refund_update",
      metadata: { customerName, orderNumber, amount },
    });
  }

  // 12. Support Notification
  async sendSupportNotification({ to, recipientName, ticketNumber, subject, message }) {
    const template = templates.supportNotificationTemplate({ recipientName, ticketNumber, subject, message });
    return this.send({
      to,
      ...template,
      emailType: "support_notification",
      metadata: { recipientName, ticketNumber, subject },
    });
  }

  // 13. Vendor Notification
  async sendVendorNotification({ to, vendorName, subject, message }) {
    const template = templates.vendorNotificationTemplate({ vendorName, subject, message });
    return this.send({
      to,
      ...template,
      emailType: "vendor_notification",
      metadata: { vendorName, subject },
    });
  }

  // 14. Vendor Approved
  async sendVendorApprovedEmail({ to, vendorName, storeName, dashboardUrl }) {
    const template = templates.vendorApprovedTemplate({ vendorName, storeName, dashboardUrl });
    return this.send({
      to,
      ...template,
      emailType: "vendor_approved",
      metadata: { vendorName, storeName },
    });
  }

  // 15. Vendor Rejected
  async sendVendorRejectedEmail({ to, vendorName, storeName, reason }) {
    const template = templates.vendorRejectedTemplate({ vendorName, storeName, reason });
    return this.send({
      to,
      ...template,
      emailType: "vendor_rejected",
      metadata: { vendorName, storeName, reason },
    });
  }

  // 16. Vendor Changes Requested
  async sendVendorChangesRequestedEmail({ to, vendorName, storeName, reason, portalUrl }) {
    const template = templates.vendorChangesRequestedTemplate({ vendorName, storeName, reason, portalUrl });
    return this.send({
      to,
      ...template,
      emailType: "vendor_changes_requested",
      metadata: { vendorName, storeName, reason },
    });
  }
}

module.exports = EmailService;