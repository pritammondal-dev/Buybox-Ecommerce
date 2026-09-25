import apiClient from "../lib/api/axios.js";

export const rewardService = {
  async getMyRewards() {
    return apiClient.get("/rewards/my");
  },
};

export default rewardService;
