/**
 * Standardized Email Layout Wrapper
 */
const renderEmailLayout = ({ title, bodyHtml }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
    .wrapper { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background-color: #007A55; padding: 24px 32px; text-align: left; }
    .brand { color: #ffffff; font-size: 22px; font-weight: 800; text-decoration: none; letter-spacing: -0.5px; }
    .content { padding: 32px; font-size: 14px; line-height: 1.6; }
    .otp-box { background: #f0fdf4; border: 2px dashed #007A55; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
    .otp-code { font-family: 'Courier New', monospace; font-size: 36px; font-weight: 800; color: #007A55; letter-spacing: 8px; margin: 0; }
    .btn { display: inline-block; background-color: #007A55; color: #ffffff !important; font-weight: 700; text-decoration: none; padding: 12px 24px; border-radius: 9999px; margin-top: 16px; }
    .footer { background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <span class="brand">Buybox</span>
    </div>
    <div class="content">
      ${bodyHtml}
    </div>
    <div class="footer">
      <p style="margin: 0;">Buybox Marketplace Platform &copy; ${new Date().getFullYear()}. All rights reserved.</p>
      <p style="margin: 4px 0 0 0;">This is an automated transactional notification. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>
`;

// 1. Email Verification OTP Template
const emailVerificationOtpTemplate = ({ customerName, otp, expiresInMinutes = 10 }) => ({
  subject: `${otp} is your Buybox verification code`,
  html: renderEmailLayout({
    title: "Your verification code - Buybox",
    bodyHtml: `
      <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 0;">Your verification code</h2>
      <p>Hello ${customerName || "Customer"},</p>
      <p>Use the following one-time verification code to confirm your email address and activate your account:</p>
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
        <p style="font-size: 13px; color: #166534; margin: 8px 0 0 0; font-weight: 600;">This code expires in ${expiresInMinutes} minutes.</p>
      </div>
      <p style="color: #64748b; font-size: 13px; margin-bottom: 8px;">If you did not request this code, you can safely ignore this email.</p>
      <p style="color: #dc2626; font-size: 13px; font-weight: 600; margin-top: 0;">For your security, never share this verification code with anyone.</p>
    `,
  }),
  text: `
Buybox

Your verification code

${otp}

This code expires in ${expiresInMinutes} minutes.

If you did not request this code, you can safely ignore this email.

For your security, never share this verification code with anyone.
  `.trim(),
});

// 2. Password Reset OTP Template
const passwordResetOtpTemplate = ({ customerName, otp, expiresInMinutes = 10 }) => ({
  subject: `${otp} is your Buybox password reset code`,
  html: renderEmailLayout({
    title: "Password Reset - Buybox",
    bodyHtml: `
      <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 0;">Your verification code</h2>
      <p>Hello ${customerName || "Customer"},</p>
      <p>We received a request to reset your Buybox account password. Enter the code below to proceed:</p>
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
        <p style="font-size: 13px; color: #166534; margin: 8px 0 0 0; font-weight: 600;">This code expires in ${expiresInMinutes} minutes.</p>
      </div>
      <p style="color: #64748b; font-size: 13px; margin-bottom: 8px;">If you did not request this code, you can safely ignore this email. Your account remains secure.</p>
      <p style="color: #dc2626; font-size: 13px; font-weight: 600; margin-top: 0;">For your security, never share this verification code with anyone.</p>
    `,
  }),
  text: `
Buybox

Your verification code

${otp}

This code expires in ${expiresInMinutes} minutes.

If you did not request this code, you can safely ignore this email.

For your security, never share this verification code with anyone.
  `.trim(),
});

// 3. Welcome Email
const welcomeEmailTemplate = ({ customerName, loginUrl = "http://localhost:3000/auth/login" }) => ({
  subject: "Welcome to Buybox! Your account is verified",
  html: renderEmailLayout({
    title: "Welcome to Buybox",
    bodyHtml: `
      <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 0;">Welcome to Buybox, ${customerName || "Friend"}!</h2>
      <p>Your email has been successfully verified. You are now ready to explore millions of authentic products, exclusive daily deals, and lightning-fast fulfillment.</p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${loginUrl}" class="btn">Start Shopping Now</a>
      </div>
    `,
  }),
  text: `
Welcome to Buybox, ${customerName || "Friend"}!
Your email has been verified. Sign in at: ${loginUrl}
  `.trim(),
});

// 4. Order Confirmation
const orderConfirmationTemplate = ({ customerName, orderNumber, totalAmount = "₹0.00" }) => ({
  subject: `Order Confirmed: ${orderNumber}`,
  html: renderEmailLayout({
    title: `Order Confirmation - ${orderNumber}`,
    bodyHtml: `
      <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 0;">Order Confirmed!</h2>
      <p>Hello ${customerName || "Customer"},</p>
      <p>Thank you for your purchase. We have received your order <strong>${orderNumber}</strong> totaling <strong>${totalAmount}</strong>.</p>
      <p>We are currently preparing your shipment and will notify you with courier tracking information as soon as it departs our fulfillment center.</p>
    `,
  }),
  text: `Order Confirmed: ${orderNumber}\nTotal: ${totalAmount}\nWe are preparing your items.`.trim(),
});

// 5. Payment Success
const paymentSuccessTemplate = ({ customerName, orderNumber, amount }) => ({
  subject: `Payment Successful: ${orderNumber}`,
  html: renderEmailLayout({
    title: "Payment Receipt",
    bodyHtml: `
      <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 0;">Payment Received</h2>
      <p>Hello ${customerName || "Customer"},</p>
      <p>Your digital payment of <strong>${amount}</strong> for order <strong>${orderNumber}</strong> was successfully verified and captured.</p>
    `,
  }),
  text: `Payment Received for ${orderNumber}: ${amount}`.trim(),
});

// 6. Payment Failure
const paymentFailureTemplate = ({ customerName, orderNumber, reason }) => ({
  subject: `Action Required: Payment Failed for ${orderNumber}`,
  html: renderEmailLayout({
    title: "Payment Failed",
    bodyHtml: `
      <h2 style="font-size: 20px; font-weight: 800; color: #dc2626; margin-top: 0;">Payment Could Not Be Processed</h2>
      <p>Hello ${customerName || "Customer"},</p>
      <p>We were unable to complete your payment for order <strong>${orderNumber}</strong>.</p>
      <p style="color: #64748b; font-size: 13px;">Reason: ${reason || "The issuing bank declined the transaction."}</p>
      <p>Please return to your order checkout to retry with an alternate card or payment method.</p>
    `,
  }),
  text: `Payment Failed for ${orderNumber}: ${reason}`.trim(),
});

// 7. Shipment Update
const shipmentUpdateTemplate = ({ customerName, orderNumber, carrier, trackingNumber, trackingUrl }) => ({
  subject: `Your order ${orderNumber} is on the way!`,
  html: renderEmailLayout({
    title: "Shipment Dispatched",
    bodyHtml: `
      <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 0;">Your Items Have Shipped!</h2>
      <p>Hello ${customerName || "Customer"},</p>
      <p>Good news! Your order <strong>${orderNumber}</strong> has departed our regional fulfillment center via <strong>${carrier || "Courier"}</strong>.</p>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Tracking Number:</strong> ${trackingNumber || "N/A"}</p>
        <p style="margin: 0;"><strong>Carrier:</strong> ${carrier || "Standard Logistics"}</p>
      </div>
      ${trackingUrl ? `<div style="text-align: center;"><a href="${trackingUrl}" class="btn">Track Your Package</a></div>` : ""}
    `,
  }),
  text: `Order ${orderNumber} Shipped via ${carrier}. Tracking: ${trackingNumber}`.trim(),
});

// 8. Delivery Confirmation
const deliveryConfirmationTemplate = ({ customerName, orderNumber }) => ({
  subject: `Delivered: Order ${orderNumber}`,
  html: renderEmailLayout({
    title: "Order Delivered",
    bodyHtml: `
      <h2 style="font-size: 20px; font-weight: 800; color: #007A55; margin-top: 0;">Package Delivered!</h2>
      <p>Hello ${customerName || "Customer"},</p>
      <p>Your order <strong>${orderNumber}</strong> was successfully delivered to your shipping address.</p>
      <p>We hope you love your purchase! If you have any questions or require an exchange, our 24x7 support team is here to assist.</p>
    `,
  }),
  text: `Order ${orderNumber} Delivered! Thank you for shopping with Buybox.`.trim(),
});

// 9. Order Cancellation
const orderCancellationTemplate = ({ customerName, orderNumber, reason }) => ({
  subject: `Cancelled: Order ${orderNumber}`,
  html: renderEmailLayout({
    title: "Order Cancelled",
    bodyHtml: `
      <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 0;">Order Cancelled</h2>
      <p>Hello ${customerName || "Customer"},</p>
      <p>Your order <strong>${orderNumber}</strong> has been cancelled.</p>
      ${reason ? `<p style="color: #64748b; font-size: 13px;">Reason: ${reason}</p>` : ""}
      <p>If you have already paid for this order, your refund has been scheduled to your original payment method.</p>
    `,
  }),
  text: `Order ${orderNumber} Cancelled. Reason: ${reason || "N/A"}`.trim(),
});

// 10. Return Status Update
const returnUpdateTemplate = ({ customerName, orderNumber, returnStatus }) => ({
  subject: `Return Update: Order ${orderNumber} (${returnStatus})`,
  html: renderEmailLayout({
    title: "Return Status Update",
    bodyHtml: `
      <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 0;">Return Request ${returnStatus}</h2>
      <p>Hello ${customerName || "Customer"},</p>
      <p>Your return request for order <strong>${orderNumber}</strong> is currently updated to: <strong>${returnStatus}</strong>.</p>
    `,
  }),
  text: `Return update for ${orderNumber}: ${returnStatus}`.trim(),
});

// 11. Refund Update
const refundConfirmationTemplate = ({ customerName, orderNumber, amount }) => ({
  subject: `Refund Processed: ${orderNumber}`,
  html: renderEmailLayout({
    title: "Refund Processed",
    bodyHtml: `
      <h2 style="font-size: 20px; font-weight: 800; color: #007A55; margin-top: 0;">Refund Processed</h2>
      <p>Hello ${customerName || "Customer"},</p>
      <p>Your refund of <strong>${amount}</strong> for order <strong>${orderNumber}</strong> has been processed successfully.</p>
      <p>Funds typically reflect on your bank or card statement within 3–7 business days depending on your financial institution.</p>
    `,
  }),
  text: `Refund Processed for ${orderNumber}: ${amount}`.trim(),
});

// 12. Support Notification
const supportNotificationTemplate = ({ recipientName, ticketNumber, subject, message }) => ({
  subject: `[Support Ticket #${ticketNumber}] ${subject}`,
  html: renderEmailLayout({
    title: `Support Ticket #${ticketNumber}`,
    bodyHtml: `
      <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 0;">Support Ticket Update</h2>
      <p>Hello ${recipientName || "Customer"},</p>
      <p>Regarding ticket <strong>#${ticketNumber}</strong>: <em>${subject}</em></p>
      <div style="background: #f8fafc; border-left: 4px solid #007A55; padding: 16px; margin: 20px 0; font-size: 13px;">
        ${message}
      </div>
    `,
  }),
  text: `Ticket #${ticketNumber} - ${subject}\n\n${message}`.trim(),
});

// 13. Vendor Operational Notification
const vendorNotificationTemplate = ({ vendorName, subject, message }) => ({
  subject: `[Buybox Merchant Center] ${subject}`,
  html: renderEmailLayout({
    title: subject,
    bodyHtml: `
      <h2 style="font-size: 20px; font-weight: 800; color: #007A55; margin-top: 0;">Merchant Notice</h2>
      <p>Hello ${vendorName || "Partner"},</p>
      <div style="margin: 20px 0;">${message}</div>
    `,
  }),
  text: `Buybox Merchant Notice: ${subject}\n\n${message}`.trim(),
});

// 14. Vendor Approved
const vendorApprovedTemplate = ({ vendorName, storeName, dashboardUrl = "http://localhost:3000/vendor/dashboard" }) => ({
  subject: `🎉 Congratulations! Your Buybox Merchant Account is Approved`,
  html: renderEmailLayout({
    title: "Merchant Account Approved",
    bodyHtml: `
      <h2 style="font-size: 20px; font-weight: 800; color: #007A55; margin-top: 0;">Application Approved!</h2>
      <p>Hello ${vendorName || "Merchant Partner"},</p>
      <p>We are thrilled to inform you that your application for <strong>${storeName}</strong> has been officially approved by the Buybox Marketplace Operations Team.</p>
      <p>Your merchant console is now fully activated. You can now access your vendor dashboard, configure your store, manage inventory warehouses, and start listing your products.</p>
      <div style="margin: 24px 0;">
        <a href="${dashboardUrl}" class="btn" style="background-color: #007A55; color: #ffffff; padding: 12px 24px; border-radius: 9999px; text-decoration: none; font-weight: 700; display: inline-block;">Go to Vendor Dashboard</a>
      </div>
      <p style="color: #64748b; font-size: 13px;">If you have any questions during onboarding, reach out to your marketplace partner support team.</p>
    `,
  }),
  text: `Congratulations! Your Buybox Merchant Account for ${storeName} has been approved. Access your dashboard at: ${dashboardUrl}`.trim(),
});

// 15. Vendor Rejected
const vendorRejectedTemplate = ({ vendorName, storeName, reason }) => ({
  subject: `Update regarding your Buybox Merchant Application`,
  html: renderEmailLayout({
    title: "Application Status Update",
    bodyHtml: `
      <h2 style="font-size: 20px; font-weight: 800; color: #b91c1c; margin-top: 0;">Application Not Approved</h2>
      <p>Hello ${vendorName || "Merchant Applicant"},</p>
      <p>Thank you for your interest in partnering with Buybox. After reviewing your vendor application for <strong>${storeName}</strong>, our operations team was unable to approve your application at this time.</p>
      <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 20px 0; font-size: 13px; color: #991b1b;">
        <strong>Reason for rejection:</strong><br />
        ${reason || "Does not meet current marketplace listing criteria."}
      </div>
      <p style="color: #64748b; font-size: 13px;">If you believe this decision was made in error, or if your business status changes in the future, please contact marketplace support.</p>
    `,
  }),
  text: `Buybox Merchant Application Update: Your application for ${storeName} was not approved. Reason: ${reason}`.trim(),
});

// 16. Vendor Changes Requested
const vendorChangesRequestedTemplate = ({ vendorName, storeName, reason, portalUrl = "http://localhost:3000/vendor/store" }) => ({
  subject: `Action Required: Updates Requested for your Buybox Merchant Application`,
  html: renderEmailLayout({
    title: "Action Required: Merchant Application",
    bodyHtml: `
      <h2 style="font-size: 20px; font-weight: 800; color: #d97706; margin-top: 0;">Information Update Required</h2>
      <p>Hello ${vendorName || "Merchant Applicant"},</p>
      <p>Our operations team has reviewed your application for <strong>${storeName}</strong> and requires additional information or document updates before we can proceed with approval.</p>
      <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; font-size: 13px; color: #92400e;">
        <strong>Requested changes / Required information:</strong><br />
        ${reason}
      </div>
      <p>Please update your store profile and resubmit your application for review:</p>
      <div style="margin: 24px 0;">
        <a href="${portalUrl}" class="btn" style="background-color: #d97706; color: #ffffff; padding: 12px 24px; border-radius: 9999px; text-decoration: none; font-weight: 700; display: inline-block;">Update Store Profile & Resubmit</a>
      </div>
    `,
  }),
  text: `Action Required: Changes requested for Buybox Merchant Application (${storeName}). Details: ${reason}. Update profile at: ${portalUrl}`.trim(),
});

module.exports = {
  renderEmailLayout,
  emailVerificationOtpTemplate,
  passwordResetOtpTemplate,
  welcomeEmailTemplate,
  orderConfirmationTemplate,
  paymentSuccessTemplate,
  paymentFailureTemplate,
  shipmentUpdateTemplate,
  deliveryConfirmationTemplate,
  orderCancellationTemplate,
  returnUpdateTemplate,
  refundConfirmationTemplate,
  supportNotificationTemplate,
  vendorNotificationTemplate,
  vendorApprovedTemplate,
  vendorRejectedTemplate,
  vendorChangesRequestedTemplate,
};
