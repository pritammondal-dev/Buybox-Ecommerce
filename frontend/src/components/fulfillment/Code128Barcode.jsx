"use client";

import React, { useMemo } from "react";
import { encodeCode128 } from "@/utils/code128.util";

/**
 * Authentic Code 128 (Subset B) Vector Barcode Component
 * Compliant with ISO/IEC 15417.
 * Machine-readable by 1D optical scanners and smartphone barcode readers.
 */
export default function Code128Barcode({
  value,
  moduleWidth = 1.75,
  barHeight = 44,
  showText = true,
  className = "",
  altText = null,
}) {
  const barcodeData = useMemo(() => {
    if (!value || typeof value !== "string" || !value.trim()) {
      return null;
    }
    try {
      return encodeCode128(value.trim(), {
        moduleWidth,
        barHeight,
        quietZoneModules: 10,
      });
    } catch (err) {
      console.warn("Failed to generate Code 128 barcode:", err);
      return null;
    }
  }, [value, moduleWidth, barHeight]);

  if (!barcodeData) {
    return (
      <div className={`text-center py-2 px-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-400 font-mono ${className}`}>
        {value ? `*${value}*` : "NO BARCODE DATA"}
      </div>
    );
  }

  const { bars, totalWidth, totalHeight, text } = barcodeData;

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className="w-full h-auto max-h-12 max-w-[260px] block"
        shapeRendering="crispEdges"
        role="img"
        aria-label={altText || `Barcode for ${text}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width={totalWidth} height={totalHeight} fill="#ffffff" />
        {bars.map((bar, idx) => (
          <rect
            key={idx}
            x={bar.x}
            y={0}
            width={bar.width}
            height={bar.height}
            fill="#0f172a"
          />
        ))}
      </svg>
      {showText && (
        <span className="font-mono text-[10px] sm:text-[11px] font-medium tracking-widest text-slate-700 mt-1 select-all">
          *{text}*
        </span>
      )}
    </div>
  );
}

