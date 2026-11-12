const mongoose = require("mongoose");
const User = require("../models/User");
const Customer = require("../models/Customer");
const Address = require("../models/Address");
const Cart = require("../models/Cart");
const Wishlist = require("../models/Wishlist");
const CustomerNotification = require("../models/CustomerNotification");
const PaymentMethod = require("../models/PaymentMethod");
const RewardAccount = require("../models/RewardAccount");
const RewardTransaction = require("../models/RewardTransaction");
const RefreshToken = require("../models/RefreshToken");
const Otp = require("../models/Otp");
const EmailVerificationToken = require("../models/EmailVerificationToken");
const PasswordResetToken = require("../models/PasswordResetToken");
const Order = require("../models/Order");
const ReturnRequest = require("../models/ReturnRequest");
const ProductQuestion = require("../models/ProductQuestion");
const DigitalEntitlement = require("../models/DigitalEntitlement");
const DeletedAccountTombstone = require("../models/DeletedAccountTombstone");

const AppError = require("../errors/AppError");
const { comparePassword } = require("../utils/password");
const {
  CURRENT_KEY_VERSION,
  generateIdentityFingerprint,
} = require("../utils/tombstone.util");
const { recordAuditLog } = require("./governance.service");

/**
 * Validate whether a customer is operationally eligible for permanent account deletion.
 *
 * Checks:
 * 1. No in-flight orders ("pending", "confirmed", "processing", "shipped" or cancellationStatus "pending")
 * 2. No active return/refund requests in progress
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.userId
 * @param {string|mongoose.Types.ObjectId} [params.customerId]
 */
const validateDeletionEligibility = async ({ userId, customerId = null }) => {
  const targetIds = [userId, customerId].filter(Boolean);

  // 1. Check for active/in-flight orders
  const activeOrders = await Order.find({
    customerId: { $in: targetIds },
    $or: [
      { status: { $in: ["pending", "confirmed", "processing", "shipped"] } },
      { cancellationStatus: "pending" },
    ],
  })
    .select("_id orderNumber status cancellationStatus")
    .lean();

  if (activeOrders.length > 0) {
    const orderNumbers = activeOrders.map((o) => o.orderNumber).join(", ");
    throw new AppError(
      `Cannot permanently delete account while orders are in progress (${orderNumbers}). Please wait for fulfillment or cancel them before deletion.`,
      400,
      "ACTIVE_ORDERS_IN_PROGRESS"
    );
  }

  // 2. Check for active return or refund requests
  const activeReturns = await ReturnRequest.find({
    customerId: { $in: targetIds },
    status: {
      $nin: [
        "refunded",
        "exchange_completed",
        "exchange_fulfilled",
        "rejected",
        "cancelled",
      ],
    },
  })
    .select("_id returnNumber status")
    .lean();

  if (activeReturns.length > 0) {
    const returnNumbers = activeReturns.map((r) => r.returnNumber).join(", ");
    throw new AppError(
      `Cannot permanently delete account with active return or refund requests in progress (${returnNumbers}). Please resolve these requests first.`,
      400,
      "ACTIVE_RETURNS_IN_PROGRESS"
    );
  }
};

/**
 * Re-verify the customer's identity prior to destructive deletion.
 *
 * - Password users: requires exact match of current password.
 * - Google-only/passwordless users: requires explicit confirmation string "DELETE MY ACCOUNT".
 *
 * @param {Object} params
 * @param {Object} params.user - User document including +password
 * @param {string} [params.password]
 * @param {string} [params.confirmation]
 */
const verifyCustomerIdentity = async ({ user, password = null, confirmation = null }) => {
  const hasPassword = Boolean(user.password);

  if (hasPassword) {
    if (!password || typeof password !== "string") {
      throw new AppError(
        "Current password is required to verify permanent account deletion",
        400,
        "PASSWORD_REQUIRED"
      );
    }

    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      throw new AppError(
        "Invalid password verification",
        401,
        "INVALID_CREDENTIALS"
      );
    }
  } else {
    // Google-only or passwordless customer
    const normalizedConfirmation = (confirmation || "").trim();
    if (normalizedConfirmation !== "DELETE MY ACCOUNT") {
      throw new AppError(
        "Please type 'DELETE MY ACCOUNT' to confirm permanent account deletion",
        400,
        "CONFIRMATION_REQUIRED"
      );
    }
  }
};

/**
 * Permanently delete a customer account and eligible personal data while preserving
 * financial, tax, and order history in an anonymized state.
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.userId
 * @param {string} [params.password]
 * @param {string} [params.confirmation]
 * @param {string} [params.reason]
 * @param {Object} [params.req]
 * @returns {Promise<Object>} Deletion result
 */
const executePermanentDeletion = async ({
  userId,
  password = null,
  confirmation = null,
  reason = "Customer self-service account deletion",
  skipIdentityVerification = false,
  actorId = null,
  req = null,
}) => {
  if (!mongoose.isValidObjectId(userId)) {
    throw new AppError("Invalid user ID", 400, "INVALID_ID");
  }

  const user = await User.findById(userId).select("+password");
  if (!user) {
    throw new AppError("Customer account not found", 404, "USER_NOT_FOUND");
  }

  if (user.role === "super_admin" || (user.roles || []).includes("super_admin")) {
    throw new AppError("Superadmin accounts cannot be deleted", 403, "CANNOT_DELETE_SUPERADMIN");
  }

  if (user.role !== "customer" && !(user.roles || []).includes("customer")) {
    throw new AppError(
      "Only customer accounts can be permanently deleted through this endpoint",
      403,
      "NOT_A_CUSTOMER"
    );
  }

  const customerDoc = await Customer.findOne({ userId: user._id });
  const customerId = customerDoc?._id || null;

  // 1. Identity re-verification (skipped only when authorized admin performs administrative deletion)
  if (!skipIdentityVerification) {
    await verifyCustomerIdentity({ user, password, confirmation });
  }

  // 2. Eligibility check (active orders & returns)
  await validateDeletionEligibility({ userId: user._id, customerId });

  const targetIds = [user._id, customerId].filter(Boolean);

  // 3. Execution function
  const performDeletion = async (session = null) => {
    const opts = session ? { session } : {};

    // A. Register privacy-safe tombstones for OAuth & recreation prevention
    if (user.email) {
      const emailFp = generateIdentityFingerprint("email", user.email, CURRENT_KEY_VERSION);
      if (emailFp) {
        await DeletedAccountTombstone.updateOne(
          { identityFingerprint: emailFp },
          {
            $set: {
              identityFingerprint: emailFp,
              fingerprintType: "email",
              keyVersion: CURRENT_KEY_VERSION,
              deletedAt: new Date(),
              reason,
            },
          },
          { upsert: true, ...opts }
        );
      }
    }

    if (user.authProviders?.google?.id) {
      const googleFp = generateIdentityFingerprint(
        "google_sub",
        user.authProviders.google.id,
        CURRENT_KEY_VERSION
      );
      if (googleFp) {
        await DeletedAccountTombstone.updateOne(
          { identityFingerprint: googleFp },
          {
            $set: {
              identityFingerprint: googleFp,
              fingerprintType: "google_sub",
              keyVersion: CURRENT_KEY_VERSION,
              deletedAt: new Date(),
              reason,
            },
          },
          { upsert: true, ...opts }
        );
      }
    }

    // B. Anonymize historical Orders (PRESERVE ALL FINANCIAL/TAX/LINE ITEMS)
    await Order.updateMany(
      { customerId: { $in: targetIds } },
      {
        $set: {
          "shippingAddress.fullName": "Deleted Customer",
          "shippingAddress.phone": "0000000000",
          "shippingAddress.addressLine1": "Redacted for privacy (Account Deleted)",
          "shippingAddress.addressLine2": "",
          guestEmail: null,
        },
      },
      opts
    );

    // C. Anonymize ReturnRequests (PRESERVE RECORD, REDACT PERSONAL & BANK DETAILS)
    await ReturnRequest.updateMany(
      { customerId: { $in: targetIds } },
      {
        $set: {
          "pickupAddress.fullName": "Deleted Customer",
          "pickupAddress.phone": "0000000000",
          "pickupAddress.addressLine1": "Redacted",
          "pickupAddress.addressLine2": "",
          "bankDetails.accountNumberMasked": "****",
          "bankDetails.accountNumberEncrypted": null,
          "bankDetails.accountHolderName": "Deleted Customer",
          "bankDetails.upiId": "redacted@upi",
        },
      },
      opts
    );

    // D. Anonymize ProductQuestions (Keep answers & community questions, redact name & remove helpful votes)
    await ProductQuestion.updateMany(
      { $or: [{ userId: user._id }, { customerId: { $in: targetIds } }] },
      {
        $set: { userName: "Deleted Customer" },
        $pull: { helpfulVoters: user._id },
      },
      opts
    );

    // E. Deactivate DigitalEntitlements
    await DigitalEntitlement.updateMany(
      { $or: [{ userId: user._id }, { customerId: { $in: targetIds } }] },
      {
        $set: {
          status: "revoked",
          revokedAt: new Date(),
          revocationReason: "Customer account permanently deleted",
        },
      },
      opts
    );

    // F. Permanently delete customer-owned personal data
    await Address.deleteMany({ userId: user._id }, opts);
    await Cart.deleteMany({ customerId: { $in: targetIds } }, opts);
    await Wishlist.deleteMany({ customerId: { $in: targetIds } }, opts);
    await CustomerNotification.deleteMany(
      { $or: [{ userId: user._id }, { customerId: { $in: targetIds } }] },
      opts
    );
    await PaymentMethod.deleteMany({ customerId: { $in: targetIds } }, opts);
    await RewardAccount.deleteMany(
      { $or: [{ userId: user._id }, { customerId: { $in: targetIds } }] },
      opts
    );
    await RewardTransaction.deleteMany({ customerId: { $in: targetIds } }, opts);
    await RefreshToken.deleteMany({ userId: user._id }, opts);
    await Otp.deleteMany(
      { $or: [{ userId: user._id }, { email: user.email }].filter(Boolean) },
      opts
    );
    await EmailVerificationToken.deleteMany({ userId: user._id }, opts);
    await PasswordResetToken.deleteMany({ userId: user._id }, opts);

    // G. Permanently delete canonical Customer profile
    await Customer.deleteMany({ userId: user._id }, opts);

    // H. Permanently delete canonical User document
    await User.deleteOne({ _id: user._id }, opts);
  };

  // 4. Transaction execution with replica set graceful fallback
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    await performDeletion(session);
    await session.commitTransaction();
  } catch (txnErr) {
    if (session) {
      await session.abortTransaction().catch(() => {});
    }
    if (
      txnErr?.message?.includes("replica set") ||
      txnErr?.message?.includes("Transaction numbers")
    ) {
      await performDeletion(null);
    } else {
      throw txnErr;
    }
  } finally {
    if (session) {
      await session.endSession().catch(() => {});
    }
  }

  // 5. External avatar cleanup
  if (customerDoc?.avatar?.publicId) {
    try {
      const imageService = require("./image.service");
      if (imageService && typeof imageService.deleteImage === "function") {
        await imageService.deleteImage(customerDoc.avatar.publicId).catch(() => {});
      }
    } catch {
      // Safe catch; storage failure does not fail database deletion completion
    }
  }

  // 6. Record non-sensitive audit event
  const effectiveActorId = actorId || user._id;
  await recordAuditLog({
    actorId: effectiveActorId,
    targetId: user._id,
    action: "customer.permanent_deleted",
    entityType: "Customer",
    beforeState: {
      userId: user._id,
      customerId,
      hasGoogle: Boolean(user.authProviders?.google?.id),
    },
    afterState: {
      permanentlyDeleted: true,
      deletedAt: new Date(),
    },
    reason,
    req,
  }).catch(() => {});

  // 7. Verify deletion
  const remainingUser = await User.findById(user._id).lean();
  const remainingCustomer = await Customer.findOne({ userId: user._id }).lean();
  if (remainingUser || remainingCustomer) {
    throw new AppError(
      "Deletion verification failed: customer documents still exist in database",
      500,
      "DELETION_VERIFICATION_FAILED"
    );
  }

  return {
    permanentlyDeleted: true,
    deletedAt: new Date(),
  };
};

module.exports = {
  validateDeletionEligibility,
  verifyCustomerIdentity,
  executePermanentDeletion,
};
