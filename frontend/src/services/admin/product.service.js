export {
  adminCatalogService,
  adminImportExportService,
} from "./admin.service.js";

import { adminCatalogService } from "./admin.service.js";

export const adminProductService = {
  list: adminCatalogService.listProducts,
  get: adminCatalogService.getProduct,
  create: adminCatalogService.createProduct,
  update: adminCatalogService.updateProduct,
  delete: adminCatalogService.deleteProduct,
  restore: adminCatalogService.restoreProduct,
  bulkOperations: adminCatalogService.bulkOperations,
  getVariants: adminCatalogService.getVariantsForProduct,
  duplicate: adminCatalogService.duplicateProduct,
  createVariants: adminCatalogService.createBulkVariants,
};

export default adminProductService;
