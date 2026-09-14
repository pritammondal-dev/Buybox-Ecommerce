"use client";

import React, { useEffect } from "react";
import PropTypes from "prop-types";
import Link from "next/link";
import { AlertTriangle, RefreshCw, ShoppingBag } from "lucide-react";
import { Button } from "../../../components/ui/Button.jsx";

export default function CheckoutError({ error, reset }) {
  useEffect(() => {
    // Log error for telemetry
    console.error("Checkout route error boundary caught:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center space-y-6">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-red-50 text-red-600 shadow-xs">
        <AlertTriangle className="size-8 stroke-[1.75]" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-black text-slate-950 tracking-tight">
          Checkout Could Not Be Loaded
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
          We encountered an issue preparing your checkout session. Your items are safe in your shopping cart.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Button
          onClick={() => reset()}
          className="rounded-full bg-[#007A55] hover:bg-[#006346] text-white text-xs font-bold px-6 py-3 shadow-md active:scale-95 transition-all"
        >
          <RefreshCw className="size-3.5 mr-1.5" />
          Try Again
        </Button>

        <Link href="/cart">
          <Button
            variant="outline"
            className="rounded-full border-slate-300 text-slate-800 text-xs font-bold px-6 py-3 hover:bg-slate-50 transition-all"
          >
            <ShoppingBag className="size-3.5 mr-1.5" />
            Back to Cart
          </Button>
        </Link>
      </div>
    </div>
  );
}

CheckoutError.propTypes = {
  error: PropTypes.instanceOf(Error),
  reset: PropTypes.func.isRequired,
};
