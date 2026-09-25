import apiClient from "../lib/api/axios.js";

export const returnService = {
  async createReturnRequest(data) {
    return apiClient.post("/returns", data);
  },

  async getMyReturns() {
    return apiClient.get("/returns/my");
  },

  async getReturnsByOrderId(orderId) {
    return apiClient.get(`/returns/order/${orderId}`);
  },
};

export default returnService;
