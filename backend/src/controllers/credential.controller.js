const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const CredentialService = require("../services/credential.service");

/**
 * Superadmin Credential Controller
 */
const listCredentials = asyncHandler(async (req, res) => {
  const credentials = await CredentialService.listMaskedCredentials();

  return sendSuccess(res, {
    statusCode: 200,
    message: "Platform credentials retrieved successfully",
    data: {
      credentials,
    },
  });
});

const updateCredentials = asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const payload = req.body;

  const result = await CredentialService.updateCredentials({
    provider,
    payload,
    actorId: req.user.id,
    ipAddress: req.ip,
    userAgent: req.get("user-agent") || null,
  });

  return sendSuccess(res, {
    statusCode: 200,
    message: `Credentials for ${provider} updated successfully`,
    data: {
      credential: result,
    },
  });
});

const testCredential = asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const { recipientEmail } = req.body || {};

  const testResult = await CredentialService.testCredential({
    provider,
    recipientEmail,
    actorId: req.user.id,
  });

  return sendSuccess(res, {
    statusCode: testResult.success ? 200 : 400,
    message: testResult.message,
    data: testResult,
  });
});

module.exports = {
  listCredentials,
  updateCredentials,
  testCredential,
};
