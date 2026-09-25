const attributeService = require("../services/attribute.service");

const listAttributes = async (req, res, next) => {
  try {
    const { categoryId, isVariantAttribute, type, search, page, limit } = req.query;
    const result = await attributeService.listAttributes({
      categoryId,
      isVariantAttribute,
      type,
      search,
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getAttribute = async (req, res, next) => {
  try {
    const attribute = await attributeService.getAttributeById(req.params.id);
    res.status(200).json({
      success: true,
      data: attribute,
    });
  } catch (error) {
    next(error);
  }
};

const getCategoryAttributes = async (req, res, next) => {
  try {
    const attributes = await attributeService.getCategoryAttributes(req.params.id);
    res.status(200).json({
      success: true,
      data: attributes,
    });
  } catch (error) {
    next(error);
  }
};

const createAttribute = async (req, res, next) => {
  try {
    const attribute = await attributeService.createAttribute(
      req.body,
      req.user,
      req
    );
    res.status(201).json({
      success: true,
      message: "Attribute created successfully",
      data: attribute,
    });
  } catch (error) {
    next(error);
  }
};

const updateAttribute = async (req, res, next) => {
  try {
    const attribute = await attributeService.updateAttribute(
      req.params.id,
      req.body,
      req.user,
      req
    );
    res.status(200).json({
      success: true,
      message: "Attribute updated successfully",
      data: attribute,
    });
  } catch (error) {
    next(error);
  }
};

const deleteAttribute = async (req, res, next) => {
  try {
    const result = await attributeService.deleteAttribute(
      req.params.id,
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

module.exports = {
  listAttributes,
  getAttribute,
  getCategoryAttributes,
  createAttribute,
  updateAttribute,
  deleteAttribute,
};
