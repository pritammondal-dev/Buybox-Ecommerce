import { redirect } from "next/navigation";

export default function ProductsRedirect() {
  redirect("/administrator/catalog/products");
}
