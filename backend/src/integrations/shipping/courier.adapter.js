/**
 * Base Courier Adapter Interface
 */
class CourierAdapter {
  constructor(name) {
    this.name = name;
  }

  async createShipment() {
    throw new Error(`${this.name}.createShipment() must be implemented`);
  }

  async trackShipment() {
    throw new Error(`${this.name}.trackShipment() must be implemented`);
  }

  async cancelShipment() {
    throw new Error(`${this.name}.cancelShipment() must be implemented`);
  }

  verifyWebhookSignature() {
    throw new Error(`${this.name}.verifyWebhookSignature() must be implemented`);
  }

  generateTrackingUrl(trackingNumber) {
    throw new Error(`${this.name}.generateTrackingUrl() must be implemented`);
  }
}

module.exports = CourierAdapter;
