import { redirect } from "next/navigation";

export default function SettlementsRedirect() {
  redirect("/administrator/finance/settlements");
}
