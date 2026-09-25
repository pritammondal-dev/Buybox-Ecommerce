import api from "./api";

export const adminSavedViewsService = {
  getViews: async (resource) => {
    const res = await api.get("/api/v1/admin/saved-views", {
      params: { resource },
    });
    return res.data?.data?.views || [];
  },

  getView: async (id) => {
    const res = await api.get(`/api/v1/admin/saved-views/${id}`);
    return res.data?.data?.view;
  },

  createView: async (payload) => {
    const res = await api.post("/api/v1/admin/saved-views", payload);
    return res.data?.data?.view;
  },

  updateView: async (id, payload) => {
    const res = await api.patch(`/api/v1/admin/saved-views/${id}`, payload);
    return res.data?.data?.view;
  },

  deleteView: async (id) => {
    const res = await api.delete(`/api/v1/admin/saved-views/${id}`);
    return res.data?.data;
  },
};

export default adminSavedViewsService;
