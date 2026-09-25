const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: false,
      lowercase: true,
      trim: true,
      sparse: true,
      unique: true,
    },

    phone: {
      type: String,
      required: false,
      trim: true,
      default: undefined,
    },

    password: {
      type: String,
      required: false,
      select: false,
    },

    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    role: {
      type: String,
      enum: [
        "customer",
        "vendor",
        "support",
        "manager",
        "editor",
        "admin",
        "super_admin",
      ],
      default: "customer",
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    isPhoneVerified: {
      type: Boolean,
      default: false,
    },

    authProviders: {
      google: {
        id: { type: String, default: undefined },
        email: { type: String, default: undefined },
        linkedAt: { type: Date, default: undefined },
      },
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    authVersion: {
      type: Number,
      default: 1,
      min: 1,
    },

    permissionVersion: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Require at least email or phone on validation
userSchema.pre("validate", function () {
  if (!this.email && !this.phone) {
    throw new Error("User identity requires at least an email address or a phone number.");
  }
});

// Partial index for phone (only index when string, allowing multiple users without phone)
userSchema.index(
  { phone: 1 },
  {
    unique: true,
    partialFilterExpression: { phone: { $type: "string" } },
    name: "phone_1",
  }
);

// Partial index for Google auth provider ID (only index when string)
userSchema.index(
  { "authProviders.google.id": 1 },
  {
    unique: true,
    partialFilterExpression: { "authProviders.google.id": { $type: "string" } },
    name: "google_id_1",
  }
);

// Enforce invariant: Exactly one active Superadmin on the platform
userSchema.index(
  { role: 1 },
  {
    unique: true,
    partialFilterExpression: { role: "super_admin", isActive: true },
    name: "unique_active_superadmin_idx",
  }
);

userSchema.pre("save", async function () {
  if (this.isModified("role") || this.isModified("isActive")) {
    if (this.role === "super_admin" && this.isActive === true) {
      const existingSuperadmin = await mongoose.model("User").findOne({
        role: "super_admin",
        isActive: true,
        _id: { $ne: this._id },
      });
      if (existingSuperadmin) {
        throw new Error(
          "INVARIANT_VIOLATION: Only one active Superadmin may exist on the platform."
        );
      }
    }
  }
});

module.exports = mongoose.model("User", userSchema);