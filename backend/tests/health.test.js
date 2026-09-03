const request = require("supertest");

const app = require("../src/app");

describe("Health API", () => {
  it("should return a healthy API response", async () => {
    const response = await request(app)
      .get("/health")
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      message: "Buybox API is healthy",
      data: {
        status: "ok",
      },
    });
  });
});