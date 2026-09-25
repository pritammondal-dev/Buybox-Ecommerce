import { redirect } from "next/navigation";

export default function ProductDetailRedirect({ params }) {
  redirect(`/administrator/catalog/products/${params.id}`);
}
