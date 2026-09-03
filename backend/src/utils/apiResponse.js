const sendSuccess = (
  res,
  {
    statusCode = 200,
    message = "Success",
    data = null,
    meta = undefined,
  } = {}
) => {
  const response = {
    success: true,
    message,
    data,
  };

  if (meta !== undefined) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};

module.exports = {
  sendSuccess,
};
