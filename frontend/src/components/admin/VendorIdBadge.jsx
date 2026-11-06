"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

/**
 * VendorIdBadge
 * Displays the complete Vendor ID in a compact, constrained-width container (approx 180-220px)
 * wrapping long base64/encrypted strings cleanly across 2-3 lines with a copy-to-clipboard action.
 */
export function VendorIdBadge({ id, label = "ID:", className = "" }) {
  const [copied, setCopied] = useState(false);

  if (!id) return null;

  const handleCopy = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(id);
      } else if (typeof document !== "undefined") {
        const textarea = document.createElement("textarea");
        textarea.value = id;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      toast.success("Vendor ID copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy Vendor ID");
    }
  };

  return (
    <div
      className={`inline-flex items-start gap-1.5 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 max-w-[210px] text-[10px] font-mono leading-relaxed text-slate-600 dark:text-slate-300 shadow-2xs select-all ${className}`}
      title={`Vendor ID: ${id}`}
    >
      <div className="flex-1 break-all [overflow-wrap:anywhere] min-w-0">
        {label && (
          <span className="font-semibold text-slate-400 dark:text-slate-500 mr-1 select-none">
            {label}
          </span>
        )}
        <span className="text-slate-700 dark:text-slate-200">{id}</span>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy Vendor ID"
        title="Copy Vendor ID"
        className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition shrink-0 mt-0.5 select-none"
      >
        {copied ? (
          <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <Copy className="size-3" />
        )}
      </button>
    </div>
  );
}

export default VendorIdBadge;

