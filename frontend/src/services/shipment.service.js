import apiClient from "../lib/api/axios.js";

/**
 * Shipment Service
 *
 * Backend route mount: /api/v1/shipments
 */
export const shipmentService = {
  /**
   * Get authenticated customer's shipments
   * @returns {Promise<Object>} { data: { shipments } }
   */
  async getMyShipments() {
    return apiClient.get("/shipments/my");
  },

  /**
   * Get authenticated customer shipment details by ID
   * @param {string} shipmentId
   * @returns {Promise<Object>} { data: { shipment } }
   */
  async getMyShipmentById(shipmentId) {
    return apiClient.get(`/shipments/my/${shipmentId}`);
  },

  /**
   * Track shipment by tracking number
   * @param {string} trackingNumber
   * @returns {Promise<Object>} { data: { shipment } }
   */
  async trackShipment(trackingNumber) {
    return apiClient.get(`/shipments/tracking/${trackingNumber}`);
  },

  /**
   * Get authenticated customer shipments for a specific order
   * @param {string} orderId
   * @returns {Promise<Object>} { data: shipments }
   */
  async getMyShipmentsByOrderId(orderId) {
    return apiClient.get(`/shipments/my/order/${orderId}`);
  },
};

export default shipmentService;
