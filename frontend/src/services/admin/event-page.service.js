import apiClient from "../../lib/api/axios.js";

/**
 * Admin CMS Special Event Page Service
 */
export const adminEventPageService = {
  list: async (params = {}) => {
    const res = await apiClient.get("/cms/events", { params });
    return res?.data?.data || res?.data || [];
  },

  get: async (id) => {
    const res = await apiClient.get(`/cms/events/${id}`);
    return res?.data?.data || res?.data || null;
  },

  create: async (data) => {
    const res = await apiClient.post("/cms/events", data);
    return res?.data?.data || res?.data;
  },

  update: async (id, data) => {
    const res = await apiClient.patch(`/cms/events/${id}`, data);
    return res?.data?.data || res?.data;
  },

  duplicate: async (id) => {
    const res = await apiClient.post(`/cms/events/${id}/duplicate`);
    return res?.data?.data || res?.data;
  },

  publish: async (id) => {
    const res = await apiClient.patch(`/cms/events/${id}/publish`);
    return res?.data?.data || res?.data;
  },

  unpublish: async (id) => {
    const res = await apiClient.patch(`/cms/events/${id}/unpublish`);
    return res?.data?.data || res?.data;
  },

  archive: async (id) => {
    const res = await apiClient.patch(`/cms/events/${id}/archive`);
    return res?.data?.data || res?.data;
  },

  delete: async (id) => {
    const res = await apiClient.delete(`/cms/events/${id}`);
    return res?.data?.data || res?.data;
  },
};

export default adminEventPageService;
