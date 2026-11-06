const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const zlib = require("zlib");
const AdmZip = require("adm-zip");
const AppError = require("../errors/AppError");

const MAX_COMPRESSED_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_UNCOMPRESSED_SIZE = 150 * 1024 * 1024; // 150 MB
const MAX_ENTRY_UNCOMPRESSED_SIZE = 30 * 1024 * 1024; // 30 MB per single image
const MAX_FILE_ENTRIES = 300;
const STAGING_TTL_MS = 60 * 60 * 1000; // 1 hour

const ALLOWED_RASTER_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];

// Server-controlled staging root directory
const STAGING_ROOT = path.resolve(os.tmpdir(), "buybox-bulk-staging");

/**
 * Ensures the staging root directory exists.
 */
function ensureStagingRoot() {
  if (!fs.existsSync(STAGING_ROOT)) {
    fs.mkdirSync(STAGING_ROOT, { recursive: true });
  }
}

/**
 * Validates the file buffer magic bytes against expected raster image formats.
 * @param {Buffer} buffer
 * @param {string} ext
 * @returns {boolean}
 */
function validateImageMagicBytes(buffer, ext) {
  if (!buffer || buffer.length < 4) return false;

  const normalizedExt = ext.toLowerCase();

  // JPEG: FF D8 FF
  if (normalizedExt === ".jpg" || normalizedExt === ".jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (normalizedExt === ".png") {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  // GIF: GIF87a or GIF89a (47 49 46 38 37/39 61)
  if (normalizedExt === ".gif") {
    return (
      buffer.length >= 6 &&
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38 &&
      (buffer[4] === 0x37 || buffer[4] === 0x39) &&
      buffer[5] === 0x61
    );
  }

  // WebP: RIFF .... WEBP
  if (normalizedExt === ".webp") {
    if (buffer.length < 12) return false;
    const isRiff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
    const isWebp = buffer[8] === 0x57 && buffer[9] === 0x58 && buffer[10] === 0x42 && buffer[11] === 0x50;
    // wait, WebP is RIFF ... WEBP (0x57, 0x45, 0x42, 0x50)
    const isWebpCorrect = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
    return isRiff && isWebpCorrect;
  }

  // AVIF: .... ftyp avif / avis
  if (normalizedExt === ".avif") {
    if (buffer.length < 12) return false;
    const isFtyp = buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70;
    const brand = buffer.slice(8, 12).toString("latin1");
    return isFtyp && (brand === "avif" || brand === "avis" || brand.startsWith("mif"));
  }

  return false;
}

/**
 * Periodically removes expired staging directories older than 1 hour.
 */
function cleanupExpiredStaging() {
  try {
    ensureStagingRoot();
    const dirs = fs.readdirSync(STAGING_ROOT);
    const now = Date.now();
    for (const d of dirs) {
      const dirPath = path.join(STAGING_ROOT, d);
      try {
        const stats = fs.statSync(dirPath);
        if (stats.isDirectory() && now - stats.mtimeMs > STAGING_TTL_MS) {
          fs.rmSync(dirPath, { recursive: true, force: true });
        }
      } catch {
        // Continue cleaning other directories
      }
    }
  } catch {
    // Non-fatal cleanup error
  }
}

/**
 * Processes, inspects, validates, and securely stages an uploaded ZIP archive of product images.
 *
 * @param {Buffer} zipBuffer - Raw buffer of uploaded ZIP file
 * @param {object} context - Authorization context ({ vendorId, actorId })
 * @returns {object} Staged context containing manifest, file mappings, and stagingId
 */
function processZipArchive(zipBuffer, context = {}) {
  cleanupExpiredStaging();

  if (!zipBuffer || !Buffer.isBuffer(zipBuffer)) {
    throw new AppError("Invalid ZIP archive buffer provided.", 400, "INVALID_ZIP_BUFFER");
  }

  // 1. Compressed size bound
  if (zipBuffer.length > MAX_COMPRESSED_SIZE) {
    throw new AppError(
      `ZIP archive size (${(zipBuffer.length / (1024 * 1024)).toFixed(1)} MB) exceeds maximum allowed limit of ${MAX_COMPRESSED_SIZE / (1024 * 1024)} MB.`,
      400,
      "ZIP_TOO_LARGE"
    );
  }

  // 2. Magic bytes verification (PK\x03\x04 or PK\x05\x06)
  if (
    zipBuffer.length < 4 ||
    zipBuffer[0] !== 0x50 ||
    zipBuffer[1] !== 0x4b ||
    (zipBuffer[2] !== 0x03 && zipBuffer[2] !== 0x05 && zipBuffer[2] !== 0x07)
  ) {
    throw new AppError("Uploaded file is not a valid ZIP archive format.", 400, "INVALID_ZIP_FORMAT");
  }

  let zip;
  try {
    zip = new AdmZip(zipBuffer);
  } catch (err) {
    throw new AppError(`Failed to parse ZIP archive: ${err.message}`, 400, "MALFORMED_ZIP_ARCHIVE");
  }

  const entries = zip.getEntries();

  // 3. Max entry count bound
  if (entries.length > MAX_FILE_ENTRIES) {
    throw new AppError(
      `ZIP archive contains ${entries.length} entries, exceeding maximum limit of ${MAX_FILE_ENTRIES}.`,
      400,
      "ZIP_TOO_MANY_ENTRIES"
    );
  }

  // 4. Staging directory creation
  const stagingId = `stg_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
  ensureStagingRoot();
  const stagingDir = path.join(STAGING_ROOT, stagingId);
  fs.mkdirSync(stagingDir, { recursive: true });

  let totalUncompressedSize = 0;
  const entryMap = new Map(); // normalized path -> metadata
  const basenameMap = new Map(); // basename -> array of entry names
  const validFiles = [];

  try {
    for (const entry of entries) {
      if (entry.isDirectory) continue;

      const rawName = entry.entryName;

      // Ignore OS metadata and hidden files
      if (
        rawName.includes("__MACOSX") ||
        rawName.includes(".DS_Store") ||
        rawName.includes("Thumbs.db") ||
        path.basename(rawName).startsWith(".")
      ) {
        continue;
      }

      // 5. Zip-Slip & Path Traversal Prevention
      if (
        rawName.includes("..") ||
        rawName.startsWith("/") ||
        rawName.startsWith("\\") ||
        rawName.includes("\0") ||
        /[\r\n\t]/.test(rawName) ||
        /^[a-zA-Z]:/.test(rawName)
      ) {
        throw new AppError(
          `ZIP archive contains unsafe path traversal sequence: '${rawName}'.`,
          400,
          "ZIP_PATH_TRAVERSAL"
        );
      }

      // P2-C: Duplicate normalized path detection
      const normalizedRelativePath = rawName.replace(/\\/g, "/").toLowerCase().trim();
      if (entryMap.has(normalizedRelativePath)) {
        throw new AppError(
          `ZIP archive contains duplicate image path: '${rawName}'. Each image path in the archive must be unique.`,
          400,
          "DUPLICATE_ARCHIVE_ENTRY"
        );
      }

      // Check extension before decompression
      const ext = path.extname(rawName).toLowerCase();
      if (ext === ".svg") {
        throw new AppError(
          `SVG file '${rawName}' is not allowed in image archives due to security policy.`,
          400,
          "SVG_NOT_ALLOWED"
        );
      }

      if (!ALLOWED_RASTER_EXTENSIONS.includes(ext)) {
        throw new AppError(
          `File '${rawName}' has unsupported extension '${ext}'. Allowed image formats: ${ALLOWED_RASTER_EXTENSIONS.join(", ")}.`,
          400,
          "UNSUPPORTED_ARCHIVE_FILE_TYPE"
        );
      }

      // P1-A: Bounded actual decompression limits
      const remainingAggregateBudget = MAX_UNCOMPRESSED_SIZE - totalUncompressedSize;
      if (remainingAggregateBudget <= 0) {
        throw new AppError(
          `Aggregate uncompressed size exceeds maximum allowed limit of ${MAX_UNCOMPRESSED_SIZE / (1024 * 1024)} MB.`,
          400,
          "ZIP_DECOMPRESSION_BOMB"
        );
      }

      const maxEntryOutputLength = Math.min(MAX_ENTRY_UNCOMPRESSED_SIZE, remainingAggregateBudget);

      let fileBuffer;
      const compressionMethod = entry.header.method;

      if (compressionMethod === 0) {
        // STORED (uncompressed)
        const rawComp = entry.getCompressedData();
        if (rawComp.length > maxEntryOutputLength) {
          throw new AppError(
            `Decompressed size for '${rawName}' exceeds maximum allowed limit.`,
            400,
            "ZIP_DECOMPRESSION_BOMB"
          );
        }
        fileBuffer = rawComp;
      } else if (compressionMethod === 8) {
        // DEFLATED (native libz decompression with strict output buffer bound)
        const comp = entry.getCompressedData();
        try {
          fileBuffer = zlib.inflateRawSync(comp, {
            maxOutputLength: maxEntryOutputLength,
          });
        } catch (zErr) {
          if (zErr.code === "ERR_BUFFER_TOO_LARGE" || (zErr.message && zErr.message.includes("larger than"))) {
            throw new AppError(
              `Decompressed data for '${rawName}' exceeds maximum allowed uncompressed limit.`,
              400,
              "ZIP_DECOMPRESSION_BOMB"
            );
          }
          throw new AppError(
            `Failed to decompress entry '${rawName}': ${zErr.message}`,
            400,
            "MALFORMED_ZIP_ARCHIVE"
          );
        }
      } else {
        throw new AppError(
          `Unsupported compression method (${compressionMethod}) for entry '${rawName}'. Only Stored (0) and Deflated (8) are supported.`,
          400,
          "UNSUPPORTED_ARCHIVE_COMPRESSION"
        );
      }

      // Enforce actual decompressed size
      totalUncompressedSize += fileBuffer.length;
      if (totalUncompressedSize > MAX_UNCOMPRESSED_SIZE) {
        throw new AppError(
          `Aggregate uncompressed size exceeds maximum allowed limit of ${MAX_UNCOMPRESSED_SIZE / (1024 * 1024)} MB.`,
          400,
          "ZIP_DECOMPRESSION_BOMB"
        );
      }

      // 6. Image Content Magic Bytes Validation
      const isGenuineImage = validateImageMagicBytes(fileBuffer, ext);
      if (!isGenuineImage) {
        throw new AppError(
          `File '${rawName}' does not contain valid ${ext.toUpperCase().replace(".", "")} image data.`,
          400,
          "INVALID_IMAGE_CONTENT"
        );
      }

      // Write staged file with safe isolated unique hash
      const stagedFilename = `img_${crypto.randomBytes(8).toString("hex")}${ext}`;
      const stagedFilePath = path.join(stagingDir, stagedFilename);
      fs.writeFileSync(stagedFilePath, fileBuffer);

      const baseName = path.basename(normalizedRelativePath);

      const fileMeta = {
        originalName: rawName,
        normalizedPath: normalizedRelativePath,
        baseName,
        ext,
        size: fileBuffer.length,
        stagedFilename,
        stagedFilePath,
      };

      entryMap.set(normalizedRelativePath, fileMeta);

      const existingBasenames = basenameMap.get(baseName) || [];
      existingBasenames.push(normalizedRelativePath);
      basenameMap.set(baseName, existingBasenames);

      validFiles.push(fileMeta);
    }
  } catch (err) {
    // Clean up staging directory on error
    if (fs.existsSync(stagingDir)) {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    }
    throw err;
  }

  // 7. Write manifest with ownership & expiration
  const manifest = {
    stagingId,
    vendorId: context.vendorId ? String(context.vendorId) : null,
    actorId: context.actorId ? String(context.actorId) : null,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + STAGING_TTL_MS).toISOString(),
    totalFiles: validFiles.length,
    stagingDir,
    validFiles,
  };

  fs.writeFileSync(path.join(stagingDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  return {
    stagingId,
    stagingDir,
    totalFiles: validFiles.length,
    entryMap,
    basenameMap,
    manifest,
  };
}

/**
 * Retrieves and validates an existing staged manifest for commit, enforcing vendor ownership and expiration.
 *
 * @param {string} stagingId
 * @param {object} context - Authorization context ({ vendorId, actor, isAdmin })
 * @returns {object} Parsed manifest
 */
function getStagedManifest(stagingId, context = {}) {
  if (!stagingId || typeof stagingId !== "string") {
    return null;
  }

  // Path traversal defense on stagingId
  const safeStagingId = path.basename(stagingId.trim());
  if (!safeStagingId.startsWith("stg_")) {
    throw new AppError("Invalid staging identifier format.", 400, "INVALID_STAGING_ID");
  }

  ensureStagingRoot();
  const stagingDir = path.join(STAGING_ROOT, safeStagingId);
  const manifestPath = path.join(stagingDir, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    throw new AppError("Staging session expired or not found. Please re-upload your files.", 404, "STAGING_EXPIRED");
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  } catch {
    throw new AppError("Staging manifest is corrupted.", 500, "CORRUPT_STAGING_MANIFEST");
  }

  // Expiration check
  if (new Date(manifest.expiresAt).getTime() < Date.now()) {
    cleanupStaging(safeStagingId);
    throw new AppError("Staging session has expired. Please re-validate your files.", 410, "STAGING_EXPIRED");
  }

  // P1-B: Fail-closed tenant authorization check
  const isAdmin = Boolean(context.isAdmin);
  if (!isAdmin) {
    if (
      !manifest.vendorId ||
      !context.vendorId ||
      String(manifest.vendorId) !== String(context.vendorId)
    ) {
      throw new AppError("Unauthorized access to staged files.", 403, "STAGING_ACCESS_DENIED");
    }
  }

  return manifest;
}

/**
 * Removes a staging directory and its files.
 * @param {string} stagingId
 */
function cleanupStaging(stagingId) {
  if (!stagingId) return;
  const safeStagingId = path.basename(String(stagingId).trim());
  if (!safeStagingId.startsWith("stg_")) return;

  const stagingDir = path.join(STAGING_ROOT, safeStagingId);
  if (fs.existsSync(stagingDir)) {
    try {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    } catch {
      // Ignored
    }
  }
}

/**
 * Finds matching staged file by filename (relative path or basename) in the archive context.
 *
 * @param {string} rawCellVal - Filename from spreadsheet cell
 * @param {object} zipContext - Processed zip archive context ({ entryMap, basenameMap })
 * @returns {{ isMatch: boolean, isAmbiguous: boolean, fileMeta?: object, error?: string }}
 */
function matchFilenameInZip(rawCellVal, zipContext) {
  if (!rawCellVal || !zipContext) {
    return { isMatch: false, isAmbiguous: false, error: "No image reference or ZIP archive" };
  }

  const clean = String(rawCellVal).trim().replace(/\\/g, "/").toLowerCase();
  const baseName = path.basename(clean);

  // 1. Direct relative path match
  if (zipContext.entryMap.has(clean)) {
    return { isMatch: true, isAmbiguous: false, fileMeta: zipContext.entryMap.get(clean) };
  }

  // 2. Basename match
  const matchingPaths = zipContext.basenameMap.get(baseName);
  if (!matchingPaths || matchingPaths.length === 0) {
    return {
      isMatch: false,
      isAmbiguous: false,
      error: `Image file '${rawCellVal}' was not found in the uploaded ZIP archive.`,
    };
  }

  if (matchingPaths.length > 1) {
    return {
      isMatch: false,
      isAmbiguous: true,
      error: `Ambiguous image reference '${rawCellVal}': matches multiple files in ZIP archive (${matchingPaths.join(", ")}). Please specify the full folder path in the spreadsheet.`,
    };
  }

  const singleMatch = zipContext.entryMap.get(matchingPaths[0]);
  return { isMatch: true, isAmbiguous: false, fileMeta: singleMatch };
}

module.exports = {
  processZipArchive,
  getStagedManifest,
  cleanupStaging,
  matchFilenameInZip,
  validateImageMagicBytes,
  ALLOWED_RASTER_EXTENSIONS,
  MAX_COMPRESSED_SIZE,
  MAX_UNCOMPRESSED_SIZE,
  MAX_ENTRY_UNCOMPRESSED_SIZE,
  MAX_FILE_ENTRIES,
  STAGING_ROOT,
};
