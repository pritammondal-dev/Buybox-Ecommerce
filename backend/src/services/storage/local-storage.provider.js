const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const AppError = require("../../errors/AppError");
const logger = require("../../config/logger");

const BACKEND_UPLOADS_DIR = path.resolve(__dirname, "../../../public/uploads");
const FRONTEND_UPLOADS_DIR = path.resolve(__dirname, "../../../../frontend/public/uploads");
const DIGITAL_STORAGE_DIR = path.resolve(__dirname, "../../../storage/digital-assets");

// Ensure directories exist
function ensureDirectories() {
  if (!fs.existsSync(BACKEND_UPLOADS_DIR)) {
    fs.mkdirSync(BACKEND_UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(FRONTEND_UPLOADS_DIR)) {
    try {
      fs.mkdirSync(FRONTEND_UPLOADS_DIR, { recursive: true });
    } catch {
      // Ignored
    }
  }
  if (!fs.existsSync(DIGITAL_STORAGE_DIR)) {
    fs.mkdirSync(DIGITAL_STORAGE_DIR, { recursive: true });
  }
}

ensureDirectories();

class LocalStorageProvider {
  constructor() {
    this.name = "local";
    ensureDirectories();
  }

  /**
   * Resolve safe path for digital asset to prevent path traversal
   */
  resolveDigitalPath(storageKey) {
    if (!storageKey || typeof storageKey !== "string") {
      throw new AppError("Invalid storage key", 400, "INVALID_STORAGE_KEY");
    }

    if (storageKey.includes("..") || /[\0\r\n\t]/.test(storageKey)) {
      throw new AppError("Path traversal attempt detected", 403, "PATH_TRAVERSAL_DETECTED");
    }

    const cleanKey = storageKey.replace(/^digital-assets[\\/]/, "");
    const safeFilename = path.basename(cleanKey);
    const resolvedPath = path.resolve(DIGITAL_STORAGE_DIR, safeFilename);

    if (!resolvedPath.startsWith(DIGITAL_STORAGE_DIR)) {
      throw new AppError("Path traversal attempt detected", 403, "PATH_TRAVERSAL_DETECTED");
    }

    return resolvedPath;
  }

  /**
   * Resolve safe path for public upload to prevent path traversal
   */
  resolvePublicPath(keyOrUrl) {
    if (!keyOrUrl || typeof keyOrUrl !== "string") {
      throw new AppError("Invalid media key or URL", 400, "INVALID_MEDIA_KEY");
    }

    if (keyOrUrl.includes("..") || /[\0\r\n\t]/.test(keyOrUrl)) {
      throw new AppError("Path traversal attempt detected", 403, "PATH_TRAVERSAL_DETECTED");
    }

    const cleanKey = keyOrUrl.replace(/^\/?uploads[\\/]/, "");
    const safeFilename = path.basename(cleanKey);
    const resolvedPath = path.resolve(BACKEND_UPLOADS_DIR, safeFilename);

    if (!resolvedPath.startsWith(BACKEND_UPLOADS_DIR)) {
      throw new AppError("Path traversal attempt detected", 403, "PATH_TRAVERSAL_DETECTED");
    }

    return resolvedPath;
  }

  /**
   * Save public media asset (e.g. product image, banner)
   */
  async savePublicMedia({ filename, buffer, mimeType, prefix = "uploads" }) {
    ensureDirectories();

    const safeFilename = path.basename(filename);
    const backendFilePath = path.join(BACKEND_UPLOADS_DIR, safeFilename);
    const frontendFilePath = path.join(FRONTEND_UPLOADS_DIR, safeFilename);

    await fs.promises.writeFile(backendFilePath, buffer);

    try {
      await fs.promises.writeFile(frontendFilePath, buffer);
    } catch {
      // Gracefully continue if frontend public directory is not accessible directly
    }

    const key = `${prefix}/${safeFilename}`.replace(/^\/+/, "");
    const url = `/uploads/${safeFilename}`;

    return {
      key,
      url,
      storageProvider: "local",
      size: buffer.length,
      mimeType,
      filename: safeFilename,
    };
  }

  /**
   * Save private digital asset
   */
  async saveDigitalAsset({ filename, buffer, mimeType, metadata = {} }) {
    ensureDirectories();

    const targetPath = this.resolveDigitalPath(filename);
    const checksum = crypto.createHash("sha256").update(buffer).digest("hex");

    await fs.promises.writeFile(targetPath, buffer);

    const randomId = crypto.randomBytes(8).toString("hex");
    const originalName = metadata.fileName || metadata.originalName || filename;
    const ext = path.extname(originalName);

    logger.info("Saved digital asset to local private storage", {
      storageKey: filename,
      size: buffer.length,
      mimeType,
    });

    return {
      id: `asset_${randomId}`,
      name: metadata.name || path.basename(originalName, ext) || originalName,
      fileName: originalName,
      storageKey: filename,
      storageProvider: "local",
      fileSize: buffer.length,
      mimeType: mimeType || "application/octet-stream",
      checksum,
      version: metadata.version || "1.0",
      uploadedAt: new Date(),
    };
  }

  /**
   * Get digital asset stream
   */
  async getDigitalAssetStream(storageKey) {
    const filePath = this.resolveDigitalPath(storageKey);

    if (!fs.existsSync(filePath)) {
      throw new AppError("Digital asset file not found on local storage", 404, "DIGITAL_FILE_NOT_FOUND");
    }

    const stats = await fs.promises.stat(filePath);
    const stream = fs.createReadStream(filePath);

    return {
      stream,
      size: stats.size,
      mimeType: "application/octet-stream",
    };
  }

  /**
   * For local storage, returns null as local downloads must flow through authorized streaming
   */
  async getDigitalAssetSignedUrl(_storageKey, _options = {}) {
    return null;
  }

  /**
   * Delete public media file safely
   */
  async deletePublicMedia(keyOrUrl) {
    try {
      const filePath = this.resolvePublicPath(keyOrUrl);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        logger.info("Deleted public media from local storage", { keyOrUrl });
        return true;
      }
    } catch (err) {
      logger.warn("Failed to delete local public media file", { keyOrUrl, error: err.message });
    }
    return false;
  }

  /**
   * Delete digital asset safely
   */
  async deleteDigitalAsset(storageKey) {
    try {
      const filePath = this.resolveDigitalPath(storageKey);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        logger.info("Deleted digital asset from local storage", { storageKey });
        return true;
      }
    } catch (err) {
      logger.warn("Failed to delete local digital asset file", { storageKey, error: err.message });
    }
    return false;
  }

  /**
   * Check if asset exists
   */
  async assetExists(key, isPrivate = false) {
    try {
      const filePath = isPrivate ? this.resolveDigitalPath(key) : this.resolvePublicPath(key);
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }
}

module.exports = LocalStorageProvider;
