const request = require("supertest");
const app = require("../src/app");

describe("CORS Hardening Contract (Phase 9)", () => {
  it("1. allows requests from frontend port http://localhost:3000 with credentials", async () => {
    const response = await request(app)
      .get("/api/v1/health")
      .set("Origin", "http://localhost:3000");

    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000"
    );
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("2. dynamically allows other dev localhost ports in development mode", async () => {
    const response = await request(app)
      .get("/api/v1/health")
      .set("Origin", "http://localhost:3001");

    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3001"
    );
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("3. handles preflight OPTIONS requests properly", async () => {
    const response = await request(app)
      .options("/api/v1/cart/items")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "Content-Type,Authorization");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000"
    );
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect(response.headers["access-control-allow-methods"]).toMatch(
      /GET,.*POST/
    );
  });

  it("4. blocks untrusted external origins from receiving CORS headers", async () => {
    const response = await request(app)
      .get("/api/v1/health")
      .set("Origin", "http://malicious-site.com");

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
