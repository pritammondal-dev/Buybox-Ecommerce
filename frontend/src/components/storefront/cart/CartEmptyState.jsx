"use client";

import React from "react";
import Link from "next/link";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { Button } from "../../ui/Button.jsx";

export function CartEmptyState() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <div className="mx-auto flex size-24 items-center justify-center rounded-3xl bg-[#FFF8D6] text-[#007A55] border border-amber-200/60 shadow-xs mb-6">
        <ShoppingBag className="size-12 stroke-[1.6]" />
      </div>

      <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
        Your Shopping Cart is Empty
      </h1>

      <p className="mt-3 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
        Your cart is currently empty. Explore our verified catalog of high-performance audio, mechanical hardware, and precision computer accessories.
      </p>

      <div className="mt-8">
        <Button asChild size="lg" className="rounded-full bg-[#007A55] hover:bg-[#006346] text-white font-bold text-sm px-8 py-3.5 shadow-md active:scale-95 transition-all">
          <Link href="/shop" className="inline-flex items-center gap-2">
            <span>Explore Products</span>
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default CartEmptyState;
