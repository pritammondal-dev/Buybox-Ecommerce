import apiClient from "../lib/api/axios.js";

export const supportService = {
  async createTicket(data) {
    return apiClient.post("/support-tickets", data);
  },

  async getMyTickets() {
    return apiClient.get("/support-tickets/my");
  },

  async getMyTicketById(ticketId) {
    return apiClient.get(`/support-tickets/my/${ticketId}`);
  },

  async getMyTicketMessages(ticketId) {
    return apiClient.get(`/support-tickets/${ticketId}/messages`);
  },

  async sendTicketMessage(ticketId, data) {
    return apiClient.post(`/support-tickets/${ticketId}/messages`, data);
  },
};

export default supportService;
