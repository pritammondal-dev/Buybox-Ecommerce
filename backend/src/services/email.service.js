const ElasticEmailProvider = require("../integrations/email/elastic-email.provider");

class EmailService {
  constructor(provider = new ElasticEmailProvider()) {
    this.provider = provider;
  }

  async send({ to, subject, html, text, replyTo }) {
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
    });
  }
}

module.exports = EmailService;