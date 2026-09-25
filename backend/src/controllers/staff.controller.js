const staffService = require("../services/staff.service");

const listStaff = async (req, res, next) => {
  try {
    const result = await staffService.listStaff(req.query);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getStaff = async (req, res, next) => {
  try {
    const staff = await staffService.getStaffById(req.params.id);
    res.status(200).json({
      success: true,
      data: { staff },
    });
  } catch (error) {
    next(error);
  }
};

const createStaff = async (req, res, next) => {
  try {
    const staff = await staffService.createStaff(req.body, req.user, req);
    res.status(201).json({
      success: true,
      message: "Staff member created successfully",
      data: { staff },
    });
  } catch (error) {
    next(error);
  }
};

const updateStaff = async (req, res, next) => {
  try {
    const staff = await staffService.updateStaff(
      req.params.id,
      req.body,
      req.user,
      req
    );
    res.status(200).json({
      success: true,
      message: "Staff member updated successfully",
      data: { staff },
    });
  } catch (error) {
    next(error);
  }
};

const suspendStaff = async (req, res, next) => {
  try {
    const result = await staffService.suspendStaff(req.params.id, req.user, req);
    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const reactivateStaff = async (req, res, next) => {
  try {
    const result = await staffService.reactivateStaff(req.params.id, req.user, req);
    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const result = await staffService.resetStaffPassword(
      req.params.id,
      req.body.newPassword,
      req.user,
      req
    );
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

const revokeSessions = async (req, res, next) => {
  try {
    const result = await staffService.revokeStaffSessions(
      req.params.id,
      req.user,
      req
    );
    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getSessions = async (req, res, next) => {
  try {
    const result = await staffService.getStaffSessions(
      req.params.id,
      req.user
    );
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listStaff,
  getStaff,
  createStaff,
  updateStaff,
  suspendStaff,
  reactivateStaff,
  resetPassword,
  revokeSessions,
  getSessions,
};
