import { redirect } from "next/navigation";

export default function LegacyAdminCampaignsPage() {
  redirect("/administrator/marketing/campaigns");
}
