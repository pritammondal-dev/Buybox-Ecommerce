const returnRequestService = require("../services/return-request.service");
const apiResponse = require("../utils/apiResponse");
const AppError = require("../errors/AppError");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const checkEligibility = async (req, res) => {
  const result = await returnRequestService.checkOrderReturnEligibility({
    orderId: req.params.orderId,
    userId: req.user.id || req.user._id,
  });

  return apiResponse.sendSuccess(res, {
    message: "Return and exchange eligibility calculated successfully",
    data: result,
  });
};

const uploadEvidence = async (req, res) => {
  const rawFiles = [];
  if (req.files) {
    if (Array.isArray(req.files.images)) rawFiles.push(...req.files.images);
    if (Array.isArray(req.files.file)) rawFiles.push(...req.files.file);
    if (Array.isArray(req.files)) rawFiles.push(...req.files);
  } else if (req.file) {
    rawFiles.push(req.file);
  }

  if (rawFiles.length === 0) {
    throw new AppError("No evidence file provided", 400, "FILE_REQUIRED");
  }

  if (rawFiles.length > 5) {
    throw new AppError("You can upload a maximum of 5 evidence photographs", 400, "TOO_MANY_FILES");
  }

  const uploadDir = path.resolve(__dirname, "../../public/uploads/returns");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
  const allowedExts = [".jpg", ".jpeg", ".png", ".webp"];
  const uploadedImages = [];

  for (const f of rawFiles) {
    const { originalname, mimetype, buffer, size } = f;
    const ext = path.extname(originalname || "").toLowerCase();
    const normalizedMime = mimetype ? mimetype.toLowerCase() : "";

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
    if (size > MAX_FILE_SIZE) {
      throw new AppError(`File '${originalname}' exceeds the 5MB file size limit`, 400, "FILE_TOO_LARGE");
    }

    if (
      normalizedMime === "image/svg+xml" ||
      ext === ".svg" ||
      (buffer && buffer.slice(0, 200).toString("utf8").toLowerCase().includes("<svg"))
    ) {
      throw new AppError("SVG files are not permitted for security reasons.", 400, "SVG_NOT_ALLOWED");
    }

    if (buffer && buffer.length >= 2) {
      if (buffer[0] === 0x4d && buffer[1] === 0x5a) {
        throw new AppError("Executable files are not permitted.", 400, "EXECUTABLE_NOT_ALLOWED");
      }
      if (buffer[0] === 0x7f && buffer.slice(1, 4).toString("ascii") === "ELF") {
        throw new AppError("Executable files are not permitted.", 400, "EXECUTABLE_NOT_ALLOWED");
      }
      const head = buffer.slice(0, 100).toString("utf8").toLowerCase();
      if (head.includes("<!doctype html") || head.includes("<html") || head.includes("<script")) {
        throw new AppError("HTML and script files are not permitted.", 400, "UNSUPPORTED_FILE_TYPE");
      }
    }

    if (!allowedMimes.includes(normalizedMime) || !allowedExts.includes(ext)) {
      throw new AppError(
        `File '${originalname}' has an invalid format. Allowed formats: PNG, JPEG, WebP`,
        400,
        "INVALID_FILE_TYPE"
      );
    }

    const filename = `evidence_${Date.now()}_${crypto.randomBytes(6).toString("hex")}${ext}`;
    const filepath = path.join(uploadDir, filename);
    fs.writeFileSync(filepath, buffer);

    const publicUrl = `/uploads/returns/${filename}`;
    uploadedImages.push({
      url: publicUrl,
      filename,
      size,
      mimetype: normalizedMime,
    });
  }

  return apiResponse.sendSuccess(res, {
    statusCode: 201,
    message: `${uploadedImages.length} evidence photograph(s) uploaded successfully`,
    data: {
      images: uploadedImages.map((img) => img.url),
      files: uploadedImages,
      url: uploadedImages[0]?.url,
      filename: uploadedImages[0]?.filename,
      size: uploadedImages[0]?.size,
      mimetype: uploadedImages[0]?.mimetype,
    },
  });
};

const createReturn = async (req, res) => {
  const newReturn = await returnRequestService.createReturnRequest({
    userId: req.user.id || req.user._id,
    orderId: req.body.orderId,
    type: req.body.type,
    items: req.body.items,
    reason: req.body.reason,
    description: req.body.description || req.body.customerNotes,
    orderItemId: req.body.orderItemId,
    idempotencyKey: req.body.idempotencyKey,
    customerNotes: req.body.customerNotes || req.body.description,
    replacementVariantId: req.body.replacementVariantId,
    images: req.body.images,
    pickupAddress: req.body.pickupAddress,
    refundMethod: req.body.refundMethod,
    bankDetails: req.body.bankDetails,
  });

  return apiResponse.sendSuccess(res, {
    statusCode: 201,
    message: "Return request submitted successfully",
    data: newReturn,
  });
};

const getCustomerReturnById = async (req, res) => {
  const returnReq = await returnRequestService.getCustomerReturnById({
    returnId: req.params.id,
    userId: req.user.id || req.user._id,
  });

  return apiResponse.sendSuccess(res, {
    message: "Return request retrieved successfully",
    data: returnReq,
  });
};

const getMyReturns = async (req, res) => {
  const returns = await returnRequestService.getCustomerReturns(req.user.id || req.user._id);

  return apiResponse.sendSuccess(res, {
    message: "Return requests retrieved successfully",
    data: returns,
  });
};

const getReturnsByOrderId = async (req, res) => {
  const returns = await returnRequestService.getReturnByOrderId(
    req.params.orderId,
    req.user.id || req.user._id
  );

  return apiResponse.sendSuccess(res, {
    message: "Order return history retrieved successfully",
    data: returns,
  });
};

const getMyVendorReturns = async (req, res) => {
  const result = await returnRequestService.getMyVendorReturns({
    userId: req.user.id,
    query: req.query,
  });

  return apiResponse.sendSuccess(res, {
    message: "Vendor return requests retrieved successfully",
    data: result.items,
    meta: result.meta,
  });
};

const getMyVendorReturnById = async (req, res) => {
  const returnReq = await returnRequestService.getMyVendorReturnById({
    userId: req.user.id,
    returnId: req.params.returnId,
  });

  return apiResponse.sendSuccess(res, {
    message: "Vendor return request retrieved successfully",
    data: returnReq,
  });
};

const approveReturn = async (req, res) => {
  const isAdmin =
    req.user?.role === "admin" ||
    req.user?.role === "super_admin" ||
    req.user?.roles?.includes?.("admin") ||
    req.user?.roles?.includes?.("super_admin");
  const returnReq = await returnRequestService.approveReturnRequest({
    userId: req.user.id || req.user._id,
    returnId: req.params.returnId || req.params.id,
    notes: req.body.notes || req.body.note,
    strict: false,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
    isAdmin,
  });

  return apiResponse.sendSuccess(res, {
    message: "Return request approved successfully",
    data: returnReq,
  });
};

const rejectReturn = async (req, res) => {
  const isAdmin =
    req.user?.role === "admin" ||
    req.user?.role === "super_admin" ||
    req.user?.roles?.includes?.("admin") ||
    req.user?.roles?.includes?.("super_admin");
  const returnReq = await returnRequestService.rejectReturnRequest({
    userId: req.user.id || req.user._id,
    returnId: req.params.returnId || req.params.id,
    reason: req.body.reason || req.body.note || "Rejected by merchant",
    notes: req.body.notes,
    strict: false,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
    isAdmin,
  });

  return apiResponse.sendSuccess(res, {
    message: "Return request rejected successfully",
    data: returnReq,
  });
};

const schedulePickup = async (req, res) => {
  const isAdmin =
    req.user?.role === "admin" ||
    req.user?.role === "super_admin" ||
    req.user?.roles?.includes?.("admin") ||
    req.user?.roles?.includes?.("super_admin");
  const returnReq = await returnRequestService.scheduleReversePickup({
    userId: req.user.id || req.user._id,
    returnId: req.params.returnId || req.params.id,
    scheduledDate: req.body.scheduledDate,
    timeSlot: req.body.timeSlot,
    carrier: req.body.carrier,
    notes: req.body.notes,
    strict: false,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
    isAdmin,
  });

  return apiResponse.sendSuccess(res, {
    message: "Reverse courier pickup scheduled successfully",
    data: returnReq,
  });
};

const confirmPickup = async (req, res) => {
  const isAdmin =
    req.user?.role === "admin" ||
    req.user?.role === "super_admin" ||
    req.user?.roles?.includes?.("admin") ||
    req.user?.roles?.includes?.("super_admin");
  const returnReq = await returnRequestService.confirmReversePickup({
    userId: req.user.id || req.user._id,
    returnId: req.params.returnId || req.params.id,
    notes: req.body.notes,
    strict: false,
    isAdmin,
  });

  return apiResponse.sendSuccess(res, {
    message: "Reverse pickup confirmed successfully",
    data: returnReq,
  });
};

const receiveReturn = async (req, res) => {
  const isAdmin =
    req.user?.role === "admin" ||
    req.user?.role === "super_admin" ||
    req.user?.roles?.includes?.("admin") ||
    req.user?.roles?.includes?.("super_admin");
  const returnReq = await returnRequestService.receiveReturnAndRestock({
    userId: req.user.id || req.user._id,
    returnId: req.params.returnId || req.params.id,
    warehouseId: req.body.warehouseId,
    notes: req.body.notes || req.body.note,
    strict: false,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
    isAdmin,
    restock: req.body.restock,
    items: req.body.items,
  });

  return apiResponse.sendSuccess(res, {
    message: "Return received and restocked successfully",
    data: returnReq,
  });
};

const inspectReturn = async (req, res) => {
  const isAdmin =
    req.user?.role === "admin" ||
    req.user?.role === "super_admin" ||
    req.user?.roles?.includes?.("admin") ||
    req.user?.roles?.includes?.("super_admin");
  const returnReq = await returnRequestService.inspectReturnRequest({
    userId: req.user.id || req.user._id,
    returnId: req.params.returnId || req.params.id,
    passed: req.body.passed,
    outcome: req.body.outcome,
    notes: req.body.notes || req.body.note,
    items: req.body.items,
    strict: false,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
    isAdmin,
    restock: req.body.restock,
    warehouseId: req.body.warehouseId,
  });

  return apiResponse.sendSuccess(res, {
    message: "Return request inspected successfully",
    data: returnReq,
  });
};

const fulfillExchange = async (req, res) => {
  const isAdmin =
    req.user?.role === "admin" ||
    req.user?.role === "super_admin" ||
    req.user?.roles?.includes?.("admin") ||
    req.user?.roles?.includes?.("super_admin");
  const returnReq = await returnRequestService.fulfillExchangeRequest({
    userId: req.user.id || req.user._id,
    returnId: req.params.returnId || req.params.id,
    replacementVariantId: req.body.replacementVariantId,
    warehouseId: req.body.warehouseId,
    notes: req.body.notes,
    strict: false,
    isAdmin,
  });

  return apiResponse.sendSuccess(res, {
    message: "Exchange replacement dispatched and fulfilled successfully",
    data: returnReq,
  });
};

const refundReturn = async (req, res) => {
  const isAdmin =
    req.user?.role === "admin" ||
    req.user?.role === "super_admin" ||
    req.user?.roles?.includes?.("admin") ||
    req.user?.roles?.includes?.("super_admin");
  const returnReq = await returnRequestService.processReturnRefund({
    userId: req.user.id || req.user._id,
    returnId: req.params.returnId || req.params.id,
    notes: req.body.notes || req.body.note,
    bankReference: req.body.bankReference,
    strict: !isAdmin,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
    isAdmin,
  });

  return apiResponse.sendSuccess(res, {
    message: "Return refund processed successfully",
    data: returnReq,
  });
};

const getAdminReturns = async (req, res) => {
  const result = await returnRequestService.getAdminReturns({
    query: req.query,
  });

  return apiResponse.sendSuccess(res, {
    message: "Admin return requests retrieved successfully",
    data: result.items,
    meta: result.meta,
  });
};

const getAdminReturnById = async (req, res) => {
  const returnReq = await returnRequestService.getAdminReturnById(req.params.id);

  return apiResponse.sendSuccess(res, {
    message: "Return request details retrieved successfully",
    data: returnReq,
  });
};

const cancelReturn = async (req, res) => {
  const isAdmin =
    req.user?.role === "admin" ||
    req.user?.role === "super_admin" ||
    req.user?.roles?.includes?.("admin") ||
    req.user?.roles?.includes?.("super_admin");
  const returnReq = await returnRequestService.cancelReturnRequest({
    userId: req.user.id || req.user._id,
    returnId: req.params.returnId || req.params.id,
    reason: req.body.reason || req.body.notes,
    strict: false,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
    isAdmin,
  });

  return apiResponse.sendSuccess(res, {
    message: "Return request cancelled successfully",
    data: returnReq,
  });
};

module.exports = {
  checkEligibility,
  uploadEvidence,
  createReturn,
  getCustomerReturnById,
  getMyReturns,
  getReturnsByOrderId,
  getMyVendorReturns,
  getMyVendorReturnById,
  approveReturn,
  rejectReturn,
  schedulePickup,
  confirmPickup,
  cancelReturn,
  inspectReturn,
  fulfillExchange,
  receiveReturn,
  refundReturn,
  getAdminReturns,
  getAdminReturnById,
};
