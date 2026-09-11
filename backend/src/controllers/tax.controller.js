const taxService = require("../services/tax.service");
const orderService = require("../services/order.service");
const addressRepository = require("../repositories/address.repository");
const couponService = require("../services/coupon.service");
const ProductVariant = require("../models/ProductVariant");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const AppError = require("../errors/AppError");
const { sendSuccess } = require("../utils/apiResponse");
const {
  DEFAULT_TAX_PRICING_MODE,
  DEFAULT_TAX_CATEGORY,
} = require("../constants/tax.constants");

const createRule = async (req, res, next) => {
  try {
    const rule = await taxService.createTaxRule(req.body);
    return sendSuccess(res, {
      statusCode: 201,
      message: "Tax rule created successfully",
      data: rule,
    });
  } catch (error) {
    next(error);
  }
};

const getRules = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.country) {
      filter.country = String(req.query.country).trim().toUpperCase();
    }
    if (req.query.state) {
      filter.state = String(req.query.state).trim().toUpperCase();
    }
    if (req.query.taxCategory) {
      filter.taxCategory = req.query.taxCategory;
    }
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === "true";
    }

    const rules = await taxService.getTaxRules(filter);
    return sendSuccess(res, {
      data: rules,
    });
  } catch (error) {
    next(error);
  }
};

const getRuleById = async (req, res, next) => {
  try {
    const rule = await taxService.getTaxRuleById(req.params.id);
    return sendSuccess(res, {
      data: rule,
    });
  } catch (error) {
    next(error);
  }
};

const updateRule = async (req, res, next) => {
  try {
    const rule = await taxService.updateTaxRule(req.params.id, req.body);
    return sendSuccess(res, {
      message: "Tax rule updated successfully",
      data: rule,
    });
  } catch (error) {
    next(error);
  }
};

const deleteRule = async (req, res, next) => {
  try {
    await taxService.deleteTaxRule(req.params.id);
    return sendSuccess(res, {
      message: "Tax rule deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Non-authoritative tax preview quote endpoint.
 * Fetches authoritative catalog prices from database. Never trusts client prices.
 */
const previewTax = async (req, res, next) => {
  try {
    const {
      shippingAddressId,
      shippingAddress,
      items,
      couponCode,
      pricingMode = DEFAULT_TAX_PRICING_MODE,
    } = req.body;

    let address = shippingAddress;

    if (shippingAddressId) {
      address = await addressRepository.findById(
        shippingAddressId,
        req.user?.id
      );
      if (!address) {
        throw new AppError(
          "Shipping address not found",
          404,
          "SHIPPING_ADDRESS_NOT_FOUND"
        );
      }
    }

    if (!address || !address.country) {
      throw new AppError(
        "Destination country is required for tax preview",
        400,
        "SHIPPING_ADDRESS_REQUIRED"
      );
    }

    // Authoritative catalog fetch
    const variantIds = items.map((item) => item.productVariantId);
    const variants = await ProductVariant.find({
      _id: { $in: variantIds },
      isActive: true,
      deletedAt: null,
    }).lean();

    const variantMap = new Map(
      variants.map((v) => [v._id.toString(), v])
    );

    const baseCurrency = variants[0]?.currency || "INR";
    for (const variant of variants) {
      if (variant.currency && variant.currency !== baseCurrency) {
        throw new AppError(
          "All items in the preview must use the same currency",
          400,
          "CURRENCY_MISMATCH"
        );
      }
    }

    const productIds = [
      ...new Set(variants.map((v) => v.productId.toString())),
    ];

    const products = await Product.find({
      _id: { $in: productIds },
      status: "active",
      deletedAt: null,
    }).lean();

    const productMap = new Map(
      products.map((p) => [p._id.toString(), p])
    );

    const validatedItems = [];
    let subtotalMinorUnits = 0;

    for (const item of items) {
      const variant = variantMap.get(item.productVariantId.toString());
      if (!variant) {
        throw new AppError(
          `Variant unavailable: ${item.productVariantId}`,
          400,
          "VARIANT_UNAVAILABLE"
        );
      }

      const product = productMap.get(variant.productId.toString());
      if (!product) {
        throw new AppError(
          `Product unavailable: ${variant.productId}`,
          400,
          "PRODUCT_UNAVAILABLE"
        );
      }

      const unitPriceMinorUnits = taxService.decimalToMinorUnits(variant.price);
      const lineTotalMinorUnits = unitPriceMinorUnits * item.quantity;
      subtotalMinorUnits += lineTotalMinorUnits;

      validatedItems.push({
        productId: product._id,
        productVariantId: variant._id,
        vendorId: product.vendorId,
        categoryId: product.categoryId,
        sku: variant.sku,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: variant.price,
        lineTotal: taxService.minorUnitsToDecimalString(lineTotalMinorUnits),
        isTaxable:
          product.isTaxable !== undefined ? product.isTaxable : true,
        taxCategory: product.taxCategory || DEFAULT_TAX_CATEGORY,
        currency: variant.currency || baseCurrency,
      });
    }

    let couponDiscountMinorUnits = 0;
    if (couponCode && req.user?.id) {
      const customer = await Customer.findOne({
        userId: req.user.id,
        isActive: true,
        deletedAt: null,
      });

      if (customer) {
        const couponResult = await couponService.validateCoupon({
          code: couponCode,
          customerId: customer._id,
          orderAmount: Number(
            taxService.minorUnitsToDecimalString(subtotalMinorUnits)
          ),
          items: validatedItems,
        });

        couponDiscountMinorUnits = taxService.decimalToMinorUnits(
          couponResult.discountAmount
        );
      }
    }

    const taxResult = await taxService.calculateOrderTax({
      items: validatedItems,
      shippingAddress: address,
      couponDiscountMinorUnits,
      shippingTotalMinorUnits: 0,
      pricingMode,
      currency: baseCurrency,
    });

    const totals = orderService.calculateOrderTotals(
      taxResult.items,
      taxResult.currency,
      couponDiscountMinorUnits,
      taxResult
    );

    return sendSuccess(res, {
      message: "Tax preview generated",
      data: {
        isPreview: true,
        isAuthoritative: false,
        pricingMode: totals.pricingMode,
        currency: totals.currency,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        shippingTotal: totals.shippingTotal,
        grandTotal: totals.grandTotal,
        items: taxResult.items,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRule,
  getRules,
  getRuleById,
  updateRule,
  deleteRule,
  previewTax,
};
