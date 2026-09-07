const orderConfirmationTemplate = ({
  customerName,
  orderNumber,
}) => ({
  subject: `Order confirmation - ${orderNumber}`,

  html: `
    <h2>Thank you for your order, ${customerName || "Customer"}!</h2>
    <p>Your order <strong>${orderNumber}</strong> has been received successfully.</p>
    <p>We will notify you when your order status changes.</p>
  `,

  text: `
Thank you for your order, ${customerName || "Customer"}!

Your order ${orderNumber} has been received successfully.

We will notify you when your order status changes.
  `.trim(),
});

const paymentConfirmationTemplate = ({
  customerName,
  orderNumber,
  amount,
}) => ({
  subject: `Payment confirmed - ${orderNumber}`,

  html: `
    <h2>Payment confirmed</h2>
    <p>Hello ${customerName || "Customer"},</p>
    <p>Your payment for order <strong>${orderNumber}</strong> has been confirmed.</p>
    <p>Amount paid: <strong>${amount}</strong></p>
  `,

  text: `
Payment confirmed

Hello ${customerName || "Customer"},

Your payment for order ${orderNumber} has been confirmed.

Amount paid: ${amount}
  `.trim(),
});

const orderStatusTemplate = ({
  customerName,
  orderNumber,
  status,
}) => ({
  subject: `Order ${orderNumber} status update`,

  html: `
    <h2>Order status updated</h2>
    <p>Hello ${customerName || "Customer"},</p>
    <p>Your order <strong>${orderNumber}</strong> is now <strong>${status}</strong>.</p>
  `,

  text: `
Order status updated

Hello ${customerName || "Customer"},

Your order ${orderNumber} is now ${status}.
  `.trim(),
});

const orderCancellationTemplate = ({
  customerName,
  orderNumber,
}) => ({
  subject: `Order cancelled - ${orderNumber}`,

  html: `
    <h2>Order cancelled</h2>
    <p>Hello ${customerName || "Customer"},</p>
    <p>Your order <strong>${orderNumber}</strong> has been cancelled.</p>
  `,

  text: `
Order cancelled

Hello ${customerName || "Customer"},

Your order ${orderNumber} has been cancelled.
  `.trim(),
});

const refundConfirmationTemplate = ({
  customerName,
  orderNumber,
  amount,
}) => ({
  subject: `Refund confirmed - ${orderNumber}`,

  html: `
    <h2>Refund confirmed</h2>
    <p>Hello ${customerName || "Customer"},</p>
    <p>Your refund for order <strong>${orderNumber}</strong> has been processed.</p>
    <p>Refund amount: <strong>${amount}</strong></p>
  `,

  text: `
Refund confirmed

Hello ${customerName || "Customer"},

Your refund for order ${orderNumber} has been processed.

Refund amount: ${amount}
  `.trim(),
});

const emailVerificationTemplate = ({
  customerName,
  verificationUrl,
}) => ({
  subject: "Verify your Buybox account",

  html: `
    <h2>Verify your account</h2>
    <p>Hello ${customerName || "Customer"},</p>
    <p>Please verify your Buybox account using the link below:</p>
    <p><a href="${verificationUrl}">Verify your email</a></p>
  `,

  text: `
Verify your Buybox account

Hello ${customerName || "Customer"},

Please verify your Buybox account using this link:

${verificationUrl}
  `.trim(),
});

const passwordResetTemplate = ({
  customerName,
  resetUrl,
}) => ({
  subject: "Reset your Buybox password",

  html: `
    <h2>Password reset</h2>
    <p>Hello ${customerName || "Customer"},</p>
    <p>Use the link below to reset your password:</p>
    <p><a href="${resetUrl}">Reset password</a></p>
    <p>If you did not request this, you can safely ignore this email.</p>
  `,

  text: `
Password reset

Hello ${customerName || "Customer"},

Use the link below to reset your password:

${resetUrl}

If you did not request this, you can safely ignore this email.
  `.trim(),
});

module.exports = {
  orderConfirmationTemplate,
  paymentConfirmationTemplate,
  orderStatusTemplate,
  orderCancellationTemplate,
  refundConfirmationTemplate,
  emailVerificationTemplate,
  passwordResetTemplate,
};