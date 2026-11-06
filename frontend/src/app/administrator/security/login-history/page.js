import { redirect } from "next/navigation";

export default function SecurityLoginHistoryPage() {
  redirect("/administrator/security/audit-logs");
}
