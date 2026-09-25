const mongoose = require("mongoose");

const importExportJobSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    type: {
      type: String,
      required: true,
      enum: [
        "import_products",
        "export_products",
        "import_inventory",
        "export_inventory",
        "bulk_price_update",
        "bulk_stock_update",
      ],
      index: true,
    },

    scope: {
      type: String,
      enum: ["vendor", "platform_admin"],
      default: "vendor",
      index: true,
    },

    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
      index: true,
    },

    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    filename: {
      type: String,
      default: "",
      trim: true,
    },

    format: {
      type: String,
      enum: ["csv", "xlsx"],
      default: "csv",
    },

    status: {
      type: String,
      enum: [
        "queued",
        "processing",
        "completed",
        "completed_with_errors",
        "failed",
        "cancelled",
      ],
      default: "queued",
      index: true,
    },

    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    totalRecords: {
      type: Number,
      default: 0,
      min: 0,
    },

    processedRecords: {
      type: Number,
      default: 0,
      min: 0,
    },

    successfulRecords: {
      type: Number,
      default: 0,
      min: 0,
    },

    failedRecords: {
      type: Number,
      default: 0,
      min: 0,
    },

    errorDetails: [
      {
        rowNumber: { type: Number },
        sku: { type: String, default: "" },
        product: { type: String, default: "" },
        field: { type: String, default: "" },
        error: { type: String, required: true },
        suggestedAction: { type: String, default: "" },
      },
    ],

    summary: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },

    downloadUrl: {
      type: String,
      default: null,
    },

    startedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

importExportJobSchema.index({
  vendorId: 1,
  status: 1,
  createdAt: -1,
});

importExportJobSchema.index({
  scope: 1,
  status: 1,
  createdAt: -1,
});

module.exports = mongoose.model("ImportExportJob", importExportJobSchema);
