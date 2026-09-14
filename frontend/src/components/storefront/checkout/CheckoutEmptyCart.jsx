"use client";

import React from "react";
import Link from "next/link";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { Button } from "../../ui/Button.jsx";

export function CheckoutEmptyCart() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center space-y-6">
      <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-[#FFF8D6] text-[#007A55] shadow-xs">
        <ShoppingBag className="size-10 stroke-[1.75]" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-black text-slate-950 tracking-tight">
          Your Cart is Empty
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
          You don&apos;t have any items in your shopping cart to checkout. Browse our verified marketplace catalog to discover high-performance hardware and gear.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Link href="/shop">
          <Button className="rounded-full bg-[#007A55] hover:bg-[#006346] text-white text-xs font-bold px-6 py-3 shadow-md active:scale-95 transition-all">
            Explore Products
            <ArrowRight className="size-3.5 ml-1.5" />
          </Button>
        </Link>
        <Link href="/cart">
          <Button variant="outline" className="rounded-full border-slate-300 text-slate-800 text-xs font-bold px-6 py-3 hover:bg-slate-50 transition-all">
            View Cart
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default CheckoutEmptyCart;
