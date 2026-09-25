import { redirect } from "next/navigation";

export default function OrdersRedirect() {
  redirect("/administrator/operations/orders");
}
