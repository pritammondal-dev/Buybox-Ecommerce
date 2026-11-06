import { redirect } from "next/navigation";

export default function LegacyAdminStoreSettingsPage() {
  redirect("/administrator/settings/store");
}
