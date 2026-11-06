export {
  cmsPageService,
  adminMediaService,
} from "./admin.service.js";

export { default as adminBannerService } from "./banner.service.js";
export { default as adminEventPageService } from "./event-page.service.js";

import { cmsPageService, adminMediaService } from "./admin.service.js";
import adminBannerService from "./banner.service.js";
import adminEventPageService from "./event-page.service.js";

export const adminCmsService = {
  pages: cmsPageService,
  banners: adminBannerService,
  events: adminEventPageService,
  media: adminMediaService,
};

export default adminCmsService;
