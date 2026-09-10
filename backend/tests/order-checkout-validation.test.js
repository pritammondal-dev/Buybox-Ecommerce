const ProductVariant = require("../src/models/ProductVariant");
const Product = require("../src/models/Product");
const { validateCartItems } = require("../src/services/order.service");

jest.mock("../src/models/ProductVariant");
jest.mock("../src/models/Product");

describe("Order Checkout - validateCartItems Performance Optimization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should batch-query variants and products using $in and lean()", async () => {
    const variantId1 = "64b0f0000000000000000011";
    const variantId2 = "64b0f0000000000000000012";
    const productId1 = "64b0f0000000000000000001";
    const productId2 = "64b0f0000000000000000002";

    const cart = {
      status: "active",
      currency: "INR",
      items: [
        { productVariantId: variantId1, quantity: 2 },
        { productVariantId: variantId2, quantity: 1 },
      ],
    };

    const mockVariants = [
      {
        _id: variantId1,
        productId: productId1,
        sku: "SKU-1",
        name: "Variant 1",
        price: "100.00",
        currency: "INR",
        isActive: true,
        deletedAt: null,
      },
      {
        _id: variantId2,
        productId: productId2,
        sku: "SKU-2",
        name: "Variant 2",
        price: "250.00",
        currency: "INR",
        isActive: true,
        deletedAt: null,
      },
    ];

    const mockProducts = [
      {
        _id: productId1,
        name: "Product 1",
        vendorId: "vendor-1",
        categoryId: "category-1",
        status: "active",
        deletedAt: null,
      },
      {
        _id: productId2,
        name: "Product 2",
        vendorId: "vendor-2",
        categoryId: "category-2",
        status: "active",
        deletedAt: null,
      },
    ];

    ProductVariant.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockVariants),
    });

    Product.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockProducts),
    });

    const orderItems = await validateCartItems(cart);

    expect(ProductVariant.find).toHaveBeenCalledTimes(1);
    expect(ProductVariant.find).toHaveBeenCalledWith({
      _id: { $in: [variantId1, variantId2] },
      isActive: true,
      deletedAt: null,
    });

    expect(Product.find).toHaveBeenCalledTimes(1);
    expect(Product.find).toHaveBeenCalledWith({
      _id: { $in: [productId1, productId2] },
      status: "active",
      deletedAt: null,
    });

    expect(orderItems).toHaveLength(2);
    expect(orderItems[0].lineTotal).toBe("200.00");
    expect(orderItems[1].lineTotal).toBe("250.00");
  });

  it("should throw CART_ITEM_UNAVAILABLE if a variant in the cart is missing", async () => {
    const variantId1 = "64b0f0000000000000000011";

    const cart = {
      status: "active",
      currency: "INR",
      items: [{ productVariantId: variantId1, quantity: 1 }],
    };

    ProductVariant.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    Product.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    await expect(validateCartItems(cart)).rejects.toMatchObject({
      statusCode: 400,
      code: "CART_ITEM_UNAVAILABLE",
    });
  });

  it("should throw PRODUCT_UNAVAILABLE if a product in the cart is inactive", async () => {
    const variantId1 = "64b0f0000000000000000011";
    const productId1 = "64b0f0000000000000000001";

    const cart = {
      status: "active",
      currency: "INR",
      items: [{ productVariantId: variantId1, quantity: 1 }],
    };

    ProductVariant.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          _id: variantId1,
          productId: productId1,
          sku: "SKU-1",
          price: "100.00",
          currency: "INR",
        },
      ]),
    });

    Product.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    await expect(validateCartItems(cart)).rejects.toMatchObject({
      statusCode: 400,
      code: "PRODUCT_UNAVAILABLE",
    });
  });
});
