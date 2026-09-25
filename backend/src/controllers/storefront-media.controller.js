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

    // Validate image MIME type
    const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
    if (!allowedMimes.includes(mimetype.toLowerCase())) {
      throw new AppError(
        "Invalid file type. Only JPEG, PNG, WEBP, GIF, and SVG images are allowed.",
        400,
        "INVALID_FILE_TYPE"
      );
    }

    // Verify extension
    const ext = path.extname(originalname).toLowerCase();
    const allowedExts = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"];
    if (!allowedExts.includes(ext)) {
      throw new AppError("Invalid file extension.", 400, "INVALID_FILE_EXTENSION");
    }

    // Ensure uploads directory exists in both backend and frontend public
    const backendUploadsDir = path.resolve(__dirname, "../../public/uploads");
    const frontendUploadsDir = path.resolve(__dirname, "../../../frontend/public/uploads");

    if (!fs.existsSync(backendUploadsDir)) {
      fs.mkdirSync(backendUploadsDir, { recursive: true });
    }
    if (!fs.existsSync(frontendUploadsDir)) {
      fs.mkdirSync(frontendUploadsDir, { recursive: true });
    }

    const safeFilename = `media_${Date.now()}_${crypto.randomBytes(4).toString("hex")}${ext}`;
    const backendFilePath = path.join(backendUploadsDir, safeFilename);
    const frontendFilePath = path.join(frontendUploadsDir, safeFilename);

    fs.writeFileSync(backendFilePath, buffer);
    try {
      fs.writeFileSync(frontendFilePath, buffer);
    } catch {}

    const fileUrl = `/uploads/${safeFilename}`;

    // Optionally create StorefrontMedia record for catalog tracking
    const media = await storefrontMediaService
      .createMedia(
        {
          title: originalname.replace(ext, ""),
          type: "image",
          url: fileUrl,
          storageProvider: "external",
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