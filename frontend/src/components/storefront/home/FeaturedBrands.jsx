"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { SectionHeading } from "../SectionHeading.jsx";
import { Skeleton } from "../../ui/Skeleton.jsx";
import { brandService } from "../../../services/brand.service.js";

export function FeaturedBrands({ initialBrands = [] }) {
  const [brands, setBrands] = useState(initialBrands);
  const [isLoading, setIsLoading] = useState(initialBrands.length === 0);

  useEffect(() => {
    if (initialBrands.length > 0) return;
    let isMounted = true;
    brandService
      .getBrands({ limit: 12 })
      .then((res) => {
        if (!isMounted) return;
        const list = res?.data?.brands || res?.data || [];
        setBrands(Array.isArray(list) ? list : []);
        setIsLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setBrands([]);
        setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [initialBrands.length]);

  return (
    <section aria-label="Featured Brands" className="py-10 sm:py-14 bg-muted/20 border-t border-border/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Featured Brands"
          subtitle="Direct partnerships with premier hardware and audio manufacturers"
          viewAllHref="/shop"
          viewAllLabel="All Brands"
        />

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={`brand-skel-${i}`} className="flex h-20 items-center justify-center rounded-xl border bg-card p-4">
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </div>
        ) : brands.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-dashed text-center">
            <p className="text-sm font-medium text-foreground">Verified Manufacturer Catalog</p>
            <p className="text-xs text-muted-foreground mt-1">
              Top hardware brands with manufacturer warranties.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {brands.map((brand) => {
              const brandId = brand._id || brand.id;
              const hasLogo = Boolean(brand.logo?.url);

              return (
                <Link
                  key={brandId}
                  href={`/shop?brandId=${brandId}`}
                  className="group flex h-20 items-center justify-center rounded-xl border border-border/70 bg-card p-4 text-center shadow-xs transition-all duration-300 hover:border-accent/40 hover:bg-card hover:shadow-card hover:-translate-y-0.5"
                >
                  {hasLogo ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={brand.logo.url}
                      alt={brand.name}
                      className="max-h-8 max-w-full object-contain grayscale transition-all duration-300 group-hover:grayscale-0"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-sm font-bold tracking-wider text-muted-foreground transition-colors group-hover:text-foreground">
                      {brand.name}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default FeaturedBrands;
