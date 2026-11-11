const mongoose = require("mongoose");

/**
 * DeletedAccountTombstone Schema
 *
 * Privacy-preserving identity tombstone registry.
 * Prevents deleted accounts (especially via Google Sign-In or OAuth) from being silently
 * recreated upon authentication callback.
 *
 * PRIVACY SPECIFICATION:
 * - NEVER stores raw email addresses, phone numbers, or Google subject IDs.
 * - Stores HMAC-SHA-256 cryptographic fingerprints derived with a server-side secret.
 * - Supports key rotation tracking via keyVersion.
 */
const deletedAccountTombstoneSchema = new mongoose.Schema(
  {
    identityFingerprint: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    fingerprintType: {
      type: String,
      required: true,
      enum: ["google_sub", "email"],
      index: true,
    },

    keyVersion: {
      type: Number,
      required: true,
      default: 1,
    },

    deletedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },

    reason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "Customer requested permanent account deletion",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

deletedAccountTombstoneSchema.index(
  { identityFingerprint: 1 },
  { unique: true, name: "identity_fingerprint_unique" }
);

module.exports = mongoose.model("DeletedAccountTombstone", deletedAccountTombstoneSchema);

