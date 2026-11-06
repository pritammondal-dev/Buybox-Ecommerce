const mongoose = require("mongoose");

const locationItemSchema = new mongoose.Schema(
  {
    productVariantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
    },
    quantity: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Bin item quantity must be an integer",
      },
    },
  },
  { _id: true }
);

const warehouseLocationSchema = new mongoose.Schema(
  {
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
      index: true,
    },

    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 50,
    },

    zone: {
      type: String,
      default: "General",
      trim: true,
      maxlength: 50,
    },

    aisle: {
      type: String,
      default: null,
      trim: true,
      maxlength: 50,
    },

    rack: {
      type: String,
      default: null,
      trim: true,
      maxlength: 50,
    },

    shelf: {
      type: String,
      default: null,
      trim: true,
      maxlength: 50,
    },

    bin: {
      type: String,
      default: null,
      trim: true,
      maxlength: 50,
    },

    type: {
      type: String,
      enum: ["pick", "bulk", "receiving", "returns", "damaged", "staging"],
      default: "pick",
      index: true,
    },

    maxCapacity: {
      type: Number,
      default: 1000,
      min: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    items: [locationItemSchema],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

warehouseLocationSchema.index(
  { warehouseId: 1, code: 1 },
  { unique: true }
);

warehouseLocationSchema.virtual("totalUnits").get(function () {
  if (!this.items || !Array.isArray(this.items)) return 0;
  return this.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
});

warehouseLocationSchema.set("toJSON", { virtuals: true });
warehouseLocationSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("WarehouseLocation", warehouseLocationSchema);
