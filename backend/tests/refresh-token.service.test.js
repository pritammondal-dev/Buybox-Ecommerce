const RefreshToken = require("../src/models/RefreshToken");
const User = require("../src/models/User");
const {
  generateRefreshToken,
  verifyAccessToken,
} = require("../src/services/token.service");
const {
  rotateRefreshToken,
} = require("../src/services/refresh-token.service");
const { hashToken } = require("../src/utils/token-hash");

jest.mock("../src/models/RefreshToken");
jest.mock("../src/models/User");

describe("Refresh Token Service - rotateRefreshToken Security", () => {
  const userId = "64b0f0000000000000000001";
  let validRefreshToken;
  let tokenHash;

  beforeEach(() => {
    jest.clearAllMocks();
    validRefreshToken = generateRefreshToken({ sub: userId });
    tokenHash = hashToken(validRefreshToken);
  });

  it("successfully rotates refresh token and includes user.role in new access token", async () => {
    const mockStoredToken = {
      _id: "stored-token-id-1",
      userId,
      tokenHash,
      revokedAt: null,
      replacedByTokenId: null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      save: jest.fn().mockResolvedValue(true),
    };

    const mockSelect = jest.fn().mockResolvedValue(mockStoredToken);
    RefreshToken.findOne.mockReturnValue({ select: mockSelect });

    User.findById.mockResolvedValue({
      _id: userId,
      role: "vendor",
      isActive: true,
    });

    const mockReplacement = {
      _id: "replacement-token-id-2",
      userId,
    };
    RefreshToken.create.mockResolvedValue(mockReplacement);

    const result = await rotateRefreshToken({
      refreshToken: validRefreshToken,
      ipAddress: "127.0.0.1",
      userAgent: "jest-agent",
    });

    expect(result).toHaveProperty("accessToken");
    expect(result).toHaveProperty("refreshToken");

    // Verify the newly generated access token contains the user's role
    const decodedAccess = verifyAccessToken(result.accessToken);
    expect(decodedAccess.sub).toBe(userId);
    expect(decodedAccess.role).toBe("vendor");

    // Verify storedToken was revoked and linked to replacement
    expect(mockStoredToken.revokedAt).toBeInstanceOf(Date);
    expect(mockStoredToken.replacedByTokenId).toBe("replacement-token-id-2");
    expect(mockStoredToken.save).toHaveBeenCalled();
  });

  it("rejects token rotation if the user account is inactive", async () => {
    const mockStoredToken = {
      _id: "stored-token-id-1",
      userId,
      tokenHash,
      revokedAt: null,
      replacedByTokenId: null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      save: jest.fn(),
    };

    const mockSelect = jest.fn().mockResolvedValue(mockStoredToken);
    RefreshToken.findOne.mockReturnValue({ select: mockSelect });

    User.findById.mockResolvedValue({
      _id: userId,
      role: "customer",
      isActive: false,
    });

    await expect(
      rotateRefreshToken({
        refreshToken: validRefreshToken,
        ipAddress: "127.0.0.1",
        userAgent: "jest-agent",
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "ACCOUNT_INACTIVE",
    });
  });

  it("rejects token rotation if the user does not exist", async () => {
    const mockStoredToken = {
      _id: "stored-token-id-1",
      userId,
      tokenHash,
      revokedAt: null,
      replacedByTokenId: null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      save: jest.fn(),
    };

    const mockSelect = jest.fn().mockResolvedValue(mockStoredToken);
    RefreshToken.findOne.mockReturnValue({ select: mockSelect });

    User.findById.mockResolvedValue(null);

    await expect(
      rotateRefreshToken({
        refreshToken: validRefreshToken,
        ipAddress: "127.0.0.1",
        userAgent: "jest-agent",
      })
    ).rejects.toMatchObject({
      statusCode: 401,
      code: "USER_NOT_FOUND",
    });
  });
});
