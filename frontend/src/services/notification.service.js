import apiClient from "../lib/api/axios.js";

export const notificationService = {
  async getNotifications(params = {}) {
    return apiClient.get("/notifications", { params });
  },

  async markAsRead(notificationId) {
    return apiClient.patch(`/notifications/${notificationId}/read`);
  },

  async markAllAsRead() {
    return apiClient.post("/notifications/mark-all-read");
  },
};

export default notificationService;
