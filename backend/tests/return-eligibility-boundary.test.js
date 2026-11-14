const { createReturnRequest, checkOrderReturnEligibility } = require('../src/services/return-request.service');
const mongoose = require('mongoose');

// Mock models and dependencies
jest.mock('../src/models/Order');
jest.mock('../src/models/Customer');
jest.mock('../src/models/Product');
jest.mock('../src/models/ProductVariant');
jest.mock('../src/models/Shipment');
jest.mock('../src/models/ReturnRequest');
jest.mock('../src/models/Refund');
jest.mock('../src/services/storefront-settings.service', () => ({
  isFeatureEnabled: jest.fn().mockResolvedValue(true)
}));
jest.mock('../src/services/customer-notification.service', () => ({
  createCustomerNotification: jest.fn().mockResolvedValue({})
}));

const Order = require('../src/models/Order');
const Customer = require('../src/models/Customer');
const Product = require('../src/models/Product');
const Shipment = require('../src/models/Shipment');
const ReturnRequest = require('../src/models/ReturnRequest');
const Refund = require('../src/models/Refund');

describe('Phase Acceptance-B: Return Eligibility Boundary Verification', () => {
  const customerId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const productAId = new mongoose.Types.ObjectId();
  const productBId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
    Customer.findOne.mockResolvedValue({ _id: customerId, userId });
    Product.findById.mockImplementation((id) => ({
      select: () => ({
        lean: () => Promise.resolve({
          _id: id,
          productType: 'physical',
          isVirtual: false,
          isDownloadable: false
        })
      })
    }));
    Refund.find.mockReturnValue({ lean: () => Promise.resolve([]) });
  });

  test('1. Split shipment: Item A delivered 8 days ago is rejected, Item B delivered 2 days ago is accepted despite order-level timestamp', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    const mockOrder = {
      _id: orderId,
      customerId,
      orderNumber: 'ORD-SPLIT-001',
      status: 'delivered',
      deliveredAt: twoDaysAgo, // Order-level says 2 days ago
      items: [
        { _id: new mongoose.Types.ObjectId(), productId: productAId, productName: 'Product A (Old)', quantity: 1, unitPrice: 500, lineTotal: 500 },
        { _id: new mongoose.Types.ObjectId(), productId: productBId, productName: 'Product B (New)', quantity: 1, unitPrice: 700, lineTotal: 700 }
      ],
      timeline: [],
      save: jest.fn().mockResolvedValue(true)
    };
    Order.findById.mockResolvedValue(mockOrder);

    // Two shipments for the split order
    Shipment.find.mockReturnValue({
      lean: () => Promise.resolve([
        {
          _id: new mongoose.Types.ObjectId(),
          orderId,
          status: 'delivered',
          deliveredAt: eightDaysAgo,
          items: [{ productId: productAId }]
        },
        {
          _id: new mongoose.Types.ObjectId(),
          orderId,
          status: 'delivered',
          deliveredAt: twoDaysAgo,
          items: [{ productId: productBId }]
        }
      ])
    });

    ReturnRequest.find.mockReturnValue({ lean: () => Promise.resolve([]) });
    ReturnRequest.findOne.mockResolvedValue(null);

    // Attempting return for Product A (delivered 8 days ago)
    await expect(
      createReturnRequest({
        userId,
        orderId: orderId.toString(),
        type: 'return',
        items: [{ productId: productAId.toString(), quantity: 1, reason: 'Defective' }]
      })
    ).rejects.toThrow('The return window of 7 days has expired for \'Product A (Old)\'');

    // Attempting return for Product B (delivered 2 days ago)
    ReturnRequest.create.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      returnNumber: 'RET-001',
      status: 'requested',
      items: [{ productId: productBId, quantity: 1 }]
    });

    const res = await createReturnRequest({
      userId,
      orderId: orderId.toString(),
      type: 'return',
      items: [{ productId: productBId.toString(), quantity: 1, reason: 'Wrong Size' }]
    });

    expect(res).toBeDefined();
    expect(res.status).toBe('requested');
  });

  test('2. Exact 7-day boundary: 6d 23h 59m is accepted; 7d 00h 01m is rejected', async () => {
    // 6 days 23 hours 59 minutes ago (inside window)
    const justInside = new Date(Date.now() - (6 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000 + 59 * 60 * 1000));
    // 7 days 00 hours 01 minute ago (outside window)
    const justOutside = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000 + 60 * 1000));

    const mockOrderInside = {
      _id: orderId,
      customerId,
      orderNumber: 'ORD-BOUND-001',
      status: 'delivered',
      deliveredAt: justInside,
      items: [{ _id: new mongoose.Types.ObjectId(), productId: productAId, productName: 'Item Inside', quantity: 1, unitPrice: 300, lineTotal: 300 }],
      timeline: [],
      save: jest.fn().mockResolvedValue(true)
    };

    Order.findById.mockResolvedValue(mockOrderInside);
    Shipment.find.mockReturnValue({
      lean: () => Promise.resolve([{ orderId, status: 'delivered', deliveredAt: justInside, items: [{ productId: productAId }] }])
    });
    ReturnRequest.find.mockReturnValue({ lean: () => Promise.resolve([]) });
    ReturnRequest.findOne.mockResolvedValue(null);
    ReturnRequest.create.mockResolvedValue({ _id: new mongoose.Types.ObjectId(), status: 'requested' });

    const accepted = await createReturnRequest({
      userId,
      orderId: orderId.toString(),
      type: 'return',
      items: [{ productId: productAId.toString(), quantity: 1 }]
    });
    expect(accepted.status).toBe('requested');

    // Now test just outside
    const mockOrderOutside = {
      ...mockOrderInside,
      deliveredAt: justOutside,
      items: [{ _id: new mongoose.Types.ObjectId(), productId: productAId, productName: 'Item Outside', quantity: 1, unitPrice: 300, lineTotal: 300 }]
    };
    Order.findById.mockResolvedValue(mockOrderOutside);
    Shipment.find.mockReturnValue({
      lean: () => Promise.resolve([{ orderId, status: 'delivered', deliveredAt: justOutside, items: [{ productId: productAId }] }])
    });

    await expect(
      createReturnRequest({
        userId,
        orderId: orderId.toString(),
        type: 'return',
        items: [{ productId: productAId.toString(), quantity: 1 }]
      })
    ).rejects.toThrow('The return window of 7 days has expired');
  });

  test('3. Undelivered shipment (in_transit) rejects return even if order status is erroneously set to delivered', async () => {
    const mockOrder = {
      _id: orderId,
      customerId,
      orderNumber: 'ORD-UNDELIV-001',
      status: 'delivered', // Erroneously set at order level
      deliveredAt: new Date(),
      items: [{ _id: new mongoose.Types.ObjectId(), productId: productAId, productName: 'In Transit Item', quantity: 1, unitPrice: 400, lineTotal: 400 }],
      timeline: [],
      save: jest.fn().mockResolvedValue(true)
    };
    Order.findById.mockResolvedValue(mockOrder);

    // Shipment is in_transit
    Shipment.find.mockReturnValue({
      lean: () => Promise.resolve([{
        orderId,
        status: 'in_transit', // Authoritative shipment status
        deliveredAt: null,
        items: [{ productId: productAId }]
      }])
    });

    ReturnRequest.find.mockReturnValue({ lean: () => Promise.resolve([]) });

    await expect(
      createReturnRequest({
        userId,
        orderId: orderId.toString(),
        type: 'return',
        items: [{ productId: productAId.toString(), quantity: 1 }]
      })
    ).rejects.toThrow('Returns can only be requested for delivered orders');
  });
});
