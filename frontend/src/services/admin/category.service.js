export {
  adminCatalogService,
} from "./admin.service.js";

import { adminCatalogService } from "./admin.service.js";

export const adminCategoryService = {
  list: adminCatalogService.listCategories,
  get: adminCatalogService.getCategory,
  create: adminCatalogService.createCategory,
  update: adminCatalogService.updateCategory,
  delete: adminCatalogService.deleteCategory,
};

export default adminCategoryService;
