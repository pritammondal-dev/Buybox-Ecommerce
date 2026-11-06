import { redirect } from "next/navigation";

export default function SystemLogsPage() {
  redirect("/administrator/security/audit-logs");
}
