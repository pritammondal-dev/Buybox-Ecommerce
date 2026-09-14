"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RotateCcw, ArrowRight } from "lucide-react";
import { Button } from "../../../components/ui/Button.jsx";

export default function CartError({ error, reset }) {
  useEffect(() => {
    console.error("Cart route error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 border border-red-100 mb-6">
        <AlertCircle className="size-8" />
      </div>

      <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
        Could Not Load Shopping Cart
      </h1>

      <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
        {error?.message || "An unexpected issue occurred while retrieving your cart. Please try again."}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-[#007A55] hover:bg-[#006346] text-white font-bold text-xs py-2.5 px-6 shadow-sm flex items-center gap-2 cursor-pointer"
        >
          <RotateCcw className="size-3.5" />
          <span>Try Again</span>
        </Button>

        <Button
          asChild
          variant="outline"
          className="rounded-full text-xs font-semibold px-6 py-2.5"
        >
          <Link href="/shop" className="inline-flex items-center gap-1.5">
            <span>Continue Shopping</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
