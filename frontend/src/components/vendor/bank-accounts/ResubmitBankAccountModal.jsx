"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Landmark,
  ShieldAlert,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  Lock,
  Loader2,
  FileEdit,
  ArrowRight,
  Globe,
  MapPin,
} from "lucide-react";
import { SearchableBankSelect } from "../../shared/SearchableBankSelect.jsx";
import { SearchableSelect } from "../../shared/SearchableSelect.jsx";
import {
  SUPPORTED_COUNTRIES,
  getSubdivisionsForCountry,
  getCountryRoutingMeta,
} from "../../../constants/bank-geo.constants.js";
import {
  validateIFSC,
  normalizeIFSC,
} from "../../../utils/compliance-validation.util.js";

export function ResubmitBankAccountModal({
  isOpen,
  onClose,
  onSubmit,
  account,
  isSubmitting = false,
}) {
  // Section A: Bank & Jurisdiction
  const [country, setCountry] = useState("IN");
  const [state, setState] = useState("");
  const [partnerBankId, setPartnerBankId] = useState(null);
  const [bankName, setBankName] = useState("");

  // Section B: Account Details
  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [branchName, setBranchName] = useState("");
  const [accountType, setAccountType] = useState("current");
  const [submissionReason, setSubmissionReason] = useState("");

  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [isConfirmStep, setIsConfirmStep] = useState(false);

  const routingMeta = getCountryRoutingMeta(country);
  const subdivisions = getSubdivisionsForCountry(country);

  const countryOptions = SUPPORTED_COUNTRIES.map((c) => ({
    value: c.code,
    label: `${c.name} (${c.code})`,
    sublabel: c.routingLabel,
  }));

  // Pre-fill editable data when account changes or modal opens
  useEffect(() => {
    if (account && isOpen) {
      setCountry(account.country ? account.country.toUpperCase() : "IN");
      setState(account.state || "");
      setPartnerBankId(account.partnerBankId || null);
      setBankName(account.bankName || "");
      setAccountHolderName(account.accountHolderName || "");
      setIfscCode(account.ifscCode || "");
      setBranchName(account.branchName === "Not provided" ? "" : account.branchName || "");
      setAccountType(account.accountType || "current");
      setAccountNumber("");
      setConfirmAccountNumber("");
      setSubmissionReason("");
      setErrors({});
      setServerError("");
      setIsConfirmStep(false);
    }
  }, [account, isOpen]);

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
    setSubmissionReason("");
    setShowAccountNumber(false);
    setErrors({});
    setServerError("");
    setIsConfirmStep(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Modal ESC key listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) {
        handleClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isSubmitting]);

  if (!isOpen || !account) return null;

  const handleCountryChange = (newCountry) => {
    setCountry(newCountry);
    // Clear state, bank, and routing code when country changes
    setState("");
    setPartnerBankId(null);
    setBankName("");
    setIfscCode("");
    if (errors.country) setErrors((prev) => ({ ...prev, country: null }));
    if (errors.bankName) setErrors((prev) => ({ ...prev, bankName: null }));
    if (errors.ifscCode) setErrors((prev) => ({ ...prev, ifscCode: null }));
  };

  const handleBankSelect = (bankObj, bankId, bankNameVal) => {
    setPartnerBankId(bankId || null);
    setBankName(bankNameVal || "");
    if (bankObj?.ifscPrefix && !ifscCode && country === "IN") {
      setIfscCode(bankObj.ifscPrefix);
    }
    if (errors.bankName) {
      setErrors((prev) => ({ ...prev, bankName: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!country) {
      newErrors.country = "Country is required";
    }

    if (!partnerBankId || !bankName.trim()) {
      newErrors.bankName = "Please select a verified bank from the partner bank directory";
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

    if (routingMeta.requiresIfsc || country === "IN") {
      const ifscCheck = validateIFSC(ifscCode, country);
      if (!ifscCheck.isValid) {
        newErrors.ifscCode = ifscCheck.error;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = (e) => {
    e.preventDefault();
    setServerError("");
    if (validateForm()) {
      setIsConfirmStep(true);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    if (!validateForm()) {
      setIsConfirmStep(false);
      return;
    }

    const payload = {
      partnerBankId: partnerBankId || undefined,
      bankName: bankName.trim(),
      country: country.toUpperCase(),
      state: state.trim() || undefined,
      accountHolderName: accountHolderName.trim(),
      accountNumber: accountNumber.replace(/[\s-]/g, ""),
      confirmAccountNumber: confirmAccountNumber.replace(/[\s-]/g, ""),
      ifscCode:
        country === "IN"
          ? normalizeIFSC(ifscCode)
          : ifscCode.trim().toUpperCase() || undefined,
      branchName: branchName.trim() || "Not provided",
      accountType,
      submissionReason:
        submissionReason.trim() ||
        "Vendor resubmitted corrected bank account details",
    };

    try {
      await onSubmit(account.id || account._id, payload);
      resetForm();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to resubmit bank account. Please check your inputs and try again.";
      setServerError(msg);
      setIsConfirmStep(false);
    }
  };

  const maskedPreview = accountNumber
    ? `•••• •••• ${accountNumber.replace(/[\s-]/g, "").slice(-4)}`
    : "•••• •••• ••••";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resubmit-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={() => !isSubmitting && handleClose()}
      />

      {/* Modal Card */}
      <div className="relative bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Header */}
        <div className="p-6 bg-slate-50/70 border-b border-slate-100 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-amber-100/80 text-amber-800 flex items-center justify-center shrink-0">
              <FileEdit className="size-5 text-amber-700" />
            </div>
            <div>
              <h3
                id="resubmit-modal-title"
                className="text-lg font-black text-slate-900 tracking-tight"
              >
                Correct & Resubmit Bank Account
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Fix verification issues and submit for re-review
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="size-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40"
            aria-label="Close resubmission dialog"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Rejection Notice Banner */}
        <div className="px-6 pt-5">
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs space-y-1.5">
            <div className="flex items-center gap-2 text-rose-900 font-bold">
              <ShieldAlert className="size-4 text-rose-600 shrink-0" />
              <span>Reviewer Feedback / Rejection Note</span>
            </div>
            <p className="text-rose-800 leading-relaxed font-medium pl-6">
              {account.rejectionReason ||
                "Application requires updated or corrected banking credentials."}
            </p>
          </div>
        </div>

        {/* Server Error Banner */}
        {serverError && (
          <div className="px-6 pt-3">
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800 font-medium">
              <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          </div>
        )}

        {/* Main Content / Steps */}
        {!isConfirmStep ? (
          <form onSubmit={handleNextStep} className="p-6 space-y-5 pb-10">
            {/* SECTION A: BANK & JURISDICTION */}
            <div className="space-y-3.5 p-4 rounded-2xl bg-slate-50/70 border border-slate-100">
              <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
                <div className="size-5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center justify-center">
                  A
                </div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Bank Selection & Jurisdiction
                </h4>
              </div>

              {/* Country & State */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <SearchableSelect
                    label="Country"
                    required={true}
                    options={countryOptions}
                    value={country}
                    onChange={handleCountryChange}
                    placeholder="Select country..."
                    searchPlaceholder="Search country name or code..."
                    error={errors.country}
                  />
                </div>

                <div>
                  {subdivisions && subdivisions.length > 0 ? (
                    <SearchableSelect
                      label="State / Province"
                      required={false}
                      options={subdivisions.map((s) => ({ value: s, label: s }))}
                      value={state}
                      onChange={(val) => setState(val)}
                      placeholder="Select state or province..."
                      searchPlaceholder="Type to filter regions..."
                    />
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="size-3.5 text-slate-400" />
                          <span>State / Province</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                      </label>
                      <input
                        type="text"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="e.g. California, Ontario, etc."
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
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
                  placeholder="Search bank name or code..."
                />
              </div>
            </div>

            {/* SECTION B: ACCOUNT DETAILS */}
            <div className="space-y-3.5 p-4 rounded-2xl bg-slate-50/70 border border-slate-100">
              <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
                <div className="size-5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center justify-center">
                  B
                </div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Account Details & Beneficiary Information
                </h4>
              </div>

              {/* Account Holder Name */}
              <div>
                <label
                  htmlFor="resubmit-holder-name"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  Account Holder Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="resubmit-holder-name"
                  type="text"
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  placeholder="Must match your registered legal or business name"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#004D38]/20 transition-all ${
                    errors.accountHolderName
                      ? "border-rose-400 bg-rose-50/20 focus:border-rose-500"
                      : "border-slate-200 focus:border-[#004D38]"
                  }`}
                />
                {errors.accountHolderName && (
                  <p className="mt-1 text-[11px] font-semibold text-rose-600">
                    {errors.accountHolderName}
                  </p>
                )}
              </div>

              {/* Account Number & Confirm Account Number */}
              <div className="space-y-3 p-3.5 rounded-xl bg-white border border-slate-200/60">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="size-3 text-slate-500" />
                    Bank Account Number Verification
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAccountNumber(!showAccountNumber)}
                    className="text-slate-500 hover:text-slate-800 text-[11px] font-medium flex items-center gap-1 transition-colors"
                  >
                    {showAccountNumber ? (
                      <>
                        <EyeOff className="size-3" />
                        <span>Mask digits</span>
                      </>
                    ) : (
                      <>
                        <Eye className="size-3" />
                        <span>Reveal digits</span>
                      </>
                    )}
                  </button>
                </div>

                <div>
                  <label
                    htmlFor="resubmit-account-num"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    New / Corrected Account Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="resubmit-account-num"
                    type={showAccountNumber ? "text" : "password"}
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="Enter full 9-20 digit account number"
                    autoComplete="off"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#004D38]/20 transition-all ${
                      errors.accountNumber
                        ? "border-rose-400 bg-rose-50/20 focus:border-rose-500"
                        : "border-slate-200 focus:border-[#004D38]"
                    }`}
                  />
                  {errors.accountNumber && (
                    <p className="mt-1 text-[11px] font-semibold text-rose-600">
                      {errors.accountNumber}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="resubmit-confirm-num"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    Confirm Account Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="resubmit-confirm-num"
                    type={showAccountNumber ? "text" : "password"}
                    value={confirmAccountNumber}
                    onChange={(e) => setConfirmAccountNumber(e.target.value)}
                    placeholder="Re-enter account number exactly"
                    autoComplete="off"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#004D38]/20 transition-all ${
                      errors.confirmAccountNumber
                        ? "border-rose-400 bg-rose-50/20 focus:border-rose-500"
                        : "border-slate-200 focus:border-[#004D38]"
                    }`}
                  />
                  {errors.confirmAccountNumber && (
                    <p className="mt-1 text-[11px] font-semibold text-rose-600">
                      {errors.confirmAccountNumber}
                    </p>
                  )}
                </div>
              </div>

              {/* Routing Code & Branch Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="resubmit-ifsc"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    {routingMeta.routingLabel}{" "}
                    {routingMeta.requiresIfsc ? (
                      <span className="text-rose-500">*</span>
                    ) : (
                      <span className="text-slate-400 font-normal">(Optional)</span>
                    )}
                  </label>
                  <input
                    id="resubmit-ifsc"
                    type="text"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                    placeholder={routingMeta.routingPlaceholder}
                    maxLength={20}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono font-bold uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#004D38]/20 transition-all ${
                      errors.ifscCode
                        ? "border-rose-400 bg-rose-50/20 focus:border-rose-500"
                        : "border-slate-200 focus:border-[#004D38]"
                    }`}
                  />
                  {errors.ifscCode && (
                    <p className="mt-1 text-[11px] font-semibold text-rose-600">
                      {errors.ifscCode}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="resubmit-branch"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    Branch Name <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    id="resubmit-branch"
                    type="text"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    placeholder="e.g. Connaught Place (Optional)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#004D38]/20 focus:border-[#004D38] transition-all"
                  />
                </div>
              </div>

              {/* Account Type & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="resubmit-account-type"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    Account Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="resubmit-account-type"
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#004D38]/20 focus:border-[#004D38] transition-all"
                  >
                    <option value="current">Current Account (Recommended for business)</option>
                    <option value="savings">Savings Account</option>
                    <option value="other">Other / Corporate Payout</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="resubmit-notes"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    Notes on Corrections <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    id="resubmit-notes"
                    type="text"
                    value={submissionReason}
                    onChange={(e) => setSubmissionReason(e.target.value)}
                    placeholder="Explain what was updated"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#004D38]/20 focus:border-[#004D38] transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#004D38] hover:bg-[#003829] text-white text-xs font-bold shadow-md shadow-emerald-900/10 transition-colors"
              >
                <span>Review & Confirm</span>
                <ArrowRight className="size-4" />
              </button>
            </div>
          </form>
        ) : (
          /* SECTION C: REVIEW & CONFIRMATION STEP */
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
              <div className="size-5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center justify-center">
                C
              </div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Review & Confirmation Summary
              </h4>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/70 space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                <CheckCircle2 className="size-4 text-amber-700 shrink-0" />
                <span>Confirm Corrected Banking Information</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed font-medium">
                Please verify that the details below are exact and match your company bank records. Once submitted, the status will reset to <strong>Pending Review</strong>.
              </p>
            </div>

            {/* Summary Details */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    Jurisdiction
                  </span>
                  <span className="font-bold text-slate-900 block truncate">
                    {country} {state ? `• ${state}` : ""}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    Partner Bank
                  </span>
                  <span className="font-bold text-slate-900 block truncate">
                    {bankName}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    Account Holder
                  </span>
                  <span className="font-bold text-slate-900 block truncate">
                    {accountHolderName}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    Account Number
                  </span>
                  <span className="font-mono font-bold text-slate-900 block">
                    {maskedPreview}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    {routingMeta.routingLabel}
                  </span>
                  <span className="font-mono font-bold text-slate-800 uppercase block">
                    {ifscCode || "—"}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    Branch Name
                  </span>
                  <span className="font-medium text-slate-800 block truncate">
                    {branchName.trim() || "Not provided"}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    Account Type
                  </span>
                  <span className="font-medium text-slate-800 capitalize block">
                    {accountType}
                  </span>
                </div>
              </div>
            </div>

            {/* Security Guarantee */}
            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-100/60 text-[11px] text-slate-500 font-medium">
              <Lock className="size-3.5 text-slate-500 shrink-0" />
              <span>Full account numbers are encrypted at rest with AES-256-GCM.</span>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsConfirmStep(false)}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#004D38] hover:bg-[#003829] text-white text-xs font-bold shadow-md shadow-emerald-900/10 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Resubmitting Application...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Corrected Application</span>
                    <CheckCircle2 className="size-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ResubmitBankAccountModal;
