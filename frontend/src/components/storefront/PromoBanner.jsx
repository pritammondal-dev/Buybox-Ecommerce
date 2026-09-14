import React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "../ui/Button.jsx";
import { cn } from "../../utils/cn.js";

export function PromoBanner({
  badge = "LIMITED TIME OFFER",
  title = "Upgrade Your Audio Experience",
  description = "Get up to 40% off on flagship noise-cancelling headphones and studio gear.",
  ctaText = "Explore Deals",
  ctaHref = "/shop?sort=discount",
  imageUrl,
  className,
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-primary/90 text-white p-6 sm:p-10 shadow-md",
        className
      )}
    >
      <div className="relative z-10 max-w-xl space-y-3">
        {badge && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-md px-3 py-1 text-xs font-semibold tracking-wider text-amber-300">
            <Sparkles className="size-3.5" />
            <span>{badge}</span>
          </div>
        )}

        <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
          {title}
        </h2>

        {description && (
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-md">
            {description}
          </p>
        )}

        {ctaText && ctaHref && (
          <div className="pt-2">
            <Button asChild size="lg" className="rounded-full bg-white text-slate-900 hover:bg-white/90 font-bold gap-2">
              <Link href={ctaHref}>
                <span>{ctaText}</span>
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        )}
      </div>

      {imageUrl && (
        <div className="absolute right-0 top-0 bottom-0 w-1/3 hidden md:block overflow-hidden opacity-80">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={title}
            className="size-full object-cover"
          />
        </div>
      )}
    </div>
  );
}

export default PromoBanner;
