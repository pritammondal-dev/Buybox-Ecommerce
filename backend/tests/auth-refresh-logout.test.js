const request = require("supertest");
const app = require("../src/app");
const tokenService = require("../src/services/token.service");
const refreshTokenService = require("../src/services/refresh-token.service");

jest.mock("../src/services/refresh-token.service");
jest.mock("../src/models/RefreshToken");

describe("Auth Refresh and Logout Endpoint Contracts", () => {
  const mockUserId = "64b0f0000000000000000001";
  const validToken = "valid.refresh.token.jwt";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/v1/auth/refresh", () => {
    it("1. successfully refreshes using cookie-only authentication", async () => {
      refreshTokenService.rotateRefreshToken.mockResolvedValue({
        accessToken: "new-access-token-123",
        refreshToken: "new-rotated-refresh-token-456",
      });

      const response = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [`refreshToken=${validToken}`])
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBe("new-access-token-123");
      expect(refreshTokenService.rotateRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshToken: validToken,
        })
      );
      // Verify rotated refresh cookie was set
      const cookies = response.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.startsWith("refreshToken="))).toBe(true);
    });

    it("2. successfully refreshes using body-token authentication", async () => {
      refreshTokenService.rotateRefreshToken.mockResolvedValue({
        accessToken: "new-access-token-789",
        refreshToken: "new-rotated-refresh-token-012",
      });

      const response = await request(app)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: validToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBe("new-access-token-789");
      expect(refreshTokenService.rotateRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshToken: validToken,
        })
      );
    });

    it("3. rejects refresh when neither cookie nor body contains a token", async () => {
      const response = await request(app)
        .post("/api/v1/auth/refresh")
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe("VALIDATION_ERROR");
      expect(refreshTokenService.rotateRefreshToken).not.toHaveBeenCalled();
    });

    it("6a. rejects refresh when refresh token is invalid/revoked", async () => {
      const AppError = require("../src/errors/AppError");
      refreshTokenService.rotateRefreshToken.mockRejectedValue(
        new AppError("Invalid or expired refresh token", 401, "INVALID_REFRESH_TOKEN")
      );

      const response = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", ["refreshToken=invalid-token"])
        .send({})
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe("INVALID_REFRESH_TOKEN");
    });
  });

  describe("POST /api/v1/auth/logout", () => {
    it("4. successfully logs out using cookie-only authentication", async () => {
      const RefreshToken = require("../src/models/RefreshToken");
      RefreshToken.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: "ref-1" });
      jest.spyOn(tokenService, "verifyRefreshToken").mockReturnValue({ sub: mockUserId });

      const response = await request(app)
        .post("/api/v1/auth/logout")
        .set("Cookie", [`refreshToken=${validToken}`])
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Logout successful");
      // Verify cookie is cleared
      const cookies = response.headers["set-cookie"];
      expect(cookies).toBeDefined();
    });

    it("5. rejects logout when neither cookie nor body contains a token", async () => {
      const response = await request(app)
        .post("/api/v1/auth/logout")
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe("VALIDATION_ERROR");
    });
  });
});
