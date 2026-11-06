import React, { Suspense } from "react";
import Link from "next/link";
import { Store, ArrowLeft } from "lucide-react";
import { vendorService } from "@/services/vendor.service";
import { productService } from "@/services/product.service";
import { StorefrontPageView } from "./StorefrontPageView.jsx";
import { Skeleton } from "@/components/ui/Skeleton.jsx";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug || "";

  try {
    const res = await vendorService.getPublicStore(slug);
    const store = res?.data?.data?.store || res?.data?.store || res?.data;
    if (store) {
      const name = store.branding?.displayName || store.businessName;
      return {
        title: `${name} Store | Buybox`,
        description:
          store.branding?.description ||
          `Shop authentic audio products and electronics directly from ${name} on Buybox.`,
      };
    }
  } catch {
    // Fallback
  }

  const title = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    title: `${title} Store | Buybox`,
    description: `Shop genuine products online from ${title} at Buybox Marketplace.`,
  };
}

function StoreFallback() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Skeleton className="h-56 w-full rounded-3xl" />
      <div className="flex gap-4">
        <Skeleton className="h-10 w-36 rounded-xl" />
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export default async function StorePage({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug || "";

  let store = null;
  let products = [];

  try {
    const storeRes = await vendorService.getPublicStore(slug);
    store = storeRes?.data?.data?.store || storeRes?.data?.store || storeRes?.data || null;

    if (store) {
      // Fetch products for this store
      const productRes = await productService.getProducts({
        limit: 50,
        status: "active",
      });
      const allProducts =
        productRes?.data?.products ||
        (Array.isArray(productRes?.data) ? productRes.data : []);

      // Filter products belonging to this vendor slug if populated
      products = allProducts.filter((p) => {
        const pSlug = p.vendor?.businessSlug || p.vendor?.slug;
        const pName = p.vendor?.businessName;
        if (pSlug && pSlug.toLowerCase() === slug.toLowerCase()) return true;
        if (pName && pName.toLowerCase() === store.businessName.toLowerCase()) return true;
        return false;
      });

      // If no specifically matched products found, fallback to showing featured products
      if (products.length === 0 && allProducts.length > 0) {
        products = allProducts.slice(0, 8);
      }
    }
  } catch {
    // Store not found or network error
  }

  if (!store) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 text-center space-y-4">
        <div className="size-16 rounded-3xl bg-slate-100 text-slate-400 inline-flex items-center justify-center">
          <Store className="size-8" />
        </div>
        <h2 className="text-2xl font-black text-slate-900">Storefront Not Found</h2>
        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
          The merchant storefront &ldquo;{slug}&rdquo; does not exist or is currently inactive on the marketplace.
        </p>
        <div className="pt-2">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-bold shadow-xs transition-colors"
          >
            <ArrowLeft className="size-4" />
            <span>Explore All Products</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<StoreFallback />}>
      <StorefrontPageView store={store} initialProducts={products} />
    </Suspense>
  );
}

