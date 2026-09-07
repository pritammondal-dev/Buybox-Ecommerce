const emailService = require("../integrations/email");

const {
  orderConfirmationTemplate,
  paymentConfirmationTemplate,
  orderStatusTemplate,
  orderCancellationTemplate,
  refundConfirmationTemplate,
  emailVerificationTemplate,
  passwordResetTemplate,
} = require("./notification.templates");

class NotificationService {
  async sendEmail({ to, subject, html, text, replyTo }) {
    return emailService.send({
      to,
      subject,
      html,
      text,
      replyTo,
    });
  }

  async sendOrderConfirmation({
    to,
    customerName,
    orderNumber,
  }) {
    const template = orderConfirmationTemplate({
      customerName,
      orderNumber,
    });

    return this.sendEmail({
      to,
      ...template,
    });
  }

  async sendPaymentConfirmation({
    to,
    customerName,
    orderNumber,
    amount,
  }) {
    const template = paymentConfirmationTemplate({
      customerName,
      orderNumber,
      amount,
    });

    return this.sendEmail({
      to,
      ...template,
    });
  }

  async sendOrderStatusUpdate({
    to,
    customerName,
    orderNumber,
    status,
  }) {
    const template = orderStatusTemplate({
      customerName,
      orderNumber,
      status,
    });

    return this.sendEmail({
      to,
      ...template,
    });
  }

  async sendOrderCancellation({
    to,
    customerName,
    orderNumber,
  }) {
    const template = orderCancellationTemplate({
      customerName,
      orderNumber,
    });

    return this.sendEmail({
      to,
      ...template,
    });
  }

  async sendRefundConfirmation({
    to,
    customerName,
    orderNumber,
    amount,
  }) {
    const template = refundConfirmationTemplate({
      customerName,
      orderNumber,
      amount,
    });

    return this.sendEmail({
      to,
      ...template,
    });
  }

  async sendEmailVerification({
    to,
    customerName,
    verificationUrl,
  }) {
    const template = emailVerificationTemplate({
      customerName,
      verificationUrl,
    });

    return this.sendEmail({
      to,
      ...template,
    });
  }

  async sendPasswordReset({
    to,
    customerName,
    resetUrl,
  }) {
    const template = passwordResetTemplate({
      customerName,
      resetUrl,
    });

    return this.sendEmail({
      to,
      ...template,
    });
  }
}

module.exports = NotificationService;

