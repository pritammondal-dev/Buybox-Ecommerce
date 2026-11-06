import { redirect } from "next/navigation";

export default async function OrderDetailRedirect({ params }) {
  const resolvedParams = await params;
  const id = resolvedParams?.id;
  redirect(`/administrator/operations/orders/${id}`);
}
