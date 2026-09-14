"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, ArrowLeft } from "lucide-react";
import { Button } from "../../../../components/ui/Button.jsx";

export default function ProductDetailsError({ error, reset }) {
  useEffect(() => {
    // Log unexpected errors
    console.error("Product Page Error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-20 sm:py-28 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 mb-5">
        <AlertTriangle className="size-7 stroke-[2]" />
      </div>

      <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
        Unable to Load Product Details
      </h1>

      <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
        {error?.message ||
          "We encountered a temporary issue while communicating with the catalog service. Please try reloading."}
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-[#007A55] hover:bg-[#006346] text-white font-bold text-xs px-6 py-2.5 shadow-sm gap-2 cursor-pointer"
        >
          <RotateCcw className="size-3.5" />
          <span>Try Again</span>
        </Button>

        <Button
          asChild
          variant="outline"
          className="rounded-full border-slate-200 text-slate-700 font-bold text-xs px-6 py-2.5 gap-2 cursor-pointer"
        >
          <Link href="/shop">
            <ArrowLeft className="size-3.5" />
            <span>Browse Catalog</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
