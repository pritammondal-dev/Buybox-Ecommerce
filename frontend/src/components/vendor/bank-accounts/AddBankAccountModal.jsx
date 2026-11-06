"use client";

import React, { useState } from "react";
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
  ArrowRight,
  Globe,
  MapPin,
  Building,
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

export function AddBankAccountModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  remainingSlots = 3,
}) {
  // Section A: Bank Selection & Jurisdiction
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

  // UI States
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [isConfirmStep, setIsConfirmStep] = useState(false);

  if (!isOpen) return null;

  const routingMeta = getCountryRoutingMeta(country);
  const subdivisions = getSubdivisionsForCountry(country);

  const countryOptions = SUPPORTED_COUNTRIES.map((c) => ({
    value: c.code,
    label: `${c.name} (${c.code})`,
    sublabel: c.routingLabel,
  }));

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

  const handleProceedToConfirm = (e) => {
    e.preventDefault();
    setServerError("");
    if (validateForm()) {
      setIsConfirmStep(true);
    }
  };

  const handleFinalSubmit = async () => {
    setServerError("");
    try {
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
        submissionReason: submissionReason.trim() || null,
      };

      await onSubmit(payload);
      handleClose();
    } catch (err) {
      const backendMessage =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to submit bank account application";
      setServerError(backendMessage);
      setIsConfirmStep(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-50 max-h-[92vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center">
              <Landmark className="size-4" />
            </div>
            <div>
              <h3 id="modal-title" className="text-sm font-bold text-slate-900">
                {isConfirmStep ? "Review & Confirm Bank Account" : "Add Bank Account"}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isConfirmStep
                  ? "Section C: Verify all details carefully before submitting for verification"
                  : `Available Slots: ${remainingSlots} of 3`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
            aria-label="Close modal"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-4 pb-12">
          {/* Server Error Alert */}
          {serverError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Submission Error: </span>
                <span>{serverError}</span>
              </div>
            </div>
          )}

          {!isConfirmStep ? (
            /* STEP 1: Entry Form */
            <form id="add-bank-account-form" onSubmit={handleProceedToConfirm} className="space-y-5">
              {/* Informational Guidance */}
              <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-xs text-emerald-900 flex items-start gap-2.5">
                <ShieldCheck className="size-4 text-emerald-700 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <span className="font-bold">Encrypted & Audited: </span>
                  Your bank account number is stored using AES-256 authenticated encryption.
                  Submission initiates administrator verification; payouts will only route to approved accounts.
                </p>
              </div>

              {/* SECTION A: BANK SELECTION & JURISDICTION */}
              <div className="space-y-3.5 p-4 rounded-2xl bg-slate-50/70 border border-slate-100">
                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
                  <div className="size-5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center">
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
                    placeholder="Search bank name or code (e.g. HDFC, SBI, ICICI, Chase)..."
                  />
                </div>
              </div>

              {/* SECTION B: ACCOUNT DETAILS & BENEFICIARY INFORMATION */}
              <div className="space-y-3.5 p-4 rounded-2xl bg-slate-50/70 border border-slate-100">
                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
                  <div className="size-5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center">
                    B
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Account Details & Beneficiary Information
                  </h4>
                </div>

                {/* Account Holder Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Beneficiary Account Holder Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)}
                    placeholder="e.g. Acme Enterprise Private Limited"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                      errors.accountHolderName
                        ? "border-rose-300 focus:ring-rose-200"
                        : "border-slate-200 focus:border-emerald-500 focus:ring-emerald-100"
                    }`}
                    autoComplete="off"
                  />
                  {errors.accountHolderName && (
                    <p className="text-[11px] text-rose-600 font-medium mt-1">
                      {errors.accountHolderName}
                    </p>
                  )}
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Must strictly match the business or legal beneficiary registered with your bank.
                  </span>
                </div>

                {/* Account Number & Confirm Account Number */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">
                        Account Number <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowAccountNumber(!showAccountNumber)}
                        className="text-[10px] text-emerald-800 hover:text-emerald-950 font-semibold inline-flex items-center gap-1"
                      >
                        {showAccountNumber ? (
                          <>
                            <EyeOff className="size-3" /> Hide
                          </>
                        ) : (
                          <>
                            <Eye className="size-3" /> Show
                          </>
                        )}
                      </button>
                    </div>
                    <input
                      type={showAccountNumber ? "text" : "password"}
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="9 to 20 digits"
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                        errors.accountNumber
                          ? "border-rose-300 focus:ring-rose-200"
                          : "border-slate-200 focus:border-emerald-500 focus:ring-emerald-100"
                      }`}
                      autoComplete="new-password"
                    />
                    {errors.accountNumber && (
                      <p className="text-[11px] text-rose-600 font-medium mt-1">
                        {errors.accountNumber}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Confirm Account Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={confirmAccountNumber}
                      onChange={(e) => setConfirmAccountNumber(e.target.value)}
                      placeholder="Re-enter account number"
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                        errors.confirmAccountNumber
                          ? "border-rose-300 focus:ring-rose-200"
                          : "border-slate-200 focus:border-emerald-500 focus:ring-emerald-100"
                      }`}
                      autoComplete="new-password"
                    />
                    {errors.confirmAccountNumber && (
                      <p className="text-[11px] text-rose-600 font-medium mt-1">
                        {errors.confirmAccountNumber}
                      </p>
                    )}
                  </div>
                </div>

                {/* Routing Code & Branch Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {routingMeta.routingLabel}{" "}
                      {routingMeta.requiresIfsc ? (
                        <span className="text-rose-500">*</span>
                      ) : (
                        <span className="text-slate-400 font-normal">(Optional)</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={ifscCode}
                      onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                      placeholder={routingMeta.routingPlaceholder}
                      maxLength={20}
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono uppercase text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                        errors.ifscCode
                          ? "border-rose-300 focus:ring-rose-200"
                          : "border-slate-200 focus:border-emerald-500 focus:ring-emerald-100"
                      }`}
                      autoComplete="off"
                    />
                    {errors.ifscCode && (
                      <p className="text-[11px] text-rose-600 font-medium mt-1">
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
                      placeholder="e.g. Bandra Kurla Complex (Optional)"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      autoComplete="off"
                    />
                  </div>
                </div>

                {/* Account Type & Note */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Account Type <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={accountType}
                      onChange={(e) => setAccountType(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    >
                      <option value="current">Current Account (Recommended for Business)</option>
                      <option value="savings">Savings Account</option>
                      <option value="other">Other / Corporate Payout</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Submission Note <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={submissionReason}
                      onChange={(e) => setSubmissionReason(e.target.value)}
                      placeholder="e.g. Primary settlement account"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      maxLength={500}
                    />
                  </div>
                </div>
              </div>
            </form>
          ) : (
            /* STEP 2: SECTION C: REVIEW & CONFIRMATION SUMMARY */
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
                <div className="size-5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center">
                  C
                </div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Review & Confirmation Summary
                </h4>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="size-4 text-amber-700" /> Verify Credential Accuracy
                </span>
                <p className="leading-relaxed pl-5.5">
                  Please confirm that the bank name, beneficiary name, and routing code match your
                  official bank statement or chequebook leaf. Incorrect numbers may lead to application rejection or payout settlement delays.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-2.5">
                <div className="flex justify-between py-1 border-b border-slate-200/50">
                  <span className="text-slate-500">Jurisdiction:</span>
                  <span className="font-bold text-slate-900">
                    {country} {state ? `• ${state}` : ""}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/50">
                  <span className="text-slate-500">Partner Bank:</span>
                  <span className="font-bold text-slate-900">{bankName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/50">
                  <span className="text-slate-500">Account Holder:</span>
                  <span className="font-bold text-slate-900">{accountHolderName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/50">
                  <span className="text-slate-500">Account Number:</span>
                  <span className="font-mono font-bold text-slate-900">
                    ••••••••••••{accountNumber.slice(-4)}
                  </span>
                </div>
                {ifscCode && (
                  <div className="flex justify-between py-1 border-b border-slate-200/50">
                    <span className="text-slate-500">{routingMeta.routingLabel}:</span>
                    <span className="font-mono font-bold text-slate-900 uppercase">
                      {ifscCode.toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-slate-200/50">
                  <span className="text-slate-500">Branch Name:</span>
                  <span className="font-medium text-slate-700">
                    {branchName.trim() || "Not provided"}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Account Type:</span>
                  <span className="font-bold text-slate-900 capitalize">{accountType}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/60 shrink-0">
          {!isConfirmStep ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/60 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-bank-account-form"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#004D38] hover:bg-[#003d2c] text-white shadow-xs transition-colors"
              >
                <span>Continue to Review</span>
                <ArrowRight className="size-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsConfirmStep(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/60 transition-colors"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-[#004D38] hover:bg-[#003d2c] text-white shadow-xs transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Encrypting & Submitting...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3.5" />
                    <span>Submit Application</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default AddBankAccountModal;
