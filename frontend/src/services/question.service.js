import apiClient from "../lib/api/axios.js";

export const questionService = {
  async getProductQuestions(productId, params = {}) {
    return apiClient.get(`/questions/product/${productId}`, { params });
  },

  async askQuestion(data) {
    return apiClient.post("/questions", data);
  },

  async answerQuestion(questionId, data) {
    return apiClient.post(`/questions/${questionId}/answers`, data);
  },

  async markQuestionHelpful(questionId) {
    return apiClient.post(`/questions/${questionId}/helpful`);
  },

  async markAnswerHelpful(questionId, answerId) {
    return apiClient.post(`/questions/${questionId}/answers/${answerId}/helpful`);
  },
};

export default questionService;
