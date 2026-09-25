import { redirect } from "next/navigation";

export default function WarehousesRedirect() {
  redirect("/administrator/inventory/warehouses");
}
