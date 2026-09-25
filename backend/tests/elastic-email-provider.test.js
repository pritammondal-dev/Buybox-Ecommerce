const ElasticEmailProvider = require("../src/integrations/email/elastic-email.provider");
const SmtpProvider = require("../src/integrations/email/smtp.provider");
const EmailService = require("../src/services/email.service");

describe("ElasticEmailProvider & EmailService Architecture Suite", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("1. Provider Selection Integrity", () => {
    it("resolves to ElasticEmailProvider by default", () => {
      delete process.env.EMAIL_PROVIDER;
      const service = new EmailService();
      expect(service.provider).toBeInstanceOf(ElasticEmailProvider);
    });

    it("resolves to ElasticEmailProvider when EMAIL_PROVIDER=elastic_email", () => {
      process.env.EMAIL_PROVIDER = "elastic_email";
      const service = new EmailService();
      expect(service.provider).toBeInstanceOf(ElasticEmailProvider);
    });

    it("resolves to ElasticEmailProvider when EMAIL_PROVIDER=elasticemail", () => {
      process.env.EMAIL_PROVIDER = "elasticemail";
      const service = new EmailService();
      expect(service.provider).toBeInstanceOf(ElasticEmailProvider);
    });

    it("does not select SmtpProvider when SMTP_HOST is present if EMAIL_PROVIDER is elastic_email", () => {
      process.env.EMAIL_PROVIDER = "elastic_email";
      process.env.SMTP_HOST = "smtp.example.com";
      const service = new EmailService();
      expect(service.provider).toBeInstanceOf(ElasticEmailProvider);
    });
  });

  describe("2. Request Payload & API Endpoint Construction", () => {
    it("constructs compliant Elastic Email v4 transactional payload and headers", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          TransactionID: "tx-test-12345",
          MessageID: "msg-test-67890",
        }),
      });
      global.fetch = mockFetch;

      const provider = new ElasticEmailProvider();
      const result = await provider.send({
        to: "customer@example.com",
        subject: "Verify Your Email",
        html: "<p>Your code is 123456</p>",
        text: "Your code is 123456",
        runtimeCredentials: {
          apiKey: "test-elastic-key-123",
          fromEmail: "noreply@buybox.test",
          fromName: "Buybox Test",
        },
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("tx-test-12345");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.elasticemail.com/v4/emails/transactional");
      expect(options.method).toBe("POST");
      expect(options.headers["Content-Type"]).toBe("application/json");
      expect(options.headers["X-ElasticEmail-ApiKey"]).toBe("test-elastic-key-123");

      const parsedBody = JSON.parse(options.body);
      expect(parsedBody.Recipients.To).toEqual(["customer@example.com"]);
      expect(parsedBody.Content.From).toBe("noreply@buybox.test");
      expect(parsedBody.Content.FromName).toBe("Buybox Test");
      expect(parsedBody.Content.Subject).toBe("Verify Your Email");
      expect(parsedBody.Content.Body).toHaveLength(2);
      expect(parsedBody.Content.Body[0]).toEqual({
        ContentType: "HTML",
        Content: "<p>Your code is 123456</p>",
        Charset: "utf-8",
      });
      expect(parsedBody.Content.Body[1]).toEqual({
        ContentType: "PlainText",
        Content: "Your code is 123456",
        Charset: "utf-8",
      });
    });
  });

  describe("3. Safe Diagnostic Error Classification", () => {
    it("correctly identifies ACCESS_DENIED on 400 with 'Access Denied.'", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ Error: "Access Denied." }),
      });

      const provider = new ElasticEmailProvider();
      const result = await provider.send({
        to: "john.doe@example.com",
        subject: "Test Subject",
        text: "Test content",
        runtimeCredentials: {
          apiKey: "real-looking-key-string",
          fromEmail: "test@buybox.test",
        },
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("ACCESS_DENIED");
      expect(result.statusCode).toBe(400);
      expect(result.diagnostics.recipient).toBe("j***@example.com");
      expect(result.diagnostics.errorCode).toBe("ACCESS_DENIED");
      // Never leaks key in diagnostics
      expect(JSON.stringify(result)).not.toContain("real-looking-key-string");
    });

    it("correctly identifies API_KEY_EXPIRED on 400 with 'APIKey Expired'", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ Error: "APIKey Expired" }),
      });

      const provider = new ElasticEmailProvider();
      const result = await provider.send({
        to: "sarah.connor@example.com",
        subject: "Test Subject",
        text: "Test content",
        runtimeCredentials: {
          apiKey: "expired-key",
          fromEmail: "test@buybox.test",
        },
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("API_KEY_EXPIRED");
      expect(result.diagnostics.recipient).toBe("s***@example.com");
    });

    it("correctly identifies AUTHENTICATION_FAILED on HTTP 401 or 403", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });

      const provider = new ElasticEmailProvider();
      const result = await provider.send({
        to: "user@example.com",
        subject: "Test",
        text: "Content",
        runtimeCredentials: {
          apiKey: "invalid-key",
          fromEmail: "test@buybox.test",
        },
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("AUTHENTICATION_FAILED");
      expect(result.statusCode).toBe(401);
    });

    it("correctly identifies SENDER_REJECTED when sender domain is unverified", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ Error: "Sender domain not verified." }),
      });

      const provider = new ElasticEmailProvider();
      const result = await provider.send({
        to: "user@example.com",
        subject: "Test",
        text: "Content",
        runtimeCredentials: {
          apiKey: "valid-key",
          fromEmail: "unverified@gmail.com",
        },
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("SENDER_REJECTED");
    });

    it("correctly handles network exceptions safely", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("ENOTFOUND api.elasticemail.com"));

      const provider = new ElasticEmailProvider();
      const result = await provider.send({
        to: "user@example.com",
        subject: "Test",
        text: "Content",
        runtimeCredentials: {
          apiKey: "valid-key",
          fromEmail: "test@buybox.test",
        },
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("NETWORK_ERROR");
      expect(result.error).toContain("ENOTFOUND");
    });
  });
});
