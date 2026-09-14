"use client";

import React from "react";
import Link from "next/link";
import { PackageSearch, ArrowLeft, Home } from "lucide-react";
import { Button } from "../../../../components/ui/Button.jsx";

export default function ProductNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 sm:py-28 text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-5">
        <PackageSearch className="size-8 stroke-[1.8]" />
      </div>

      <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-slate-600 mb-3">
        404 Catalog Notice
      </span>

      <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-950">
        Product Not Found
      </h1>

      <p className="mt-3 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
        The hardware item or variant you are searching for might have been archived, discontinued, or moved to a different category slug.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button
          asChild
          className="rounded-full bg-[#007A55] hover:bg-[#006346] text-white font-bold text-xs px-6 py-2.5 shadow-sm gap-2 cursor-pointer"
        >
          <Link href="/shop">
            <ArrowLeft className="size-3.5" />
            <span>Explore All Products</span>
          </Link>
        </Button>

        <Button
          asChild
          variant="outline"
          className="rounded-full border-slate-200 text-slate-700 font-bold text-xs px-6 py-2.5 gap-2 cursor-pointer"
        >
          <Link href="/">
            <Home className="size-3.5" />
            <span>Back to Home</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
