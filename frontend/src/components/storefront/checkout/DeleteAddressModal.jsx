"use client";

import React, { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "../../ui/Button.jsx";

export function DeleteAddressModal({
  isOpen,
  address,
  onConfirm,
  onCancel,
  isDeleting = false,
}) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      cancelRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen || !address) return null;

  const fullName = [address.firstName, address.lastName].filter(Boolean).join(" ");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-address-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-red-50 text-red-600 shrink-0">
            <AlertTriangle className="size-5 stroke-[2]" />
          </div>
          <div>
            <h3 id="delete-address-title" className="text-base font-black text-slate-900">
              Delete Address
            </h3>
            <p className="text-xs text-slate-500">
              Are you sure you want to remove this delivery address?
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600 space-y-0.5">
          <p className="font-bold text-slate-800">{fullName}</p>
          <p>{address.addressLine1}</p>
          <p>{address.city}, {address.state} - {address.postalCode}</p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            ref={cancelRef}
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isDeleting}
            className="text-xs font-bold text-slate-600"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => onConfirm(address._id || address.id)}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4"
          >
            {isDeleting ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="size-3.5 animate-spin" />
                Deleting...
              </span>
            ) : (
              "Delete Address"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

DeleteAddressModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  address: PropTypes.shape({
    _id: PropTypes.string,
    id: PropTypes.string,
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    addressLine1: PropTypes.string,
    city: PropTypes.string,
    state: PropTypes.string,
    postalCode: PropTypes.string,
  }),
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  isDeleting: PropTypes.bool,
};

export default DeleteAddressModal;
