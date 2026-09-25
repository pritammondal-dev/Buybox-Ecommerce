import React, { Suspense } from "react";
import { productService } from "../../../services/product.service.js";
import { FlashSalePageView } from "./FlashSalePageView.jsx";
import { Skeleton } from "../../../components/ui/Skeleton.jsx";

export const metadata = {
  title: "Flash Sale | Limited-Time Audio Deals | Buybox",
  description: "Limited-hour flash sale on studio gear and earphones. Extra markdown while stocks last at Buybox.",
};

function FlashSaleFallback() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Skeleton className="h-44 w-full rounded-3xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export default async function FlashSalePage() {
  let products = [];

  try {
    const res = await productService.getProducts({
      sort: "discount",
      limit: 16,
      status: "active",
    });
    products = res?.data?.products || (Array.isArray(res?.data) ? res.data : []);
  } catch {
    // Non-blocking fallback
  }

  return (
    <Suspense fallback={<FlashSaleFallback />}>
      <FlashSalePageView products={products} />
    </Suspense>
  );
}
