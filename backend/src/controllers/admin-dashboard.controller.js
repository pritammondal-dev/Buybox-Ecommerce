const adminDashboardService = require("../services/admin-dashboard.service");

const getStats = async (req, res, next) => {
  try {
    const { range, startDate, endDate } = req.query;
    const data = await adminDashboardService.getDashboardStats(req.user, {
      range,
      startDate,
      endDate,
    });
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStats,
};
