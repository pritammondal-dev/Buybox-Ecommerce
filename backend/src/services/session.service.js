const RefreshToken = require("../models/RefreshToken");

const revokeAllUserSessions = async ({
  userId,
  ipAddress = null,
}) => {
  const result = await RefreshToken.updateMany(
    {
      userId,
      revokedAt: null,
    },
    {
      $set: {
        revokedAt: new Date(),
        revokedByIp: ipAddress,
      },
    }
  );

  return {
    revokedSessions: result.modifiedCount,
  };
};

module.exports = {
  revokeAllUserSessions,
};