"use client";

import React, { useState } from "react";
import PropTypes from "prop-types";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../ui/Button.jsx";

export function AddressForm({
  initialData = null,
  onSubmit,
  onCancel,
  isSubmitting = false,
}) {
  const isEditing = Boolean(initialData?._id || initialData?.id);

  const [formData, setFormData] = useState({
    firstName: initialData?.firstName || "",
    lastName: initialData?.lastName || "",
    phone: initialData?.phone || "",
    addressLine1: initialData?.addressLine1 || "",
    addressLine2: initialData?.addressLine2 || "",
    city: initialData?.city || "",
    state: initialData?.state || "",
    postalCode: initialData?.postalCode || "",
    country: initialData?.country || "IN",
    type: initialData?.type || "home",
    isDefault: initialData?.isDefault || false,
  });

  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    } else if (formData.firstName.trim().length > 50) {
      newErrors.firstName = "First name must be under 50 characters";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    } else if (formData.lastName.trim().length > 50) {
      newErrors.lastName = "Last name must be under 50 characters";
    }

    const cleanPhone = formData.phone.trim();
    if (!cleanPhone) {
      newErrors.phone = "Phone number is required";
    } else if (cleanPhone.length < 7 || cleanPhone.length > 20) {
      newErrors.phone = "Phone number must be between 7 and 20 digits";
    }

    if (!formData.addressLine1.trim()) {
      newErrors.addressLine1 = "Address line 1 is required";
    } else if (formData.addressLine1.trim().length > 200) {
      newErrors.addressLine1 = "Address line 1 must be under 200 characters";
    }

    if (formData.addressLine2 && formData.addressLine2.trim().length > 200) {
      newErrors.addressLine2 = "Address line 2 must be under 200 characters";
    }

    if (!formData.city.trim()) {
      newErrors.city = "City is required";
    } else if (formData.city.trim().length > 100) {
      newErrors.city = "City must be under 100 characters";
    }

    if (!formData.state.trim()) {
      newErrors.state = "State is required";
    } else if (formData.state.trim().length > 100) {
      newErrors.state = "State must be under 100 characters";
    }

    const cleanPin = formData.postalCode.trim();
    if (!cleanPin) {
      newErrors.postalCode = "Postal code is required";
    } else if (!/^[1-9][0-9]{5}$/.test(cleanPin) && (cleanPin.length < 3 || cleanPin.length > 20)) {
      newErrors.postalCode = "Please enter a valid postal code (e.g. 700001)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please correct the highlighted errors in the address form.");
      return;
    }

    const payload = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      phone: formData.phone.trim(),
      addressLine1: formData.addressLine1.trim(),
      addressLine2: formData.addressLine2.trim() || undefined,
      city: formData.city.trim(),
      state: formData.state.trim(),
      postalCode: formData.postalCode.trim(),
      country: formData.country.trim().toUpperCase() || "IN",
      type: formData.type,
      isDefault: formData.isDefault,
    };

    await onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/20 p-5">
      <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
          {isEditing ? "Edit Delivery Address" : "Add New Delivery Address"}
        </h3>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* First Name */}
        <div>
          <label htmlFor="addr-firstName" className="block text-xs font-bold text-slate-700 mb-1">
            First Name <span className="text-red-500">*</span>
          </label>
          <input
            id="addr-firstName"
            name="firstName"
            type="text"
            value={formData.firstName}
            onChange={handleChange}
            placeholder="John"
            disabled={isSubmitting}
            className={`w-full rounded-lg border px-3 py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-[#004D38] ${
              errors.firstName ? "border-red-400 bg-red-50/20" : "border-slate-300 bg-white"
            }`}
          />
          {errors.firstName && <p className="mt-1 text-[11px] text-red-500">{errors.firstName}</p>}
        </div>

        {/* Last Name */}
        <div>
          <label htmlFor="addr-lastName" className="block text-xs font-bold text-slate-700 mb-1">
            Last Name <span className="text-red-500">*</span>
          </label>
          <input
            id="addr-lastName"
            name="lastName"
            type="text"
            value={formData.lastName}
            onChange={handleChange}
            placeholder="Doe"
            disabled={isSubmitting}
            className={`w-full rounded-lg border px-3 py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-[#004D38] ${
              errors.lastName ? "border-red-400 bg-red-50/20" : "border-slate-300 bg-white"
            }`}
          />
          {errors.lastName && <p className="mt-1 text-[11px] text-red-500">{errors.lastName}</p>}
        </div>
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="addr-phone" className="block text-xs font-bold text-slate-700 mb-1">
          Phone Number <span className="text-red-500">*</span>
        </label>
        <input
          id="addr-phone"
          name="phone"
          type="tel"
          value={formData.phone}
          onChange={handleChange}
          placeholder="e.g. 9876543210"
          disabled={isSubmitting}
          className={`w-full rounded-lg border px-3 py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-[#004D38] ${
            errors.phone ? "border-red-400 bg-red-50/20" : "border-slate-300 bg-white"
          }`}
        />
        {errors.phone && <p className="mt-1 text-[11px] text-red-500">{errors.phone}</p>}
      </div>

      {/* Address Line 1 */}
      <div>
        <label htmlFor="addr-line1" className="block text-xs font-bold text-slate-700 mb-1">
          Street Address / House No. / Building <span className="text-red-500">*</span>
        </label>
        <input
          id="addr-line1"
          name="addressLine1"
          type="text"
          value={formData.addressLine1}
          onChange={handleChange}
          placeholder="Flat 4B, Emerald Heights, Park Street"
          disabled={isSubmitting}
          className={`w-full rounded-lg border px-3 py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-[#004D38] ${
            errors.addressLine1 ? "border-red-400 bg-red-50/20" : "border-slate-300 bg-white"
          }`}
        />
        {errors.addressLine1 && <p className="mt-1 text-[11px] text-red-500">{errors.addressLine1}</p>}
      </div>

      {/* Address Line 2 */}
      <div>
        <label htmlFor="addr-line2" className="block text-xs font-bold text-slate-700 mb-1">
          Landmark / Area (Optional)
        </label>
        <input
          id="addr-line2"
          name="addressLine2"
          type="text"
          value={formData.addressLine2}
          onChange={handleChange}
          placeholder="Near City Center Mall"
          disabled={isSubmitting}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-[#004D38]"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* City */}
        <div>
          <label htmlFor="addr-city" className="block text-xs font-bold text-slate-700 mb-1">
            City <span className="text-red-500">*</span>
          </label>
          <input
            id="addr-city"
            name="city"
            type="text"
            value={formData.city}
            onChange={handleChange}
            placeholder="Kolkata"
            disabled={isSubmitting}
            className={`w-full rounded-lg border px-3 py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-[#004D38] ${
              errors.city ? "border-red-400 bg-red-50/20" : "border-slate-300 bg-white"
            }`}
          />
          {errors.city && <p className="mt-1 text-[11px] text-red-500">{errors.city}</p>}
        </div>

        {/* State */}
        <div>
          <label htmlFor="addr-state" className="block text-xs font-bold text-slate-700 mb-1">
            State <span className="text-red-500">*</span>
          </label>
          <input
            id="addr-state"
            name="state"
            type="text"
            value={formData.state}
            onChange={handleChange}
            placeholder="West Bengal"
            disabled={isSubmitting}
            className={`w-full rounded-lg border px-3 py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-[#004D38] ${
              errors.state ? "border-red-400 bg-red-50/20" : "border-slate-300 bg-white"
            }`}
          />
          {errors.state && <p className="mt-1 text-[11px] text-red-500">{errors.state}</p>}
        </div>

        {/* Postal Code */}
        <div>
          <label htmlFor="addr-postalCode" className="block text-xs font-bold text-slate-700 mb-1">
            Postal Code <span className="text-red-500">*</span>
          </label>
          <input
            id="addr-postalCode"
            name="postalCode"
            type="text"
            maxLength={10}
            value={formData.postalCode}
            onChange={handleChange}
            placeholder="700001"
            disabled={isSubmitting}
            className={`w-full rounded-lg border px-3 py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-[#004D38] ${
              errors.postalCode ? "border-red-400 bg-red-50/20" : "border-slate-300 bg-white"
            }`}
          />
          {errors.postalCode && <p className="mt-1 text-[11px] text-red-500">{errors.postalCode}</p>}
        </div>
      </div>

      {/* Address Type & Default */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <div>
          <span className="block text-xs font-bold text-slate-700 mb-1">Address Type</span>
          <div className="flex items-center gap-3">
            {["home", "work", "other"].map((t) => (
              <label key={t} className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700">
                <input
                  type="radio"
                  name="type"
                  value={t}
                  checked={formData.type === t}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  className="accent-[#004D38]"
                />
                <span className="capitalize">{t}</span>
              </label>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
          <input
            type="checkbox"
            name="isDefault"
            checked={formData.isDefault}
            onChange={handleChange}
            disabled={isSubmitting}
            className="rounded border-slate-300 accent-[#004D38]"
          />
          <span>Set as default address</span>
        </label>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-emerald-100">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isSubmitting}
            className="text-xs font-bold text-slate-600"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting}
          className="bg-[#004D38] hover:bg-[#003D2C] text-white text-xs font-bold px-5"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="size-3.5 animate-spin" />
              Saving...
            </span>
          ) : isEditing ? (
            "Update Address"
          ) : (
            "Save & Deliver Here"
          )}
        </Button>
      </div>
    </form>
  );
}

AddressForm.propTypes = {
  initialData: PropTypes.shape({
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
  }),
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
  isSubmitting: PropTypes.bool,
};

export default AddressForm;
