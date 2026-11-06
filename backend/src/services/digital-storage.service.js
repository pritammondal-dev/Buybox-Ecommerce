const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const AppError = require("../errors/AppError");
const logger = require("../config/logger");

const STORAGE_DIR = path.resolve(__dirname, "../../storage/digital-assets");

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// Disallowed executable / dangerous extensions
const DANGEROUS_EXTENSIONS = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".bash",
  ".php",
  ".phtml",
  ".js",
  ".mjs",
  ".cjs",
  ".py",
  ".pl",
  ".cgi",
  ".vbs",
  ".msi",
  ".jar",
  ".com",
  ".scr",
  ".dll",
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Validate upload constraints
 */
const validateUploadFile = (file) => {
  if (!file || (!file.buffer && !file.path)) {
    throw new AppError("No file provided for digital asset upload", 400, "NO_FILE_PROVIDED");
  }

  const originalName = file.originalname || "unnamed_asset";
  const ext = path.extname(originalName).toLowerCase();

  if (DANGEROUS_EXTENSIONS.has(ext)) {
    throw new AppError(
      `File type '${ext}' is not permitted for digital asset uploads for security reasons`,
      400,
      "DISALLOWED_FILE_TYPE"
    );
  }

  const size = file.size || (file.buffer ? file.buffer.length : 0);
  if (size > MAX_FILE_SIZE) {
    throw new AppError(
      `File size exceeds maximum allowed limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      400,
      "FILE_TOO_LARGE"
    );
  }

  return { originalName, ext, size };
};

/**
 * Resolve and verify safe file path to prevent path traversal
 */
const resolveSafePath = (storageKey) => {
  if (!storageKey || typeof storageKey !== "string") {
    throw new AppError("Invalid storage key", 400, "INVALID_STORAGE_KEY");
  }

  // Prevent path traversal
  const safeFilename = path.basename(storageKey);
  const resolvedPath = path.resolve(STORAGE_DIR, safeFilename);

  if (!resolvedPath.startsWith(STORAGE_DIR)) {
    throw new AppError("Path traversal attempt detected", 403, "PATH_TRAVERSAL_DETECTED");
  }

  return resolvedPath;
};

/**
 * Save a digital file buffer into private storage
 */
const saveDigitalAsset = async (file, metadata = {}) => {
  const { originalName, ext, size } = validateUploadFile(file);

  const randomId = crypto.randomBytes(12).toString("hex");
  const timestamp = Date.now();
  const storageKey = `dgt_${timestamp}_${randomId}${ext}`;
  const buffer = file.buffer || fs.readFileSync(file.path);
  const checksum = crypto.createHash("sha256").update(buffer).digest("hex");

  const storageService = require("./storage");
  const isS3 = storageService.getStorageProviderName() === "s3";

  if (isS3) {
    const s3Asset = await storageService.uploadDigitalAsset({
      filename: storageKey,
      buffer,
      mimeType: file.mimetype || "application/octet-stream",
      metadata: {
        ...metadata,
        fileName: originalName,
        name: path.basename(originalName, ext) || originalName,
      },
    });

    return {
      id: `asset_${randomId}`,
      name: path.basename(originalName, ext) || originalName,
      fileName: originalName,
      storageKey: s3Asset.storageKey,
      storageProvider: "s3",
      fileSize: size,
      mimeType: file.mimetype || "application/octet-stream",
      checksum,
      version: metadata.version || "1.0",
      uploadedAt: new Date(),
    };
  }

  const targetPath = resolveSafePath(storageKey);
  await fs.promises.writeFile(targetPath, buffer);

  logger.info("Saved digital asset securely", {
    storageKey,
    size,
    mimeType: file.mimetype || "application/octet-stream",
  });

  return {
    id: `asset_${randomId}`,
    name: path.basename(originalName, ext) || originalName,
    fileName: originalName,
    storageKey,
    storageProvider: "local",
    fileSize: size,
    mimeType: file.mimetype || "application/octet-stream",
    checksum,
    version: metadata.version || "1.0",
    uploadedAt: new Date(),
  };
};

/**
 * Get read stream for downloading digital asset
 */
const getDigitalAssetStream = async (storageKey) => {
  const storageService = require("./storage");
  const isS3 = storageService.getStorageProviderName() === "s3";

  // Check local disk first (for backward compatibility and local development)
  try {
    const filePath = resolveSafePath(storageKey);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const stream = fs.createReadStream(filePath);
      return {
        stream,
        size: stats.size,
      };
    }
  } catch (err) {
    if (!isS3) {
      throw err;
    }
  }

  if (isS3) {
    const s3Result = await storageService.getDigitalAssetStream(storageKey);
    return {
      stream: s3Result.stream,
      size: s3Result.size,
    };
  }

  throw new AppError("Digital asset file not found on storage", 404, "DIGITAL_FILE_NOT_FOUND");
};

/**
 * Check if digital file exists
 */
const assetExists = async (storageKey) => {
  try {
    const filePath = resolveSafePath(storageKey);
    if (fs.existsSync(filePath)) return true;
  } catch {
    //
  }

  const storageService = require("./storage");
  if (storageService.getStorageProviderName() === "s3") {
    return storageService.assetExists(storageKey, true);
  }

  return false;
};

/**
 * Delete a digital asset safely
 */
const deleteDigitalAsset = async (storageKey) => {
  let deleted = false;
  try {
    const filePath = resolveSafePath(storageKey);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      logger.info("Deleted digital asset file locally", { storageKey });
      deleted = true;
    }
  } catch (err) {
    // Local deletion error ignored if in S3 mode
  }

  const storageService = require("./storage");
  if (storageService.getStorageProviderName() === "s3") {
    const s3Deleted = await storageService.deleteDigitalAsset(storageKey);
    deleted = deleted || s3Deleted;
  }

  return deleted;
};

/**
 * Get short-lived signed URL for digital download if S3 provider is active
 */
const getDigitalAssetSignedUrl = async (storageKey, options = {}) => {
  const storageService = require("./storage");
  return storageService.getDigitalAssetSignedUrl(storageKey, options);
};

module.exports = {
  STORAGE_DIR,
  saveDigitalAsset,
  getDigitalAssetStream,
  getDigitalAssetSignedUrl,
  assetExists,
  deleteDigitalAsset,
  resolveSafePath,
};
