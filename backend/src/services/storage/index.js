const LocalStorageProvider = require("./local-storage.provider");
const S3StorageProvider = require("./s3-storage.provider");
const AppError = require("../../errors/AppError");
const logger = require("../../config/logger");

let activeProviderInstance = null;
let currentProviderType = null;

/**
 * Check if S3 environment variables are sufficiently configured
 */
function isS3Configured() {
  return Boolean(
    process.env.S3_BUCKET &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY
  );
}

/**
 * Get active storage provider name ("local" or "s3")
 */
function getStorageProviderName() {
  return (process.env.MEDIA_STORAGE_PROVIDER || "local").toLowerCase();
}

/**
 * Instantiate provider by name
 */
function createProvider(providerName, options = {}) {
  const normalized = (providerName || "local").toLowerCase();

  if (normalized === "s3") {
    const s3Provider = new S3StorageProvider(options);
    s3Provider.validateConfig();
    return s3Provider;
  }

  if (normalized === "local") {
    return new LocalStorageProvider(options);
  }

  throw new AppError(
    `Unsupported storage provider: '${providerName}'. Supported providers: 'local', 's3'`,
    500,
    "INVALID_STORAGE_PROVIDER"
  );
}

/**
 * Get or initialize active storage provider singleton
 */
function getActiveProvider() {
  const desiredType = getStorageProviderName();

  if (activeProviderInstance && currentProviderType === desiredType) {
    return activeProviderInstance;
  }

  try {
    activeProviderInstance = createProvider(desiredType);
    currentProviderType = desiredType;
    logger.info(`Initialized media storage provider: ${desiredType}`);
    return activeProviderInstance;
  } catch (err) {
    if (desiredType === "s3") {
      logger.error("Failed to initialize S3 storage provider. Failing safely.", {
        error: err.message,
      });
      // Safety rule: Never silently fall back to public local storage for protected digital downloads
      throw new AppError(
        `Persistent S3 storage is enabled (MEDIA_STORAGE_PROVIDER=s3) but failed initialization: ${err.message}`,
        500,
        "STORAGE_INITIALIZATION_ERROR"
      );
    }
    throw err;
  }
}

/**
 * Reset provider singleton (useful for testing and configuration reload)
 */
function resetProvider() {
  activeProviderInstance = null;
  currentProviderType = null;
}

/**
 * Upload public storefront / catalog media
 * @param {object} params
 * @param {string} params.filename - Safe target filename
 * @param {Buffer} params.buffer - File buffer
 * @param {string} params.mimeType - MIME type
 * @param {string} [params.prefix="uploads"] - S3 key prefix
 * @returns {Promise<{ key: string, url: string, storageProvider: string, size: number, mimeType: string, filename: string }>}
 */
async function uploadPublicMedia(params) {
  const provider = getActiveProvider();
  return provider.savePublicMedia(params);
}

/**
 * Upload private digital asset
 * @param {object} params
 * @param {string} params.filename - Safe target filename
 * @param {Buffer} params.buffer - File buffer
 * @param {string} params.mimeType - MIME type
 * @param {object} [params.metadata] - Asset metadata
 * @returns {Promise<object>}
 */
async function uploadDigitalAsset(params) {
  const provider = getActiveProvider();
  return provider.saveDigitalAsset(params);
}

/**
 * Get readable stream for downloading a digital asset
 * @param {string} storageKey
 * @returns {Promise<{ stream: import('stream').Readable, size: number, mimeType: string }>}
 */
async function getDigitalAssetStream(storageKey) {
  const provider = getActiveProvider();
  return provider.getDigitalAssetStream(storageKey);
}

/**
 * Get presigned URL for digital asset (or null for local streaming)
 * @param {string} storageKey
 * @param {object} [options]
 * @returns {Promise<string|null>}
 */
async function getDigitalAssetSignedUrl(storageKey, options = {}) {
  const provider = getActiveProvider();
  return provider.getDigitalAssetSignedUrl(storageKey, options);
}

/**
 * Delete public media
 * @param {string} keyOrUrl
 * @returns {Promise<boolean>}
 */
async function deletePublicMedia(keyOrUrl) {
  const provider = getActiveProvider();
  return provider.deletePublicMedia(keyOrUrl);
}

/**
 * Delete digital asset
 * @param {string} storageKey
 * @returns {Promise<boolean>}
 */
async function deleteDigitalAsset(storageKey) {
  const provider = getActiveProvider();
  return provider.deleteDigitalAsset(storageKey);
}

/**
 * Check if asset exists
 * @param {string} key
 * @param {boolean} [isPrivate=false]
 * @returns {Promise<boolean>}
 */
async function assetExists(key, isPrivate = false) {
  const provider = getActiveProvider();
  return provider.assetExists(key, isPrivate);
}

module.exports = {
  uploadPublicMedia,
  uploadDigitalAsset,
  getDigitalAssetStream,
  getDigitalAssetSignedUrl,
  deletePublicMedia,
  deleteDigitalAsset,
  assetExists,
  getStorageProviderName,
  isS3Configured,
  createProvider,
  getActiveProvider,
  resetProvider,
  LocalStorageProvider,
  S3StorageProvider,
};
