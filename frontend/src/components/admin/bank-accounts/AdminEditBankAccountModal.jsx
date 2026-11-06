"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Edit2,
  AlertTriangle,
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  Loader2,
  Save,
  Globe,
  MapPin,
} from "lucide-react";
import { SearchableBankSelect } from "../../shared/SearchableBankSelect.jsx";
import { SUPPORTED_COUNTRIES, INDIAN_STATES } from "../../../constants/bank-geo.constants.js";

export function AdminEditBankAccountModal({
  isOpen,
  onClose,
  onSubmit,
  account,
  isSubmitting = false,
}) {
  const [country, setCountry] = useState("IN");
  const [state, setState] = useState("");
  const [partnerBankId, setPartnerBankId] = useState(null);
  const [accountHolderName, setAccountHolderName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [branchName, setBranchName] = useState("");
  const [accountType, setAccountType] = useState("current");
  const [reason, setReason] = useState("");

  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    if (account && isOpen) {
      setCountry(account.country || "IN");
      setState(account.state || "");
      setPartnerBankId(account.partnerBankId || null);
      setAccountHolderName(account.accountHolderName || "");
      setBankName(account.bankName || "");
      setIfscCode(account.ifscCode || "");
      setBranchName(account.branchName || "");
      setAccountType(account.accountType || "current");
      setAccountNumber("");
      setConfirmAccountNumber("");
      setReason("");
      setShowAccountNumber(false);
      setErrors({});
      setServerError("");
    }
  }, [account, isOpen]);

  if (!isOpen || !account) return null;

  const handleClose = () => {
    setAccountNumber("");
    setConfirmAccountNumber("");
    setReason("");
    setErrors({});
    setServerError("");
    onClose();
  };

  const handleBankSelect = (bankObj, bankId, bankNameVal) => {
    setPartnerBankId(bankId || null);
    if (bankNameVal) {
      setBankName(bankNameVal);
    }
    if (bankObj?.ifscPrefix && !ifscCode) {
      setIfscCode(bankObj.ifscPrefix);
    }
    if (errors.bankName) {
      setErrors((prev) => ({ ...prev, bankName: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (accountHolderName.trim() && accountHolderName.trim().length < 2) {
      newErrors.accountHolderName = "Must be at least 2 characters";
    }

    if (bankName.trim() && bankName.trim().length < 2) {
      newErrors.bankName = "Must be at least 2 characters";
    }

    if (accountNumber) {
      const cleanAcc = accountNumber.replace(/[\s-]/g, "");
      if (!/^[0-9]{9,20}$/.test(cleanAcc)) {
        newErrors.accountNumber = "Account number must be 9 to 20 digits";
      }
      if (cleanAcc !== confirmAccountNumber.replace(/[\s-]/g, "")) {
        newErrors.confirmAccountNumber = "Account numbers do not match";
      }
    }

    if (ifscCode.trim() && country === "IN") {
      const cleanIFSC = ifscCode.trim().toUpperCase();
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIFSC)) {
        newErrors.ifscCode = "Invalid Indian IFSC format (e.g. HDFC0001234)";
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
      reason: reason.trim(),
    };

    if (country !== (account.country || "IN")) {
      payload.country = country;
    }
    if (state.trim() !== (account.state || "")) {
      payload.state = state.trim() || null;
    }
    if (partnerBankId !== (account.partnerBankId || null)) {
      payload.partnerBankId = partnerBankId;
    }
    if (accountHolderName.trim() !== account.accountHolderName) {
      payload.accountHolderName = accountHolderName.trim();
    }
    if (bankName.trim() !== account.bankName) {
      payload.bankName = bankName.trim();
    }
    if (branchName.trim() !== (account.branchName || "")) {
      payload.branchName = branchName.trim() || null;
    }
    if (accountType !== account.accountType) {
      payload.accountType = accountType;
    }
    if (accountNumber) {
      payload.accountNumber = accountNumber.replace(/[\s-]/g, "");
      payload.confirmAccountNumber = confirmAccountNumber.replace(/[\s-]/g, "");
    }
    if (ifscCode.trim().toUpperCase() !== (account.ifscCode || "")) {
      payload.ifscCode = ifscCode.trim().toUpperCase();
    }

    try {
      await onSubmit(account.id || account._id, payload);
      handleClose();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to update bank account";
      setServerError(msg);
    }
  };

  const isChangingCritical = Boolean(
    accountNumber || (ifscCode && ifscCode.trim().toUpperCase() !== account.ifscCode)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-edit-bank-title"
    >
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={() => !isSubmitting && handleClose()}
      />

      <div className="relative bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200 my-8">
        <div className="p-6 bg-slate-50/80 border-b border-slate-100 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-indigo-100/80 text-indigo-800 flex items-center justify-center shrink-0">
              <Edit2 className="size-5 text-indigo-700" />
            </div>
            <div>
              <h3
                id="admin-edit-bank-title"
                className="text-lg font-black text-slate-900 tracking-tight"
              >
                Edit Bank Account Details
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {account.bankName} • Current Status:{" "}
                <span className="capitalize font-bold text-slate-700">
                  {account.status}
                </span>
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

        {/* Warning if critical detail change */}
        {isChangingCritical && (
          <div className="px-6 pt-4">
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs space-y-1">
              <div className="flex items-center gap-2 text-amber-900 font-bold">
                <AlertTriangle className="size-4 text-amber-700 shrink-0" />
                <span>Critical Credential Modification Warning</span>
              </div>
              <p className="text-amber-800 leading-relaxed font-medium pl-6">
                Modifying the account number or IFSC code will automatically revoke existing verification, deactivate the account if live, and reset its status to <strong>Pending Review</strong>.
              </p>
            </div>
          </div>
        )}

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
                Country
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
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
                State / Province
              </label>
              {country === "IN" ? (
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
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
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                />
              )}
            </div>
          </div>

          {/* Partner Bank Directory Selector */}
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
                  placeholder="Bank name"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-600"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Account Holder Name
            </label>
            <input
              type="text"
              value={accountHolderName}
              onChange={(e) => setAccountHolderName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
            />
            {errors.accountHolderName && (
              <p className="mt-1 text-[11px] font-semibold text-rose-600">
                {errors.accountHolderName}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Account Type
            </label>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
            >
              <option value="current">Current Account</option>
              <option value="savings">Savings Account</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Optional: Change Account Number */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-50/70 border border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Change Account Number (Optional)
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Currently: {account.accountNumberMasked}
                </span>
              </div>
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
                New Account Number
              </label>
              <input
                type={showAccountNumber ? "text" : "password"}
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Leave blank to keep current number"
                autoComplete="off"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
              />
              {errors.accountNumber && (
                <p className="mt-1 text-[11px] font-semibold text-rose-600">
                  {errors.accountNumber}
                </p>
              )}
            </div>

            {accountNumber && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirm New Account Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type={showAccountNumber ? "text" : "password"}
                  value={confirmAccountNumber}
                  onChange={(e) => setConfirmAccountNumber(e.target.value)}
                  placeholder="Re-enter new account number"
                  autoComplete="off"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                />
                {errors.confirmAccountNumber && (
                  <p className="mt-1 text-[11px] font-semibold text-rose-600">
                    {errors.confirmAccountNumber}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {country === "IN" ? "IFSC Code" : "Routing / SWIFT Code"}
              </label>
              <input
                type="text"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                placeholder={country === "IN" ? "e.g. HDFC0001234" : "Routing / SWIFT"}
                maxLength={11}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
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
                placeholder="Branch name or city (Optional)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
              />
            </div>
          </div>

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
              placeholder="State the justification for administratively editing these banking credentials..."
              className={`w-full px-3.5 py-2 rounded-xl border text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                errors.reason
                  ? "border-rose-400 bg-rose-50/20"
                  : "border-slate-200 focus:border-indigo-600"
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
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-900/10 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Saving Updates...</span>
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  <span>Update Bank Account</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminEditBankAccountModal;
