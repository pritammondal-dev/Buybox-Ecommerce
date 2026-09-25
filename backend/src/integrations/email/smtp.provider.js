const nodemailer = require("nodemailer");
const EmailProvider = require("./email.provider");
const env = require("../../config/env");
const EmailLog = require("../../models/EmailLog");

class SmtpProvider extends EmailProvider {
  /**
   * Resolve SMTP credentials from runtime options, environment, or defaults
   */
  resolveCredentials(runtimeOptions = {}) {
    const host =
      runtimeOptions.host ||
      env.SMTP_HOST ||
      process.env.SMTP_HOST ||
      "";

    const port = Number(
      runtimeOptions.port ||
      env.SMTP_PORT ||
      process.env.SMTP_PORT ||
      587
    );

    const secure = Boolean(
      runtimeOptions.secure !== undefined
        ? runtimeOptions.secure
        : (env.SMTP_SECURE || process.env.SMTP_SECURE === "true" || port === 465)
    );

    const user =
      runtimeOptions.user ||
      env.SMTP_USER ||
      process.env.SMTP_USER ||
      "";

    const pass =
      runtimeOptions.pass ||
      env.SMTP_PASS ||
      process.env.SMTP_PASS ||
      "";

    const fromEmail =
      runtimeOptions.fromEmail ||
      env.SMTP_FROM_EMAIL ||
      process.env.SMTP_FROM_EMAIL ||
      user ||
      "noreply@buybox.com";

    const fromName =
      runtimeOptions.fromName ||
      env.SMTP_FROM_NAME ||
      process.env.SMTP_FROM_NAME ||
      "Buybox";

    const replyTo =
      runtimeOptions.replyTo ||
      env.SMTP_REPLY_TO ||
      process.env.SMTP_REPLY_TO ||
      fromEmail;

    return { host, port, secure, user, pass, fromEmail, fromName, replyTo };
  }

  async send({
    to,
    subject,
    html,
    text,
    replyTo,
    emailType = "transactional",
    metadata = {},
    runtimeCredentials,
  }) {
    if (!to) {
      throw new Error("Email recipient is required");
    }

    if (!subject) {
      throw new Error("Email subject is required");
    }

    if (!html && !text) {
      throw new Error("Email content is required");
    }

    const recipients = Array.isArray(to) ? to : [to];
    const normalizedRecipients = recipients
      .map((e) => String(e).trim())
      .filter(Boolean);

    if (normalizedRecipients.length === 0) {
      throw new Error("At least one valid email recipient is required");
    }

    const creds = this.resolveCredentials(runtimeCredentials);

    // If SMTP host or user not configured
    if (!creds.host || !creds.user) {
      if (
        (process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined) &&
        !runtimeCredentials?.simulateFailure
      ) {
        return {
          success: true,
          messageId: `test-smtp-simulated-${Date.now()}`,
          status: "simulated_test",
        };
      }

      const failureReason = "SMTP host or user not configured in environment";

      try {
        await EmailLog.create({
          recipient: normalizedRecipients[0],
          emailType,
          provider: "smtp",
          status: "failed",
          failureReason,
          metadata,
        });
      } catch {
        // Logging is best-effort
      }

      return {
        success: false,
        error: failureReason,
        status: "not_configured",
      };
    }

    try {
      const transporter = nodemailer.createTransport({
        host: creds.host,
        port: creds.port,
        secure: creds.secure,
        auth: {
          user: creds.user,
          pass: creds.pass,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });

      const info = await transporter.sendMail({
        from: `"${creds.fromName}" <${creds.fromEmail}>`,
        to: normalizedRecipients.join(", "),
        replyTo: replyTo || creds.replyTo,
        subject,
        text,
        html,
      });

      const messageId = info.messageId || null;

      try {
        await EmailLog.create({
          recipient: normalizedRecipients[0],
          emailType,
          provider: "smtp",
          providerMessageId: messageId,
          status: "sent",
          metadata,
        });
      } catch {
        // Best effort
      }

      return {
        success: true,
        messageId,
        status: "sent",
        response: info.response,
      };
    } catch (err) {
      const safeError = `SMTP dispatch error: ${err.message?.slice(0, 200) || "Transmission failed"}`;

      try {
        await EmailLog.create({
          recipient: normalizedRecipients[0],
          emailType,
          provider: "smtp",
          status: "failed",
          failureReason: safeError,
          metadata,
        });
      } catch {
        // Best effort
      }

      return {
        success: false,
        error: safeError,
        status: "failed",
      };
    }
  }
}

module.exports = SmtpProvider;
