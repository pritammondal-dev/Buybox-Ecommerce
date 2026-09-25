const savedViewService = require("../services/saved-view.service");

const listSavedViews = async (req, res, next) => {
  try {
    const { resource } = req.query;
    const views = await savedViewService.listSavedViews(resource, req.user);
    res.status(200).json({
      success: true,
      data: { views },
    });
  } catch (error) {
    next(error);
  }
};

const getSavedView = async (req, res, next) => {
  try {
    const view = await savedViewService.getSavedViewById(req.params.id, req.user);
    res.status(200).json({
      success: true,
      data: { view },
    });
  } catch (error) {
    next(error);
  }
};

const createSavedView = async (req, res, next) => {
  try {
    const view = await savedViewService.createSavedView(req.body, req.user);
    res.status(201).json({
      success: true,
      message: "Saved view created successfully",
      data: { view },
    });
  } catch (error) {
    next(error);
  }
};

const updateSavedView = async (req, res, next) => {
  try {
    const view = await savedViewService.updateSavedView(req.params.id, req.body, req.user);
    res.status(200).json({
      success: true,
      message: "Saved view updated successfully",
      data: { view },
    });
  } catch (error) {
    next(error);
  }
};

const deleteSavedView = async (req, res, next) => {
  try {
    const result = await savedViewService.deleteSavedView(req.params.id, req.user);
    res.status(200).json({
      success: true,
      message: "Saved view deleted successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listSavedViews,
  getSavedView,
  createSavedView,
  updateSavedView,
  deleteSavedView,
};
