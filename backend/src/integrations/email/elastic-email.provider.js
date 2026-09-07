const EmailProvider = require("./email.provider");
const env = require("../../config/env");

class ElasticEmailProvider extends EmailProvider {
  async send({ to, subject, html, text, replyTo }) {
    if (!env.ELASTIC_EMAIL_API_KEY) {
      throw new Error("Elastic Email API key is not configured");
    }

    if (!env.ELASTIC_EMAIL_FROM_EMAIL) {
      throw new Error(
        "Elastic Email sender email is not configured"
      );
    }

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
      .map((email) => String(email).trim())
      .filter(Boolean);

    if (normalizedRecipients.length === 0) {
      throw new Error("At least one valid email recipient is required");
    }

    const body = {
      Recipients: {
        To: normalizedRecipients,
      },

      Content: {
        From: env.ELASTIC_EMAIL_FROM_EMAIL,
        FromName: env.ELASTIC_EMAIL_FROM_NAME,
        Subject: subject,
        Body: [],
      },
    };

    if (html) {
      body.Content.Body.push({
        ContentType: "HTML",
        Content: html,
        Charset: "utf-8",
      });
    }

    if (text) {
      body.Content.Body.push({
        ContentType: "PlainText",
        Content: text,
        Charset: "utf-8",
      });
    }

    if (replyTo) {
      body.Content.ReplyTo = replyTo;
    }

    const response = await fetch(
      "https://api.elasticemail.com/v4/emails/transactional",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-ElasticEmail-ApiKey":
            env.ELASTIC_EMAIL_API_KEY,
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `Elastic Email request failed (${response.status}): ${errorText}`
      );
    }

    return response.json();
  }
}

module.exports = ElasticEmailProvider;

