import apiClient from "../lib/api/axios.js";

export const giftCardService = {
  async checkBalance(code) {
    return apiClient.post("/gift-cards/check-balance", { code });
  },

  async claimGiftCard(code) {
    return apiClient.post("/gift-cards/claim", { code });
  },

  async getMyGiftCards() {
    return apiClient.get("/gift-cards/my");
  },
};

export default giftCardService;
