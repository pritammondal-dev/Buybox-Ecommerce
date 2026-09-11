const analyticsService = require("../services/analytics.service");
const { sendSuccess } = require("../utils/apiResponse");

class AnalyticsController {
  /*
   * ==========================================
   * ADMIN CONTROLLER HANDLERS
   * ==========================================
   */
  async getAdminOverview(req, res, next) {
    try {
      const data = await analyticsService.getAdminOverview(req.query);
      return sendSuccess(res, {
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAdminTopProducts(req, res, next) {
    try {
      const data = await analyticsService.getAdminTopProducts(req.query);
      return sendSuccess(res, {
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAdminSalesTrend(req, res, next) {
    try {
      const data = await analyticsService.getAdminSalesTrend(req.query);
      return sendSuccess(res, {
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /*
   * ==========================================
   * VENDOR CONTROLLER HANDLERS
   * ==========================================
   */
  async getVendorOverview(req, res, next) {
    try {
      // Authenticated vendor identity is derived strictly from req.user.id
      const data = await analyticsService.getVendorOverview({
        userId: req.user.id,
        query: req.query,
      });
      return sendSuccess(res, {
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getVendorTopProducts(req, res, next) {
    try {
      // Authenticated vendor identity is derived strictly from req.user.id
      const data = await analyticsService.getVendorTopProducts({
        userId: req.user.id,
        query: req.query,
      });
      return sendSuccess(res, {
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getVendorSalesTrend(req, res, next) {
    try {
      // Authenticated vendor identity is derived strictly from req.user.id
      const data = await analyticsService.getVendorSalesTrend({
        userId: req.user.id,
        query: req.query,
      });
      return sendSuccess(res, {
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}

const controller = new AnalyticsController();

module.exports = {
  getAdminOverview: controller.getAdminOverview.bind(controller),
  getAdminTopProducts: controller.getAdminTopProducts.bind(controller),
  getAdminSalesTrend: controller.getAdminSalesTrend.bind(controller),
  getVendorOverview: controller.getVendorOverview.bind(controller),
  getVendorTopProducts: controller.getVendorTopProducts.bind(controller),
  getVendorSalesTrend: controller.getVendorSalesTrend.bind(controller),
};
