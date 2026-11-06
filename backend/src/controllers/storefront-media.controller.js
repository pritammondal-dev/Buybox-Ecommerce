const storefrontMediaService = require("../services/storefront-media.service");
const { sendSuccess } = require("../utils/apiResponse");

const getMediaById = async (req, res, next) => {
  try {
    const media =
      await storefrontMediaService.getMediaById(
        req.params.mediaId
      );

    return sendSuccess(res, {
      message:
        "Storefront media fetched successfully",
      data: media,
    });
  } catch (error) {
    next(error);
  }
};

const getActiveMedia = async (req, res, next) => {
  try {
    const media =
      await storefrontMediaService.getActiveMedia();

    return sendSuccess(res, {
      message:
        "Active storefront media fetched successfully",
      data: media,
    });
  } catch (error) {
    next(error);
  }
};

const listMedia = async (req, res, next) => {
  try {
    const media =
      await storefrontMediaService.listMedia(
        req.query
      );

    return sendSuccess(res, {
      message:
        "Storefront media fetched successfully",
      data: media,
    });
  } catch (error) {
    next(error);
  }
};

const createMedia = async (req, res, next) => {
  try {
    const media =
      await storefrontMediaService.createMedia(
        req.body,
        req.user.id
      );

    return sendSuccess(res, {
      statusCode: 201,
      message:
        "Storefront media created successfully",
      data: media,
    });
  } catch (error) {
    next(error);
  }
};

const updateMedia = async (req, res, next) => {
  try {
    const media =
      await storefrontMediaService.updateMedia(
        req.params.mediaId,
        req.body,
        req.user.id
      );

    return sendSuccess(res, {
      message:
        "Storefront media updated successfully",
      data: media,
    });
  } catch (error) {
    next(error);
  }
};

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const AppError = require("../errors/AppError");

const deleteMedia = async (req, res, next) => {
  try {
    const result =
      await storefrontMediaService.deleteMedia(
        req.params.mediaId
      );

    return sendSuccess(res, {
      message:
        "Storefront media deleted successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const uploadMedia = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError("No file uploaded. Please select an image file.", 400, "MISSING_FILE");
    }

    const { originalname, mimetype, size, buffer } = req.file;

    const ext = path.extname(originalname).toLowerCase();
    const normalizedMime = mimetype ? mimetype.toLowerCase() : "";

    // Security: Strict rejection of SVG uploads to prevent stored cross-site scripting (XSS)
    if (
      normalizedMime === "image/svg+xml" ||
      ext === ".svg" ||
      (buffer && buffer.slice(0, 100).toString("utf8").toLowerCase().includes("<svg"))
    ) {
      throw new AppError(
        "SVG uploads are not permitted for security reasons (XSS risk). Please upload PNG, WebP, JPEG, or ICO.",
        400,
        "SVG_NOT_ALLOWED"
      );
    }

    // Conservative file size limit (2 MB)
    const MAX_BRAND_ASSET_SIZE = 2 * 1024 * 1024; // 2 MB
    if (size > MAX_BRAND_ASSET_SIZE) {
      throw new AppError(
        "File size exceeds 2MB limit. Please upload an image smaller than 2MB.",
        400,
        "FILE_TOO_LARGE"
      );
    }

    // Validate image MIME type (supporting standard raster formats + ICO for favicons)
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/avif",
      "image/x-icon",
      "image/vnd.microsoft.icon",
    ];
    if (!allowedMimes.includes(normalizedMime)) {
      throw new AppError(
        "Invalid file type. Allowed formats: PNG, WebP, JPEG, GIF, AVIF, and ICO.",
        400,
        "INVALID_FILE_TYPE"
      );
    }

    // Verify extension
    const allowedExts = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".ico"];
    if (!allowedExts.includes(ext)) {
      throw new AppError(
        "Invalid file extension. Allowed formats: JPG, JPEG, PNG, WEBP, GIF, AVIF, ICO.",
        400,
        "INVALID_FILE_EXTENSION"
      );
    }

    // Content verification: validate magic bytes to prevent renamed executables or scripts
    const isMagicBytesValid = (buf) => {
      if (!buf || buf.length < 4) return false;
      // PNG: 89 50 4E 47
      if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true;
      // JPEG: FF D8 FF
      if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true;
      // GIF: 47 49 46 ('GIF')
      if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true;
      // WEBP: RIFF....WEBP
      if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return true;
      // ICO: 00 00 01 00
      if (buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x01 && buf[3] === 0x00) return true;
      // AVIF / ISO BMFF ftyp
      if (buf.length >= 12 && buf.toString("ascii", 4, 8) === "ftyp") return true;
      return false;
    };

    if (!isMagicBytesValid(buffer)) {
      throw new AppError(
        "Corrupted or invalid image content. File signature does not match expected image format.",
        400,
        "CORRUPT_OR_INVALID_IMAGE"
      );
    }

    const storageService = require("../services/storage");
    const safeFilename = `media_${Date.now()}_${crypto.randomBytes(4).toString("hex")}${ext}`;

    const storageResult = await storageService.uploadPublicMedia({
      filename: safeFilename,
      buffer,
      mimeType: mimetype,
      prefix: "uploads",
    });

    const fileUrl = storageResult.url;

    // Optionally create StorefrontMedia record for catalog tracking
    const media = await storefrontMediaService
      .createMedia(
        {
          title: originalname.replace(ext, ""),
          type: "image",
          url: fileUrl,
          storageProvider: storageResult.storageProvider,
          storageKey: storageResult.key,
          mimeType: mimetype,
          fileSize: size,
          altText: originalname.replace(ext, ""),
        },
        req.user?.id || null
      )
      .catch(() => null);

    return sendSuccess(res, {
      statusCode: 201,
      message: "Media uploaded successfully",
      data: {
        url: fileUrl,
        filename: safeFilename,
        size,
        mimeType: mimetype,
        mediaId: media?._id || null,
        storageProvider: storageResult.storageProvider,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMediaById,
  getActiveMedia,
  listMedia,
  createMedia,
  updateMedia,
  deleteMedia,
  uploadMedia,
};