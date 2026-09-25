"use client";

import React from "react";
import PropTypes from "prop-types";
import { Phone, Edit2, Trash2, CheckCircle2 } from "lucide-react";

export function AddressCard({
  address,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  isActionDisabled = false,
}) {
  const id = address._id || address.id;
  const fullName = [address.firstName, address.lastName].filter(Boolean).join(" ");
  const addressType = (address.type || "home").toUpperCase();

  return (
    <div
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      onClick={() => onSelect(id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(id);
        }
      }}
      className={`group relative flex flex-col justify-between rounded-xl border p-4 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#004D38] ${
        isSelected
          ? "border-[#004D38] bg-emerald-50/40 ring-1 ring-[#004D38]"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {isSelected ? (
            <CheckCircle2 className="size-5 text-[#004D38]" />
          ) : (
            <div className="size-5 rounded-full border-2 border-slate-300 group-hover:border-slate-400" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-sm text-slate-900">
              {fullName || "Customer"}
            </span>

            <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
              {addressType}
            </span>

            {address.isDefault && (
              <span className="inline-block rounded-md bg-[#004D38]/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#004D38]">
                Default
              </span>
            )}
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            {address.addressLine1}
            {address.addressLine2 && `, ${address.addressLine2}`}
          </p>
          <p className="text-xs text-slate-600">
            {address.city}, {address.state} —{" "}
            <span className="font-semibold text-slate-800">{address.postalCode}</span>
          </p>

          <div className="flex items-center gap-1 text-xs text-slate-600 pt-1">
            <Phone className="size-3.5 text-slate-400 shrink-0" />
            <span>{address.phone}</span>
          </div>
        </div>
      </div>

      {/* Card Actions: Edit / Delete */}
      <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-100 pt-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(address);
          }}
          disabled={isActionDisabled}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors disabled:opacity-50"
        >
          <Edit2 className="size-3" />
          Edit
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(address);
          }}
          disabled={isActionDisabled}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          <Trash2 className="size-3" />
          Delete
        </button>
      </div>
    </div>
  );
}

AddressCard.propTypes = {
  address: PropTypes.shape({
    _id: PropTypes.string,
    id: PropTypes.string,
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    phone: PropTypes.string,
    addressLine1: PropTypes.string,
    addressLine2: PropTypes.string,
    city: PropTypes.string,
    state: PropTypes.string,
    postalCode: PropTypes.string,
    country: PropTypes.string,
    type: PropTypes.string,
    isDefault: PropTypes.bool,
  }).isRequired,
  isSelected: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  isActionDisabled: PropTypes.bool,
};

export default AddressCard;
