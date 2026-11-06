const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const courierService = require("../services/courier.service");

const handleWebhook = asyncHandler(async (req, res) => {
  const { provider } = req.params;

  // Preserve exact unparsed request bytes for cryptographic HMAC verification
  const rawBody = req.rawBody || (Buffer.isBuffer(req.body) ? req.body : null);

  const result = await courierService.handleWebhook({
    provider,
    headers: req.headers,
    body: req.body,
    rawBody,
  });

  return sendSuccess(res, {
    statusCode: 200,
    message: "Courier webhook processed successfully",
    data: result,
  });
});

module.exports = {
  handleWebhook,
};
