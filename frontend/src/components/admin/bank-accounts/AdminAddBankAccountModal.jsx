"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Landmark,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  Lock,
  Loader2,
  Plus,
  Globe,
  MapPin,
} from "lucide-react";
import { SearchableBankSelect } from "../../shared/SearchableBankSelect.jsx";
import { SUPPORTED_COUNTRIES, INDIAN_STATES } from "../../../constants/bank-geo.constants.js";

export function AdminAddBankAccountModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  remainingSlots = 3,
  vendorName = "",
}) {
  const [country, setCountry] = useState("IN");
  const [state, setState] = useState("");
  const [partnerBankId, setPartnerBankId] = useState(null);
  const [bankName, setBankName] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [branchName, setBranchName] = useState("");
  const [accountType, setAccountType] = useState("current");
  const [reason, setReason] = useState("");
  const [autoApprove, setAutoApprove] = useState(false);
  const [setActive, setSetActive] = useState(false);

  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const resetForm = () => {
    setCountry("IN");
    setState("");
    setPartnerBankId(null);
    setBankName("");
    setAccountHolderName("");
    setAccountNumber("");
    setConfirmAccountNumber("");
    setIfscCode("");
    setBranchName("");
    setAccountType("current");
    setReason("");
    setAutoApprove(false);
    setSetActive(false);
    setShowAccountNumber(false);
    setErrors({});
    setServerError("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleBankSelect = (bankObj, bankId, bankNameVal) => {
    setPartnerBankId(bankId || null);
    setBankName(bankNameVal || "");
    if (bankObj?.ifscPrefix && !ifscCode) {
      setIfscCode(bankObj.ifscPrefix);
    }
    if (errors.bankName) {
      setErrors((prev) => ({ ...prev, bankName: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!bankName.trim()) {
      newErrors.bankName = "Please select or enter bank name";
    }

    if (!accountHolderName.trim()) {
      newErrors.accountHolderName = "Account holder name is required";
    } else if (accountHolderName.trim().length < 2) {
      newErrors.accountHolderName = "Must be at least 2 characters";
    } else if (accountHolderName.trim().length > 150) {
      newErrors.accountHolderName = "Cannot exceed 150 characters";
    }

    const cleanAccNum = accountNumber.replace(/[\s-]/g, "");
    if (!cleanAccNum) {
      newErrors.accountNumber = "Bank account number is required";
    } else if (!/^[0-9]{9,20}$/.test(cleanAccNum)) {
      newErrors.accountNumber = "Account number must be 9 to 20 digits";
    }

    const cleanConfirm = confirmAccountNumber.replace(/[\s-]/g, "");
    if (!cleanConfirm) {
      newErrors.confirmAccountNumber = "Please confirm the account number";
    } else if (cleanAccNum !== cleanConfirm) {
      newErrors.confirmAccountNumber = "Account numbers do not match";
    }

    if (country === "IN") {
      const cleanIFSC = ifscCode.trim().toUpperCase();
      if (!cleanIFSC) {
        newErrors.ifscCode = "IFSC code is required for Indian bank accounts";
      } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIFSC)) {
        newErrors.ifscCode = "Invalid Indian IFSC format (e.g., HDFC0001234)";
      }
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      newErrors.reason = "Administrative justification is mandatory";
    } else if (trimmedReason.length < 10) {
      newErrors.reason = "Justification must be at least 10 characters";
    } else if (trimmedReason.length > 500) {
      newErrors.reason = "Justification cannot exceed 500 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    if (!validateForm()) return;

    const payload = {
      partnerBankId: partnerBankId || undefined,
      bankName: bankName.trim(),
      country,
      state: state.trim() || undefined,
      accountHolderName: accountHolderName.trim(),
      accountNumber: accountNumber.replace(/[\s-]/g, ""),
      confirmAccountNumber: confirmAccountNumber.replace(/[\s-]/g, ""),
      ifscCode: country === "IN" ? ifscCode.trim().toUpperCase() : ifscCode.trim().toUpperCase() || undefined,
      branchName: branchName.trim() || undefined,
      accountType,
      reason: reason.trim(),
      autoApprove: Boolean(autoApprove),
      setActive: Boolean(autoApprove && setActive),
    };

    try {
      await onSubmit(payload);
      resetForm();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to create bank account";
      setServerError(msg);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-add-bank-title"
    >
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={() => !isSubmitting && handleClose()}
      />

      <div className="relative bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200 my-8">
        <div className="p-6 bg-slate-50/80 border-b border-slate-100 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center shrink-0">
              <Landmark className="size-5 text-emerald-700" />
            </div>
            <div>
              <h3
                id="admin-add-bank-title"
                className="text-lg font-black text-slate-900 tracking-tight"
              >
                Add Bank Account Administratively
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {vendorName ? `Target Merchant: ${vendorName}` : "Create settlement credentials"} • ({remainingSlots} slots remaining)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="size-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40"
          >
            <X className="size-4" />
          </button>
        </div>

        {serverError && (
          <div className="px-6 pt-4">
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800 font-medium">
              <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Country & State */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Globe className="size-3 text-slate-400" />
                Country <span className="text-rose-500">*</span>
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
              >
                {SUPPORTED_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <MapPin className="size-3 text-slate-400" />
                State / Province <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              {country === "IN" ? (
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="">Select Indian State...</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g. California, Ontario"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                />
              )}
            </div>
          </div>

          {/* Partner Bank Selector */}
          <div>
            <SearchableBankSelect
              value={partnerBankId}
              onChange={handleBankSelect}
              country={country}
              error={errors.bankName}
              placeholder="Search partner bank directory..."
            />
            {!partnerBankId && (
              <div className="mt-2">
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Bank Name (Manual):
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. Custom Cooperative Bank"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-600"
                />
              </div>
            )}
          </div>

          {/* Account Holder Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Account Holder Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={accountHolderName}
              onChange={(e) => setAccountHolderName(e.target.value)}
              placeholder="e.g. Acme Retail Pvt Ltd"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all ${
                errors.accountHolderName
                  ? "border-rose-400 bg-rose-50/20"
                  : "border-slate-200 focus:border-emerald-600"
              }`}
            />
            {errors.accountHolderName && (
              <p className="mt-1 text-[11px] font-semibold text-rose-600">
                {errors.accountHolderName}
              </p>
            )}
          </div>

          {/* Account Type */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Account Type <span className="text-rose-500">*</span>
            </label>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
            >
              <option value="current">Current Account (Business default)</option>
              <option value="savings">Savings Account</option>
              <option value="other">Other / Special Corporate</option>
            </select>
          </div>

          {/* Account Number & Confirm */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-50/70 border border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="size-3 text-slate-500" />
                Account Number Verification
              </span>
              <button
                type="button"
                onClick={() => setShowAccountNumber(!showAccountNumber)}
                className="text-slate-500 hover:text-slate-800 text-[11px] font-medium flex items-center gap-1 transition-colors"
              >
                {showAccountNumber ? (
                  <>
                    <EyeOff className="size-3" />
                    <span>Mask</span>
                  </>
                ) : (
                  <>
                    <Eye className="size-3" />
                    <span>Reveal</span>
                  </>
                )}
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Bank Account Number <span className="text-rose-500">*</span>
              </label>
              <input
                type={showAccountNumber ? "text" : "password"}
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Full 9-20 digits"
                autoComplete="off"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all ${
                  errors.accountNumber
                    ? "border-rose-400 bg-rose-50/20"
                    : "border-slate-200 focus:border-emerald-600"
                }`}
              />
              {errors.accountNumber && (
                <p className="mt-1 text-[11px] font-semibold text-rose-600">
                  {errors.accountNumber}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Confirm Account Number <span className="text-rose-500">*</span>
              </label>
              <input
                type={showAccountNumber ? "text" : "password"}
                value={confirmAccountNumber}
                onChange={(e) => setConfirmAccountNumber(e.target.value)}
                placeholder="Re-enter account number"
                autoComplete="off"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all ${
                  errors.confirmAccountNumber
                    ? "border-rose-400 bg-rose-50/20"
                    : "border-slate-200 focus:border-emerald-600"
                }`}
              />
              {errors.confirmAccountNumber && (
                <p className="mt-1 text-[11px] font-semibold text-rose-600">
                  {errors.confirmAccountNumber}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {country === "IN" ? "IFSC Code" : "Routing / SWIFT Code"}{" "}
                {country === "IN" && <span className="text-rose-500">*</span>}
              </label>
              <input
                type="text"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                placeholder={country === "IN" ? "e.g. HDFC0001234" : "Routing / SWIFT"}
                maxLength={11}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono font-bold uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all ${
                  errors.ifscCode
                    ? "border-rose-400 bg-rose-50/20"
                    : "border-slate-200 focus:border-emerald-600"
                }`}
              />
              {errors.ifscCode && (
                <p className="mt-1 text-[11px] font-semibold text-rose-600">
                  {errors.ifscCode}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Branch Name <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="e.g. Connaught Place (Optional)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
              />
            </div>
          </div>

          {/* Administrative Options */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
              Administrative Lifecycle Overrides
            </span>
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoApprove}
                  onChange={(e) => {
                    setAutoApprove(e.target.checked);
                    if (!e.target.checked) setSetActive(false);
                  }}
                  className="rounded text-emerald-700 focus:ring-emerald-500 size-4 border-slate-300"
                />
                <span className="text-xs font-bold text-slate-800">
                  Auto-approve immediately (Bypasses verification queue)
                </span>
              </label>

              <label
                className={`flex items-center gap-2.5 ${
                  autoApprove ? "cursor-pointer" : "opacity-40 cursor-not-allowed"
                }`}
              >
                <input
                  type="checkbox"
                  checked={setActive}
                  disabled={!autoApprove}
                  onChange={(e) => setSetActive(e.target.checked)}
                  className="rounded text-emerald-700 focus:ring-emerald-500 size-4 border-slate-300"
                />
                <span className="text-xs font-bold text-slate-800">
                  Set as active payout destination immediately
                </span>
              </label>
            </div>
          </div>

          {/* Mandatory Reason */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">
                Administrative Reason <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] font-mono text-slate-400">
                {reason.trim().length} / 500 (min 10)
              </span>
            </div>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State the operational reason for administratively registering this bank account..."
              className={`w-full px-3.5 py-2 rounded-xl border text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all ${
                errors.reason
                  ? "border-rose-400 bg-rose-50/20"
                  : "border-slate-200 focus:border-emerald-600"
              }`}
            />
            {errors.reason && (
              <p className="mt-1 text-[11px] font-semibold text-rose-600">
                {errors.reason}
              </p>
            )}
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#004D38] hover:bg-[#003829] text-white text-xs font-bold shadow-md shadow-emerald-900/10 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <Plus className="size-4" />
                  <span>Create Bank Account</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminAddBankAccountModal;
