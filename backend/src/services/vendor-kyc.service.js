const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Vendor = require("../models/Vendor");
const AppError = require("../errors/AppError");
const {
  uploadDigitalAsset,
  getDigitalAssetStream,
} = require("./storage");
const { recordAuditLog } = require("./governance.service");

const MAX_KYC_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_KYC_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const ALLOWED_KYC_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];

/**
 * Validates file buffer magic bytes for security against malicious uploads
 */
function validateKycFileMagicBytes(buffer, mimeType) {
  if (!buffer || buffer.length < 4) return false;

  // PDF: %PDF- (0x25, 0x50, 0x44, 0x46)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return mimeType === "application/pdf";
  }

  // PNG: 89 50 4E 47
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return mimeType === "image/png";
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return mimeType === "image/jpeg";
  }

  // WebP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return mimeType === "image/webp";
  }

  return false;
}

/**
 * Validates KYC document file
 */
function validateKycFile(file) {
  if (!file || !file.buffer) {
    throw new AppError("No document file uploaded. Please select a valid document.", 400, "MISSING_FILE");
  }

  const { originalname, mimetype, size, buffer } = file;
  const ext = path.extname(originalname).toLowerCase();
  const normalizedMime = mimetype ? mimetype.toLowerCase() : "";

  // Strict check: reject SVG and executable files
  if (
    normalizedMime === "image/svg+xml" ||
    ext === ".svg" ||
    buffer.slice(0, 100).toString("utf8").toLowerCase().includes("<svg")
  ) {
    throw new AppError(
      "SVG uploads are not permitted for security reasons (XSS risk). Please upload PDF, JPEG, PNG, or WebP.",
      400,
      "SVG_NOT_ALLOWED"
    );
  }

  // Executable inspection (MZ header for PE, ELF, bash script shebang)
  if (
    (buffer[0] === 0x4d && buffer[1] === 0x5a) || // MZ Windows PE
    (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) || // ELF
    (buffer[0] === 0x23 && buffer[1] === 0x21) // Shebang #!
  ) {
    throw new AppError("Executable files are strictly disallowed.", 400, "EXECUTABLE_NOT_ALLOWED");
  }

  if (size > MAX_KYC_FILE_SIZE) {
    throw new AppError(
      `File size exceeds 5MB limit. Uploaded file is ${(size / (1024 * 1024)).toFixed(2)}MB.`,
      400,
      "FILE_TOO_LARGE"
    );
  }

  if (!ALLOWED_KYC_MIMES.includes(normalizedMime)) {
    throw new AppError(
      "Invalid file type. Allowed formats: PDF, JPEG, PNG, and WebP.",
      400,
      "INVALID_FILE_TYPE"
    );
  }

  if (!ALLOWED_KYC_EXTENSIONS.includes(ext)) {
    throw new AppError(
      "Invalid file extension. Allowed extensions: .pdf, .jpg, .jpeg, .png, .webp.",
      400,
      "INVALID_FILE_EXTENSION"
    );
  }

  if (!validateKycFileMagicBytes(buffer, normalizedMime)) {
    throw new AppError(
      "Corrupted or invalid document signature. File content does not match expected format.",
      400,
      "CORRUPT_OR_INVALID_FILE"
    );
  }
}

/**
 * Recompute overall vendor KYC status based on individual document statuses
 */
function computeOverallKycStatus(kycDocuments = []) {
  if (!kycDocuments || kycDocuments.length === 0) {
    return "not_submitted";
  }

  const REQUIRED_CATEGORIES = [
    "identity_proof",
    "business_registration",
    "tax_id",
    "address_proof",
  ];

  const hasAnyRejected = kycDocuments.some((doc) => doc.status === "rejected");
  if (hasAnyRejected) {
    return "rejected";
  }

  const hasAnyUnderReview = kycDocuments.some((doc) => doc.status === "under_review");
  if (hasAnyUnderReview) {
    return "under_review";
  }

  const approvedCategories = new Set(
    kycDocuments
      .filter((doc) => doc.status === "approved")
      .map((doc) => doc.documentCategory)
  );

  const allRequiredApproved = REQUIRED_CATEGORIES.every((cat) =>
    approvedCategories.has(cat)
  );

  if (allRequiredApproved) {
    return "approved";
  }

  return "pending";
}

class VendorKycService {
  /**
   * Upload or resubmit a vendor KYC document
   */
  async uploadKycDocument({
    userId,
    file,
    documentCategory,
    documentType,
    documentNumber,
    req,
  }) {
    validateKycFile(file);

    const vendor = await Vendor.findOne({ userId, deletedAt: null });
    if (!vendor) {
      throw new AppError("Vendor profile not found", 404, "VENDOR_NOT_FOUND");
    }

    const beforeState = vendor.toObject();
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBase = crypto.randomBytes(12).toString("hex");
    const safeFilename = `kyc_${vendor._id}_${documentCategory}_${safeBase}${ext}`;

    // Store in protected private digital assets directory
    const uploadResult = await uploadDigitalAsset({
      filename: safeFilename,
      buffer: file.buffer,
      mimeType: file.mimetype,
      metadata: {
        vendorId: vendor._id.toString(),
        documentCategory,
        documentType,
      },
    });

    const storageKey = uploadResult.key || safeFilename;

    // Check if a document in this category already exists
    const existingDocIndex = vendor.kycDocuments.findIndex(
      (d) => d.documentCategory === documentCategory
    );

    if (existingDocIndex >= 0) {
      const existingDoc = vendor.kycDocuments[existingDocIndex];

      // Archive prior submission to resubmissionHistory
      const priorHistoryEntry = {
        storageKey: existingDoc.storageKey,
        fileOriginalName: existingDoc.fileOriginalName,
        fileSize: existingDoc.fileSize,
        mimeType: existingDoc.mimeType,
        documentNumber: existingDoc.documentNumber,
        submittedAt: existingDoc.submittedAt,
        reviewedAt: existingDoc.reviewedAt,
        reviewedBy: existingDoc.reviewedBy,
        rejectionReason: existingDoc.rejectionReason,
      };

      existingDoc.resubmissionHistory = existingDoc.resubmissionHistory || [];
      existingDoc.resubmissionHistory.push(priorHistoryEntry);

      // Overwrite current doc with newly uploaded asset
      existingDoc.storageKey = storageKey;
      existingDoc.fileOriginalName = file.originalname;
      existingDoc.fileSize = file.size;
      existingDoc.mimeType = file.mimetype;
      existingDoc.documentType = documentType || existingDoc.documentType;
      existingDoc.documentNumber = documentNumber !== undefined ? documentNumber : existingDoc.documentNumber;
      existingDoc.status = "pending";
      existingDoc.submittedAt = new Date();
      existingDoc.reviewedAt = null;
      existingDoc.reviewedBy = null;
      existingDoc.rejectionReason = null;
    } else {
      vendor.kycDocuments.push({
        documentCategory,
        documentType,
        documentNumber: documentNumber || null,
        storageKey,
        fileOriginalName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        status: "pending",
        submittedAt: new Date(),
        reviewedAt: null,
        reviewedBy: null,
        rejectionReason: null,
        resubmissionHistory: [],
      });
    }

    vendor.kycStatus = computeOverallKycStatus(vendor.kycDocuments);
    await vendor.save();

    await recordAuditLog({
      actorId: userId,
      targetId: vendor._id,
      action: "VENDOR_KYC_DOCUMENT_UPLOADED",
      entityType: "Vendor",
      beforeState,
      afterState: vendor.toObject(),
      req,
    });

    const targetDoc = vendor.kycDocuments.find(
      (d) => d.documentCategory === documentCategory
    );

    return {
      kycStatus: vendor.kycStatus,
      documentCategory,
      documentType,
      status: "pending",
      fileOriginalName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      document: targetDoc ? targetDoc.toObject() : null,
    };
  }

  /**
   * Get KYC status & submitted document metadata for current authenticated vendor
   */
  async getMyKycDetails(userId) {
    const vendor = await Vendor.findOne({ userId, deletedAt: null }).lean();
    if (!vendor) {
      throw new AppError("Vendor profile not found", 404, "VENDOR_NOT_FOUND");
    }

    const safeDocuments = (vendor.kycDocuments || []).map((doc) => ({
      _id: doc._id,
      documentCategory: doc.documentCategory,
      documentType: doc.documentType,
      documentNumber: doc.documentNumber,
      fileOriginalName: doc.fileOriginalName,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      status: doc.status,
      submittedAt: doc.submittedAt,
      reviewedAt: doc.reviewedAt,
      rejectionReason: doc.rejectionReason,
      resubmissionCount: (doc.resubmissionHistory || []).length,
    }));

    return {
      kycStatus: vendor.kycStatus || "not_submitted",
      documents: safeDocuments,
      vendor: {
        businessName: vendor.businessName,
        businessSlug: vendor.businessSlug,
        onboardingStatus: vendor.onboardingStatus,
      },
    };
  }

  /**
   * Securely stream KYC document with strict tenant isolation and staff authorization
   */
  async downloadKycDocument({
    vendorId,
    documentId,
    actorUserId,
    isStaff = false,
  }) {
    let vendor;
    if (isStaff) {
      vendor = await Vendor.findById(vendorId);
    } else {
      vendor = await Vendor.findOne({ userId: actorUserId, deletedAt: null });
    }

    if (!vendor) {
      throw new AppError("Vendor profile not found or access denied", 404, "VENDOR_NOT_FOUND");
    }

    // Tenant boundary check: if vendorId was specified for a non-staff actor, ensure match
    if (!isStaff && vendorId && vendor._id.toString() !== vendorId.toString()) {
      throw new AppError("Access denied. You cannot view other merchants' documents.", 403, "TENANT_ACCESS_DENIED");
    }

    const document = vendor.kycDocuments.id(documentId);
    if (!document) {
      throw new AppError("KYC document not found", 404, "DOCUMENT_NOT_FOUND");
    }

    const streamResult = await getDigitalAssetStream(document.storageKey);

    return {
      stream: streamResult.stream,
      mimeType: document.mimeType,
      fileOriginalName: document.fileOriginalName,
      fileSize: document.fileSize,
    };
  }

  /**
   * Operational Review: Approve or Reject a vendor KYC document
   */
  async reviewKycDocument({
    vendorId,
    documentId,
    status,
    rejectionReason,
    reviewerId,
    req,
  }) {
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
    }

    const document = vendor.kycDocuments.id(documentId);
    if (!document) {
      throw new AppError("KYC document not found on this vendor profile", 404, "DOCUMENT_NOT_FOUND");
    }

    const beforeState = vendor.toObject();

    document.status = status;
    document.reviewedAt = new Date();
    document.reviewedBy = reviewerId;
    document.rejectionReason = status === "rejected" ? rejectionReason : null;

    vendor.kycStatus = computeOverallKycStatus(vendor.kycDocuments);
    await vendor.save();

    await recordAuditLog({
      actorId: reviewerId,
      targetId: vendor._id,
      action: status === "approved" ? "VENDOR_KYC_DOCUMENT_APPROVED" : "VENDOR_KYC_DOCUMENT_REJECTED",
      entityType: "Vendor",
      reason: rejectionReason || null,
      beforeState,
      afterState: vendor.toObject(),
      req,
    });

    return {
      vendorId: vendor._id,
      kycStatus: vendor.kycStatus,
      document: {
        _id: document._id,
        documentCategory: document.documentCategory,
        documentType: document.documentType,
        status: document.status,
        reviewedAt: document.reviewedAt,
        rejectionReason: document.rejectionReason,
      },
    };
  }

  /**
   * List KYC verification queue across all merchants for operations staff
   */
  async listKycReviewQueue({
    page = 1,
    limit = 20,
    status,
    search,
  }) {
    const filter = { deletedAt: null };

    if (status && status !== "all") {
      filter.kycStatus = status;
    } else {
      // Exclude merchants who haven't submitted anything yet
      filter.kycStatus = { $in: ["pending", "under_review", "approved", "rejected"] };
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [
        { businessName: regex },
        { businessSlug: regex },
        { supportEmail: regex },
        { phone: regex },
      ];
    }

    const skip = (page - 1) * limit;

    const [vendors, total] = await Promise.all([
      Vendor.find(filter)
        .select(
          "businessName businessSlug kycStatus onboardingStatus createdAt updatedAt kycDocuments phone supportEmail"
        )
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Vendor.countDocuments(filter),
    ]);

    const formattedQueue = vendors.map((v) => {
      const docs = v.kycDocuments || [];
      const pendingCount = docs.filter((d) => d.status === "pending").length;
      const approvedCount = docs.filter((d) => d.status === "approved").length;
      const rejectedCount = docs.filter((d) => d.status === "rejected").length;

      return {
        _id: v._id,
        businessName: v.businessName,
        businessSlug: v.businessSlug,
        kycStatus: v.kycStatus,
        onboardingStatus: v.onboardingStatus,
        phone: v.phone,
        supportEmail: v.supportEmail,
        documentStats: {
          total: docs.length,
          pending: pendingCount,
          approved: approvedCount,
          rejected: rejectedCount,
        },
        documents: docs.map((d) => ({
          _id: d._id,
          documentCategory: d.documentCategory,
          documentType: d.documentType,
          status: d.status,
          fileOriginalName: d.fileOriginalName,
          fileSize: d.fileSize,
          submittedAt: d.submittedAt,
          reviewedAt: d.reviewedAt,
          rejectionReason: d.rejectionReason,
        })),
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      };
    });

    return {
      queue: formattedQueue,
      items: formattedQueue,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  validateKycFile(file) {
    return validateKycFile(file);
  }
}

const serviceInstance = new VendorKycService();
serviceInstance.validateKycFile = validateKycFile;

module.exports = serviceInstance;
