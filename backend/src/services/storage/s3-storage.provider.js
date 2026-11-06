const path = require("path");
const crypto = require("crypto");
const S3Client = require("./s3-client");
const AppError = require("../../errors/AppError");
const logger = require("../../config/logger");

class S3StorageProvider {
  constructor(config = {}) {
    this.name = "s3";
    this.bucket = config.bucket || process.env.S3_BUCKET || "";
    this.region = config.region || process.env.S3_REGION || "us-east-1";
    this.endpoint = config.endpoint || process.env.S3_ENDPOINT || "";
    this.accessKeyId = config.accessKeyId || process.env.S3_ACCESS_KEY_ID || "";
    this.secretAccessKey = config.secretAccessKey || process.env.S3_SECRET_ACCESS_KEY || "";
    this.publicBaseUrl = config.publicBaseUrl || process.env.S3_PUBLIC_BASE_URL || "";
    this.forcePathStyle =
      config.forcePathStyle !== undefined
        ? Boolean(config.forcePathStyle)
        : process.env.S3_FORCE_PATH_STYLE === "true" || process.env.S3_FORCE_PATH_STYLE === "1";

    this.s3Client =
      config.s3Client ||
      new S3Client({
        bucket: this.bucket,
        region: this.region,
        endpoint: this.endpoint,
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
        forcePathStyle: this.forcePathStyle,
      });
  }

  /**
   * Validate provider configuration
   */
  validateConfig() {
    if (!this.bucket) {
      throw new AppError("S3 storage configuration missing: S3_BUCKET is required", 500, "S3_CONFIG_ERROR");
    }
    if (!this.accessKeyId) {
      throw new AppError("S3 storage configuration missing: S3_ACCESS_KEY_ID is required", 500, "S3_CONFIG_ERROR");
    }
    if (!this.secretAccessKey) {
      throw new AppError("S3 storage configuration missing: S3_SECRET_ACCESS_KEY is required", 500, "S3_CONFIG_ERROR");
    }
  }

  /**
   * Resolve public delivery URL for an S3 object key
   */
  getPublicUrl(key) {
    const cleanKey = key.replace(/^\/+/, "");
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/$/, "")}/${cleanKey}`;
    }

    if (this.endpoint) {
      const endpointUrl = new URL(this.endpoint);
      const host = endpointUrl.host;
      const protocol = endpointUrl.protocol;
      if (this.forcePathStyle) {
        return `${protocol}//${host}/${this.bucket}/${cleanKey}`;
      }
      return `${protocol}//${this.bucket}.${host}/${cleanKey}`;
    }

    if (this.forcePathStyle) {
      const host = this.region === "us-east-1" ? "s3.amazonaws.com" : `s3.${this.region}.amazonaws.com`;
      return `https://${host}/${this.bucket}/${cleanKey}`;
    }

    const host =
      this.region === "us-east-1"
        ? `${this.bucket}.s3.amazonaws.com`
        : `${this.bucket}.s3.${this.region}.amazonaws.com`;
    return `https://${host}/${cleanKey}`;
  }

  /**
   * Derive object key from a key or URL
   */
  extractObjectKey(keyOrUrl, defaultPrefix = "uploads") {
    if (!keyOrUrl || typeof keyOrUrl !== "string") {
      throw new AppError("Invalid object key or URL", 400, "INVALID_STORAGE_KEY");
    }

    const clean = keyOrUrl.trim();
    if (clean.startsWith("http://") || clean.startsWith("https://")) {
      try {
        const parsed = new URL(clean);
        let pathname = parsed.pathname.replace(/^\/+/, "");
        // If path begins with bucket name in path style, remove bucket
        if (pathname.startsWith(`${this.bucket}/`)) {
          pathname = pathname.substring(this.bucket.length + 1);
        }
        return pathname;
      } catch {
        // Fallback
      }
    }

    if (clean.startsWith("/")) {
      return clean.replace(/^\/+/, "");
    }

    if (!clean.includes("/")) {
      return `${defaultPrefix}/${clean}`;
    }

    return clean;
  }

  /**
   * Save public media asset (e.g., product image, storefront banner) to S3
   */
  async savePublicMedia({ filename, buffer, mimeType, prefix = "uploads" }) {
    this.validateConfig();

    const safeFilename = path.basename(filename);
    const key = `${prefix}/${safeFilename}`.replace(/^\/+/, "");

    await this.s3Client.putObject({
      key,
      body: buffer,
      contentType: mimeType || "application/octet-stream",
      isPrivate: false,
      metadata: {
        originalName: encodeURIComponent(safeFilename),
      },
    });

    const publicUrl = this.getPublicUrl(key);

    return {
      key,
      url: publicUrl,
      storageProvider: "s3",
      size: buffer.length,
      mimeType,
      filename: safeFilename,
    };
  }

  /**
   * Save private digital asset to S3
   */
  async saveDigitalAsset({ filename, buffer, mimeType, metadata = {} }) {
    this.validateConfig();

    const safeFilename = path.basename(filename);
    const key = `digital-assets/${safeFilename}`;
    const checksum = crypto.createHash("sha256").update(buffer).digest("hex");

    await this.s3Client.putObject({
      key,
      body: buffer,
      contentType: mimeType || "application/octet-stream",
      isPrivate: true,
      metadata: {
        checksum,
        originalName: encodeURIComponent(metadata.fileName || safeFilename),
        version: metadata.version || "1.0",
      },
    });

    const randomId = crypto.randomBytes(8).toString("hex");
    const originalName = metadata.fileName || metadata.originalName || safeFilename;
    const ext = path.extname(originalName);

    logger.info("Saved digital asset to S3 private storage", {
      storageKey: key,
      size: buffer.length,
      mimeType,
    });

    return {
      id: `asset_${randomId}`,
      name: metadata.name || path.basename(originalName, ext) || originalName,
      fileName: originalName,
      storageKey: key,
      storageProvider: "s3",
      fileSize: buffer.length,
      mimeType: mimeType || "application/octet-stream",
      checksum,
      version: metadata.version || "1.0",
      uploadedAt: new Date(),
    };
  }

  /**
   * Get digital asset stream from S3
   */
  async getDigitalAssetStream(storageKey) {
    this.validateConfig();

    const key = this.extractObjectKey(storageKey, "digital-assets");
    const { stream, size, contentType } = await this.s3Client.getObjectStream({ key });

    return {
      stream,
      size,
      mimeType: contentType,
    };
  }

  /**
   * Generate short-lived presigned URL for private download
   */
  async getDigitalAssetSignedUrl(storageKey, options = {}) {
    this.validateConfig();

    const key = this.extractObjectKey(storageKey, "digital-assets");
    const expiresInSeconds = options.expiresIn || 300; // 5 minutes default

    return this.s3Client.getSignedUrl({
      key,
      expiresInSeconds,
      method: "GET",
    });
  }

  /**
   * Delete public media object safely
   */
  async deletePublicMedia(keyOrUrl) {
    try {
      this.validateConfig();
      const key = this.extractObjectKey(keyOrUrl, "uploads");
      const deleted = await this.s3Client.deleteObject({ key });
      logger.info("Deleted public media from S3", { key });
      return deleted;
    } catch (err) {
      logger.warn("Failed to delete S3 public media", { keyOrUrl, error: err.message });
      return false;
    }
  }

  /**
   * Delete digital asset object safely
   */
  async deleteDigitalAsset(storageKey) {
    try {
      this.validateConfig();
      const key = this.extractObjectKey(storageKey, "digital-assets");
      const deleted = await this.s3Client.deleteObject({ key });
      logger.info("Deleted digital asset from S3", { key });
      return deleted;
    } catch (err) {
      logger.warn("Failed to delete S3 digital asset", { storageKey, error: err.message });
      return false;
    }
  }

  /**
   * Check if asset exists in S3
   */
  async assetExists(keyOrUrl, isPrivate = false) {
    try {
      this.validateConfig();
      const defaultPrefix = isPrivate ? "digital-assets" : "uploads";
      const key = this.extractObjectKey(keyOrUrl, defaultPrefix);
      const res = await this.s3Client.headObject({ key });
      return Boolean(res.exists);
    } catch {
      return false;
    }
  }
}

module.exports = S3StorageProvider;
