"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  MapPin,
  Plus,
  Trash2,
  Edit2,
  Check,
  Shield,
  Phone,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { addressService } from "../../../services/address.service.js";
import { useAuth } from "../../../hooks/useAuth.js";
import { AccountNav } from "./AccountNav.jsx";
import { AddressForm } from "../checkout/AddressForm.jsx";
import { DeleteAddressModal } from "../checkout/DeleteAddressModal.jsx";
import { Skeleton } from "../../ui/Skeleton.jsx";

export function AddressesPageView() {
  const { isAuthenticated } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form modal state
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingAddress, setDeletingAddress] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Setting default address state
  const [settingDefaultId, setSettingDefaultId] = useState(null);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const refetchAddresses = () => setRefreshTrigger((prev) => prev + 1);

  useEffect(() => {
    let isMounted = true;

    async function loadAddresses() {
      if (!isAuthenticated) {
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        const res = await addressService.getAddresses();
        if (!isMounted) return;
        const list =
          res?.data?.addresses || (Array.isArray(res?.data) ? res.data : []);
        setAddresses(list);
      } catch (err) {
        if (!isMounted) return;
        setError(err?.message || "Failed to load addresses.");
        setAddresses([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadAddresses();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, refreshTrigger]);

  const handleOpenAdd = () => {
    setEditingAddress(null);
    setShowFormModal(true);
  };

  const handleOpenEdit = (addr) => {
    setEditingAddress(addr);
    setShowFormModal(true);
  };

  const handleFormSubmit = async (formData) => {
    setIsSubmitting(true);
    try {
      if (editingAddress) {
        const id = editingAddress._id || editingAddress.id;
        await addressService.updateAddress(id, formData);
        toast.success("Address Updated Successfully");
      } else {
        await addressService.createAddress(formData);
        toast.success("Address Added Successfully");
      }
      setShowFormModal(false);
      setEditingAddress(null);
      refetchAddresses();
    } catch (err) {
      toast.error("Failed to Save Address", {
        description: err?.message || "Please check the form inputs.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDelete = (addr) => {
    setDeletingAddress(addr);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async (id) => {
    setIsDeleting(true);
    try {
      await addressService.deleteAddress(id);
      toast.success("Address Deleted Successfully");
      setShowDeleteModal(false);
      setDeletingAddress(null);
      setAddresses((prev) => prev.filter((a) => (a._id || a.id) !== id));
    } catch (err) {
      toast.error("Failed to Delete Address", {
        description: err?.message || "Please try again.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSetDefault = async (addr) => {
    const id = addr._id || addr.id;
    setSettingDefaultId(id);
    try {
      await addressService.updateAddress(id, { isDefault: true });
      toast.success("Default Address Updated");
      // Update locally
      setAddresses((prev) =>
        prev.map((a) => ({
          ...a,
          isDefault: (a._id || a.id) === id,
        }))
      );
    } catch (err) {
      toast.error("Could not set default address", {
        description: err?.message,
      });
    } finally {
      setSettingDefaultId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-[#007A55] transition-colors">
          Home
        </Link>
        <span>/</span>
        <Link href="/account" className="hover:text-[#007A55] transition-colors">
          My Account
        </Link>
        <span>/</span>
        <span className="font-semibold text-foreground">Addresses</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Account Nav (4 cols) */}
        <div className="lg:col-span-4">
          <AccountNav />
        </div>

        {/* Right: Addresses List (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-2xl border bg-white p-6 shadow-xs space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                  Saved Delivery Addresses
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Manage shipping addresses for fast and seamless checkout
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#007A55] hover:bg-[#004D38] text-white font-bold text-xs px-5 py-2.5 transition-colors shadow-xs cursor-pointer"
              >
                <Plus className="size-4" />
                Add New Address
              </button>
            </div>

            {/* Content States */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <Skeleton className="h-44 w-full rounded-2xl" />
                <Skeleton className="h-44 w-full rounded-2xl" />
              </div>
            ) : error ? (
              <div className="py-12 text-center space-y-3">
                <AlertCircle className="size-10 text-rose-500 mx-auto" />
                <h3 className="text-sm font-bold text-slate-900">Failed to Load Addresses</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">{error}</p>
                <button
                  type="button"
                  onClick={refetchAddresses}
                  className="rounded-full bg-[#007A55] text-white font-bold text-xs px-6 py-2 hover:bg-[#004D38] cursor-pointer"
                >
                  Retry Loading
                </button>
              </div>
            ) : addresses.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <MapPin className="size-7 stroke-[1.5]" />
                </div>
                <h3 className="text-base font-bold text-slate-900">No Saved Addresses Yet</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Add your primary delivery address to speed up order checkout.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleOpenAdd}
                    className="inline-flex items-center gap-2 rounded-full bg-[#007A55] hover:bg-[#004D38] text-white font-bold text-xs px-6 py-2.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="size-4" />
                    Add Your First Address
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {addresses.map((addr) => {
                  const id = addr._id || addr.id;
                  const fullName = [addr.firstName, addr.lastName].filter(Boolean).join(" ");
                  const isSettingDefault = settingDefaultId === id;

                  return (
                    <div
                      key={id}
                      className={`relative flex flex-col justify-between rounded-2xl border p-5 transition-all bg-white shadow-xs ${
                        addr.isDefault
                          ? "border-[#007A55] ring-1 ring-[#007A55]/30 bg-emerald-50/10"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="space-y-2 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-slate-100">
                          <span className="font-bold text-sm text-slate-900">
                            {fullName || "Customer"}
                          </span>

                          <div className="flex items-center gap-1.5">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-700">
                              {addr.type || "HOME"}
                            </span>

                            {addr.isDefault && (
                              <span className="rounded-md bg-emerald-100 text-[#007A55] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider">
                                Default
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-0.5 text-slate-600">
                          <p>{addr.addressLine1}</p>
                          {addr.addressLine2 && <p>{addr.addressLine2}</p>}
                          <p>
                            {addr.city}, {addr.state} - {addr.postalCode}
                          </p>
                          <p className="text-slate-500 font-medium pt-1">
                            Phone: {addr.phone}
                          </p>
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="pt-4 mt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          {!addr.isDefault && (
                            <button
                              type="button"
                              disabled={isSettingDefault}
                              onClick={() => handleSetDefault(addr)}
                              className="text-[11px] font-bold text-[#007A55] hover:underline cursor-pointer disabled:opacity-50"
                            >
                              {isSettingDefault ? "Updating..." : "Set as Default"}
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(addr)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1 text-xs font-bold transition-colors cursor-pointer"
                          >
                            <Edit2 className="size-3" />
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenDelete(addr)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 px-3 py-1 text-xs font-bold transition-colors cursor-pointer"
                          >
                            <Trash2 className="size-3" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Address Form Modal (Add / Edit) */}
      {showFormModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
        >
          <div className="my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <AddressForm
              initialData={editingAddress}
              onSubmit={handleFormSubmit}
              onCancel={() => {
                setShowFormModal(false);
                setEditingAddress(null);
              }}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      )}

      {/* Delete Address Modal */}
      <DeleteAddressModal
        isOpen={showDeleteModal}
        address={deletingAddress}
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setShowDeleteModal(false);
          setDeletingAddress(null);
        }}
        isDeleting={isDeleting}
      />
    </div>
  );
}

export default AddressesPageView;
