const mongoose = require("mongoose");
const cartService = require("../src/services/cart.service");
const cartRepository = require("../src/repositories/cart.repository");
const ProductVariant = require("../src/models/ProductVariant");
const Product = require("../src/models/Product");
const Customer = require("../src/models/Customer");
const { addCartItemSchema } = require("../src/validators/cart/add-cart-item.validator");

jest.mock("../src/repositories/cart.repository");
jest.mock("../src/models/ProductVariant");
jest.mock("../src/models/Product");
jest.mock("../src/models/Customer");

describe("Cart Product-to-Variant Resolution Contract (Phase 3)", () => {
  const mockUserId = new mongoose.Types.ObjectId().toString();
  const mockCustomerId = new mongoose.Types.ObjectId();
  const mockProductId = new mongoose.Types.ObjectId().toString();
  const mockVariantId = new mongoose.Types.ObjectId().toString();

  const mockCustomer = {
    _id: mockCustomerId,
    userId: mockUserId,
    isActive: true,
  };

  const mockProduct = {
    _id: mockProductId,
    name: "Test Soundbar",
    status: "active",
  };

  const mockVariant = {
    _id: mockVariantId,
    productId: mockProductId,
    sku: "SBAR-BLK-01",
    price: mongoose.Types.Decimal128.fromString("4999.00"),
    currency: "INR",
    stockQuantity: 10,
    isActive: true,
  };

  const mockEmptyCart = {
    _id: new mongoose.Types.ObjectId(),
    customerId: mockCustomerId,
    currency: "INR",
    items: [],
    subtotal: mongoose.Types.Decimal128.fromString("0.00"),
    grandTotal: mongoose.Types.Decimal128.fromString("0.00"),
    discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
    taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
    shippingTotal: mongoose.Types.Decimal128.fromString("0.00"),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Customer.findOne.mockResolvedValue(mockCustomer);
    cartRepository.findActiveByCustomer.mockResolvedValue({
      ...mockEmptyCart,
      items: [],
    });
    cartRepository.updateById.mockImplementation((id, cart) => Promise.resolve(cart));
  });

  it("1. adds item successfully when valid productVariantId is provided", async () => {
    ProductVariant.findOne.mockResolvedValue(mockVariant);
    Product.findOne.mockResolvedValue(mockProduct);

    const result = await cartService.addItem(
      mockUserId,
      { productVariantId: mockVariantId },
      1
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].productVariantId.toString()).toBe(mockVariantId);
    expect(result.items[0].quantity).toBe(1);
  });

  it("2. returns 404 PRODUCT_VARIANT_NOT_FOUND when productVariantId does not exist", async () => {
    ProductVariant.findOne.mockResolvedValue(null);

    await expect(
      cartService.addItem(mockUserId, { productVariantId: mockVariantId }, 1)
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "PRODUCT_VARIANT_NOT_FOUND",
    });
  });

  it("3. returns 400 OUT_OF_STOCK when productVariantId has 0 stock", async () => {
    ProductVariant.findOne.mockResolvedValue({
      ...mockVariant,
      stockQuantity: 0,
    });
    Product.findOne.mockResolvedValue(mockProduct);

    await expect(
      cartService.addItem(mockUserId, { productVariantId: mockVariantId }, 1)
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "OUT_OF_STOCK",
    });
  });

  it("4. resolves single variant automatically when only productId is provided", async () => {
    Product.findOne.mockResolvedValue(mockProduct);
    ProductVariant.find.mockResolvedValue([mockVariant]);

    const result = await cartService.addItem(
      mockUserId,
      { productId: mockProductId },
      2
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].productVariantId.toString()).toBe(mockVariantId);
    expect(result.items[0].quantity).toBe(2);
  });

  it("5. returns 400 VARIANT_SELECTION_REQUIRED when productId has multiple variants", async () => {
    Product.findOne.mockResolvedValue(mockProduct);
    const mockVariant2 = {
      ...mockVariant,
      _id: new mongoose.Types.ObjectId().toString(),
      sku: "SBAR-WHT-02",
    };
    ProductVariant.find.mockResolvedValue([mockVariant, mockVariant2]);

    await expect(
      cartService.addItem(mockUserId, { productId: mockProductId }, 1)
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "VARIANT_SELECTION_REQUIRED",
    });
  });

  it("6. returns 400 NO_PURCHASABLE_VARIANT when productId has 0 active variants", async () => {
    Product.findOne.mockResolvedValue(mockProduct);
    ProductVariant.find.mockResolvedValue([]);

    await expect(
      cartService.addItem(mockUserId, { productId: mockProductId }, 1)
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "NO_PURCHASABLE_VARIANT",
    });
  });

  it("7. validator rejects payload missing both productVariantId and productId", () => {
    const parsed = addCartItemSchema.safeParse({ quantity: 1 });
    expect(parsed.success).toBe(false);
  });
});
