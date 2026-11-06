export {
  couponService,
  campaignService,
  discountService,
} from "./admin.service.js";

import { couponService, campaignService, discountService } from "./admin.service.js";

export const adminMarketingService = {
  coupons: couponService,
  campaigns: campaignService,
  discounts: discountService,
};

export default adminMarketingService;
