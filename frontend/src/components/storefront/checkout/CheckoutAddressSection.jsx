"use client";

import React, { useState } from "react";
import PropTypes from "prop-types";
import { Plus, MapPin, Loader2 } from "lucide-react";
import { Button } from "../../ui/Button.jsx";
import { AddressCard } from "./AddressCard.jsx";
import { AddressForm } from "./AddressForm.jsx";
import { DeleteAddressModal } from "./DeleteAddressModal.jsx";

export function CheckoutAddressSection({
  addresses = [],
  selectedAddressId,
  onSelectAddress,
  onCreateAddress,
  onUpdateAddress,
  onDeleteAddress,
  isLoading = false,
  isMutating = false,
}) {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [deletingAddress, setDeletingAddress] = useState(null);

  const handleCreate = async (payload) => {
    const success = await onCreateAddress(payload);
    if (success) {
      setIsAddingNew(false);
    }
  };

  const handleUpdate = async (payload) => {
    const id = editingAddress?._id || editingAddress?.id;
    const success = await onUpdateAddress(id, payload);
    if (success) {
      setEditingAddress(null);
    }
  };

  const handleDelete = async (id) => {
    const success = await onDeleteAddress(id);
    if (success) {
      setDeletingAddress(null);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-full bg-[#007A55] text-white text-xs font-black">
            1
          </span>
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-950">
            Delivery Address
          </h2>
        </div>

        {!isAddingNew && !editingAddress && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsAddingNew(true)}
            disabled={isLoading || isMutating}
            className="text-xs font-bold text-[#007A55] hover:text-[#006346] gap-1"
          >
            <Plus className="size-3.5" />
            Add Address
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3 py-3">
          <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
        </div>
      ) : isAddingNew ? (
        <AddressForm
          onSubmit={handleCreate}
          onCancel={() => setIsAddingNew(false)}
          isSubmitting={isMutating}
        />
      ) : editingAddress ? (
        <AddressForm
          initialData={editingAddress}
          onSubmit={handleUpdate}
          onCancel={() => setEditingAddress(null)}
          isSubmitting={isMutating}
        />
      ) : addresses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center space-y-3">
          <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <MapPin className="size-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800">No saved addresses found</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Please add a delivery address to complete your order.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setIsAddingNew(true)}
            className="bg-[#007A55] hover:bg-[#006346] text-white text-xs font-bold"
          >
            <Plus className="size-3.5 mr-1" />
            Add New Address
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {addresses.map((addr) => {
            const id = addr._id || addr.id;
            const isSelected = selectedAddressId === id;

            return (
              <AddressCard
                key={id}
                address={addr}
                isSelected={isSelected}
                onSelect={onSelectAddress}
                onEdit={(a) => setEditingAddress(a)}
                onDelete={(a) => setDeletingAddress(a)}
                isActionDisabled={isMutating}
              />
            );
          })}
        </div>
      )}

      {/* Delete Address Confirmation Modal */}
      <DeleteAddressModal
        isOpen={Boolean(deletingAddress)}
        address={deletingAddress}
        onConfirm={handleDelete}
        onCancel={() => setDeletingAddress(null)}
        isDeleting={isMutating}
      />
    </div>
  );
}

CheckoutAddressSection.propTypes = {
  addresses: PropTypes.array,
  selectedAddressId: PropTypes.string,
  onSelectAddress: PropTypes.func.isRequired,
  onCreateAddress: PropTypes.func.isRequired,
  onUpdateAddress: PropTypes.func.isRequired,
  onDeleteAddress: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
  isMutating: PropTypes.bool,
};

export default CheckoutAddressSection;
