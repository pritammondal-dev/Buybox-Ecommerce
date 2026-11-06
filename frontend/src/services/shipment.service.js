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

  /**
   * Check courier serviceability between pincodes
   */
  async checkServiceability(params = {}) {
    return apiClient.get("/shipments/serviceability", { params });
  },

  /**
   * Admin schedule shipment pickup
   */
  async schedulePickup(shipmentId, data = {}) {
    return apiClient.post(`/shipments/${shipmentId}/pickup`, data);
  },

  async scheduleShipmentPickup(shipmentId, data = {}) {
    return apiClient.post(`/shipments/${shipmentId}/pickup`, data);
  },

  /**
   * Admin get shipment label
   */
  async getLabel(shipmentId) {
    return apiClient.get(`/shipments/${shipmentId}/label`);
  },

  async getShipmentLabel(shipmentId) {
    return apiClient.get(`/shipments/${shipmentId}/label`);
  },

  /**
   * Admin cancel shipment
   */
  async cancelShipment(shipmentId, data = {}) {
    return apiClient.post(`/shipments/${shipmentId}/cancel`, data);
  },
};

export default shipmentService;
