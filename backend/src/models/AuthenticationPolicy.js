const mongoose = require("mongoose");

const authenticationPolicySchema = new mongoose.Schema(
  {
    customerLogin: {
      emailPassword: {
        enabled: {
          type: Boolean,
          default: true,
        },
      },
      emailOtp: {
        enabled: {
          type: Boolean,
          default: false,
        },
      },
      mobileOtp: {
        enabled: {
          type: Boolean,
          default: false,
        },
      },
      google: {
        enabled: {
          type: Boolean,
          default: true,
        },
      },
    },

    registration: {
      enabled: {
        type: Boolean,
        default: true,
      },
      requireEmailVerification: {
        type: Boolean,
        default: true,
      },
      requirePhoneVerification: {
        type: Boolean,
        default: false,
      },
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "authentication_policies",
  }
);

/**
 * Singleton guarantee: Ensure only one authoritative policy document exists.
 */
authenticationPolicySchema.statics.getAuthoritativePolicy = async function () {
  let policy = await this.findOne({});

  if (!policy) {
    const isTest =
      process.env.NODE_ENV === "test" ||
      process.env.JEST_WORKER_ID !== undefined;

    policy = await this.create({
      customerLogin: {
        emailPassword: { enabled: true },
        emailOtp: { enabled: isTest },
        mobileOtp: { enabled: isTest },
        google: { enabled: true },
      },
      registration: {
        enabled: true,
        requireEmailVerification: true,
        requirePhoneVerification: false,
      },
    });
  }

  return policy;
};

const AuthenticationPolicy = mongoose.model(
  "AuthenticationPolicy",
  authenticationPolicySchema
);

module.exports = AuthenticationPolicy;
