"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MapPin,
  ChevronDown,
  Plus,
  Check,
  Building,
  Home,
  ExternalLink,
} from "lucide-react";
import { useAuthStore } from "../../../stores/auth.store.js";
import { useAddressStore } from "../../../stores/address.store.js";
import { cn } from "../../../utils/cn.js";
import { toast } from "sonner";

const emptySubscribe = () => () => {};

export function DeliveryLocationWidget({ className }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const isMounted = React.useSyncExternalStore(emptySubscribe, () => true, () => false);
  const dropdownRef = useRef(null);

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  const addresses = useAddressStore((state) => state.addresses);
  const selectedAddressId = useAddressStore((state) => state.selectedAddressId);
  const setSelectedAddressId = useAddressStore((state) => state.setSelectedAddressId);
  const fetchAddresses = useAddressStore((state) => state.fetchAddresses);
  const selectedAddress = useAddressStore((state) => state.getSelectedAddress());

  // Fetch addresses whenever user is authenticated and addresses are empty
  useEffect(() => {
    if (isAuthenticated) {
      fetchAddresses().catch(() => {});
    }
  }, [isAuthenticated, fetchAddresses]);

  // Click outside and Escape handler for location dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Handle widget click: toggle dropdown or route to address creation
  const handleWidgetClick = () => {
    if (!isAuthenticated) {
      router.push("/auth/login?redirect=/account/addresses");
      return;
    }

    if (addresses.length === 0) {
      router.push("/account/addresses");
      return;
    }

    setIsOpen((prev) => !prev);
  };

  const handleSelectAddress = (addr) => {
    const id = addr._id || addr.id;
    setSelectedAddressId(id);
    setIsOpen(false);
    toast.success("Delivery address updated", {
      description: `Delivering to ${addr.city}, ${addr.postalCode}`,
    });
  };

  // Determine label and sublabel
  const hasAddresses = isAuthenticated && addresses.length > 0;
  const displayAddress = hasAddresses ? selectedAddress : null;

  const displayPrimary = "Deliver to";
  let displaySecondary = "Add Address";

  if (isMounted && isAuthenticated) {
    if (displayAddress) {
      displaySecondary = `${displayAddress.city || "Area"}, ${displayAddress.postalCode || ""}`;
    } else {
      displaySecondary = "Add Address";
    }
  } else if (isMounted && !isAuthenticated) {
    displaySecondary = "Add Address";
  }

  return (
    <div ref={dropdownRef} className={cn("relative inline-block text-left", className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleWidgetClick}
        suppressHydrationWarning
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="Select delivery address"
        className="flex items-center gap-2 pl-1 cursor-pointer group text-left transition-opacity hover:opacity-90"
      >
        <div className="flex size-9 items-center justify-center rounded-full bg-emerald-50 text-[#007A55] transition-colors group-hover:bg-emerald-100 shrink-0">
          <MapPin className="size-4 stroke-[2.2]" />
        </div>
        <div className="flex flex-col text-left leading-tight">
          <span className="text-[11px] font-medium text-muted-foreground">
            {displayPrimary}
          </span>
          <span
            className={cn(
              "text-xs font-bold flex items-center gap-1 transition-colors",
              hasAddresses
                ? "text-foreground group-hover:text-[#007A55]"
                : "text-[#007A55] group-hover:underline"
            )}
          >
            <span className="truncate max-w-[130px] sm:max-w-[160px]">
              {displaySecondary}
            </span>
            {hasAddresses && (
              <ChevronDown className="size-3 text-muted-foreground group-hover:text-[#007A55] transition-colors shrink-0" />
            )}
          </span>
        </div>
      </button>

      {/* Location Selector Flyout Dropdown (Flipkart / Amazon inspired) */}
      {isOpen && hasAddresses && (
        <div
          role="dialog"
          aria-label="Delivery location selector"
          className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white p-4 shadow-elevated z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="border-b border-slate-100 pb-3 mb-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <MapPin className="size-4 text-[#007A55]" />
                <span>Choose Delivery Location</span>
              </h3>
              {user?.firstName && (
                <span className="text-[11px] font-semibold text-slate-500">
                  {user.firstName}&apos;s Addresses
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Select an address to see accurate product availability and shipping speed.
            </p>
          </div>

          {/* Saved Addresses List */}
          <div className="max-h-60 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
            {addresses.map((addr) => {
              const id = addr._id || addr.id;
              const isSelected = (selectedAddressId && id === selectedAddressId) || (!selectedAddressId && addr.isDefault);
              const addrType = (addr.type || "home").toLowerCase();

              return (
                <div
                  key={id}
                  onClick={() => handleSelectAddress(addr)}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer text-left group",
                    isSelected
                      ? "border-[#007A55] bg-emerald-50/50 shadow-2xs"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/70"
                  )}
                >
                  {/* Radio Indicator */}
                  <div
                    className={cn(
                      "mt-0.5 size-4 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                      isSelected
                        ? "border-[#007A55] bg-[#007A55] text-white"
                        : "border-slate-300 group-hover:border-slate-400 bg-white"
                    )}
                  >
                    {isSelected && <Check className="size-2.5 stroke-[3]" />}
                  </div>

                  {/* Address Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {[addr.firstName, addr.lastName].filter(Boolean).join(" ") || "Recipient"}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-bold uppercase text-slate-600">
                        {addrType === "work" ? (
                          <Building className="size-2.5" />
                        ) : (
                          <Home className="size-2.5" />
                        )}
                        {addrType}
                      </span>
                      {addr.isDefault && (
                        <span className="rounded bg-emerald-100 text-[#007A55] px-1.5 py-0.2 text-[9px] font-extrabold">
                          DEFAULT
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 truncate">
                      {addr.addressLine1}
                      {addr.addressLine2 ? `, ${addr.addressLine2}` : ""}
                    </p>
                    <p className="text-xs font-semibold text-slate-800">
                      {addr.city}, {addr.state} — {addr.postalCode}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="border-t border-slate-100 pt-3 mt-3 flex items-center justify-between text-xs">
            <Link
              href="/account/addresses"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center gap-1.5 font-bold text-[#007A55] hover:underline"
            >
              <Plus className="size-3.5" />
              <span>Add a new address</span>
            </Link>

            <Link
              href="/account/addresses"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 font-medium"
            >
              <span>Manage</span>
              <ExternalLink className="size-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default DeliveryLocationWidget;
