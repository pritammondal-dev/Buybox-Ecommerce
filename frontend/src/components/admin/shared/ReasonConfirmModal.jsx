"use client";

import React, { useState, useEffect, useId } from "react";
import {
  AlertTriangle,
  AlertOctagon,
  ShieldAlert,
  RotateCcw,
  CheckCircle2,
  Trash2,
  Lock,
  RefreshCw,
  Info,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "../../ui/Dialog.jsx";
import { Button } from "../../ui/Button.jsx";

/**
 * ReasonConfirmModal
 *
 * Authoritative administrative reason-collection modal for sensitive account lifecycle operations:
 * - Account suspension & reactivation
 * - Administrative password resets
 * - Account deactivation & soft-deletion
 * - Administrative profile overrides
 *
 * Enforces client-side validation (10–500 characters trimmed) while displaying live counters,
 * backend error envelopes, high-impact confirmation checkboxes, and accessible keyboard controls.
 */
export function ReasonConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  targetIdentity = "",
  actionType = "default", // "suspend" | "reactivate" | "reset-password" | "deactivate" | "edit" | "default"
  isDestructive = false,
  confirmLabel,
  isLoading = false,
  errorMessage = null,
  requireAcknowledgment = false,
  acknowledgmentText = "I confirm that I have verified the operational necessity and impact of this administrative action.",
  extraFields = null,
  minChars = 10,
  maxChars = 500,
  placeholder = "Provide an administrative justification for this action (min 10 characters)...",
}) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [clientError, setClientError] = useState("");

  const reasonId = useId();
  const ackId = useId();

  // Reset local state whenever modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setReason("");
      setTouched(false);
      setAcknowledged(!requireAcknowledgment);
      setClientError("");
    }
  }, [isOpen, requireAcknowledgment]);

  const trimmed = reason.trim();
  const charCount = reason.length;
  const isTooShort = touched && trimmed.length < minChars;
  const isTooLong = charCount > maxChars;
  const isValid = trimmed.length >= minChars && trimmed.length <= maxChars && acknowledged;

  const handleReasonChange = (e) => {
    const val = e.target.value;
    setReason(val);
    if (!touched && val.length > 0) {
      setTouched(true);
    }

    if (val.trim().length >= minChars && val.length <= maxChars) {
      setClientError("");
    } else if (val.length > maxChars) {
      setClientError(`Reason cannot exceed ${maxChars} characters.`);
    } else if (touched && val.trim().length < minChars) {
      setClientError(`Reason must be at least ${minChars} characters long.`);
    }
  };

  const handleBlur = () => {
    setTouched(true);
    if (trimmed.length < minChars) {
      setClientError(`Reason must be at least ${minChars} characters long.`);
    } else if (charCount > maxChars) {
      setClientError(`Reason cannot exceed ${maxChars} characters.`);
    } else {
      setClientError("");
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setTouched(true);

    if (trimmed.length < minChars) {
      setClientError(`Reason must be at least ${minChars} characters long.`);
      return;
    }
    if (charCount > maxChars) {
      setClientError(`Reason cannot exceed ${maxChars} characters.`);
      return;
    }
    if (requireAcknowledgment && !acknowledged) {
      setClientError("Please acknowledge the operational impact to proceed.");
      return;
    }

    setClientError("");
    try {
      await onConfirm({ reason: trimmed });
    } catch {
      // Error handling is managed by parent via errorMessage prop
    }
  };

  // Resolve action visual styling
  const getActionTheme = () => {
    if (isDestructive || actionType === "deactivate") {
      return {
        badgeBg: "bg-rose-100 text-rose-700 border-rose-200",
        icon: <Trash2 className="size-5 text-rose-600" />,
        btnVariant: "destructive",
        defaultTitle: "Deactivate Account",
        defaultConfirmLabel: "Deactivate Account",
      };
    }
    if (actionType === "suspend") {
      return {
        badgeBg: "bg-amber-100 text-amber-800 border-amber-200",
        icon: <AlertTriangle className="size-5 text-amber-600" />,
        btnVariant: "warning",
        defaultTitle: "Suspend Account",
        defaultConfirmLabel: "Suspend Account",
      };
    }
    if (actionType === "reactivate") {
      return {
        badgeBg: "bg-emerald-100 text-emerald-800 border-emerald-200",
        icon: <RotateCcw className="size-5 text-emerald-600" />,
        btnVariant: "default",
        defaultTitle: "Reactivate Account",
        defaultConfirmLabel: "Reactivate Account",
      };
    }
    if (actionType === "reset-password") {
      return {
        badgeBg: "bg-indigo-100 text-indigo-800 border-indigo-200",
        icon: <Lock className="size-5 text-indigo-600" />,
        btnVariant: "default",
        defaultTitle: "Reset Password",
        defaultConfirmLabel: "Reset Password",
      };
    }
    return {
      badgeBg: "bg-slate-100 text-slate-800 border-slate-200",
      icon: <ShieldAlert className="size-5 text-slate-600" />,
      btnVariant: "default",
      defaultTitle: "Confirm Administrative Action",
      defaultConfirmLabel: "Confirm Action",
    };
  };

  const theme = getActionTheme();
  const effectiveTitle = title || theme.defaultTitle;
  const effectiveConfirmLabel = confirmLabel || theme.defaultConfirmLabel;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent onClose={onClose} className="max-w-lg p-6 sm:p-7">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader className="gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`size-10 rounded-2xl flex items-center justify-center border shrink-0 ${theme.badgeBg}`}
              >
                {theme.icon}
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900">
                  {effectiveTitle}
                </DialogTitle>
                {targetIdentity && (
                  <p className="text-xs font-semibold text-slate-500 font-mono mt-0.5">
                    Target: {targetIdentity}
                  </p>
                )}
              </div>
            </div>

            {description && (
              <DialogDescription className="text-xs sm:text-sm text-slate-600 leading-relaxed pt-1">
                {description}
              </DialogDescription>
            )}
          </DialogHeader>

          {/* Operational Policy Notice */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-600 text-[11px] flex items-start gap-2.5">
            <Info className="size-4 shrink-0 text-slate-400 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-800">
                Authoritative Audit Trail Policy:
              </span>
              <p>
                This action is permanently logged to the immutable audit database with your administrator ID, timestamp, and IP address. A valid administrative reason is mandatory.
              </p>
            </div>
          </div>

          {/* Extra Custom Inputs (e.g. Password inputs if applicable) */}
          {extraFields}

          {/* Administrative Reason Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label
                htmlFor={reasonId}
                className="font-bold text-slate-700 flex items-center gap-1"
              >
                <span>Administrative Justification / Reason</span>
                <span className="text-rose-500">*</span>
              </label>
              <span
                className={`text-[11px] font-mono font-semibold ${
                  charCount === 0
                    ? "text-slate-400"
                    : trimmed.length < minChars
                    ? "text-amber-600"
                    : isTooLong
                    ? "text-rose-600 font-bold"
                    : "text-emerald-600"
                }`}
              >
                {charCount} / {maxChars} chars{" "}
                {trimmed.length < minChars && `(min ${minChars})`}
              </span>
            </div>

            <textarea
              id={reasonId}
              rows={3}
              value={reason}
              onChange={handleReasonChange}
              onBlur={handleBlur}
              placeholder={placeholder}
              disabled={isLoading}
              className={`w-full text-xs p-3 rounded-xl bg-white border transition-all text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                isTooShort || isTooLong || clientError
                  ? "border-rose-300 focus:ring-rose-400 focus:border-rose-400 bg-rose-50/20"
                  : "border-slate-200 focus:ring-emerald-500 focus:border-emerald-500"
              }`}
            />

            {/* Validation / Error Messages */}
            {(clientError || errorMessage) && (
              <div className="text-xs text-rose-600 font-medium flex items-center gap-1.5 mt-1">
                <AlertOctagon className="size-3.5 shrink-0" />
                <span>{clientError || errorMessage}</span>
              </div>
            )}
          </div>

          {/* Destructive / High-Impact Acknowledgment Checkbox */}
          {requireAcknowledgment && (
            <div className="pt-1">
              <label
                htmlFor={ackId}
                className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50/60 border border-rose-200 text-rose-900 text-xs cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  id={ackId}
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  disabled={isLoading}
                  className="mt-0.5 rounded border-rose-300 text-rose-600 focus:ring-rose-500 size-4"
                />
                <span className="font-semibold leading-tight">
                  {acknowledgmentText}
                </span>
              </label>
            </div>
          )}

          <DialogFooter className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={theme.btnVariant === "destructive" ? "destructive" : "default"}
              size="sm"
              disabled={!isValid || isLoading}
              isLoading={isLoading}
              className={`rounded-xl text-xs font-bold px-4 ${
                theme.btnVariant === "warning"
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : theme.btnVariant === "destructive"
                  ? "bg-rose-600 hover:bg-rose-700 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
            >
              {isLoading && <RefreshCw className="size-3.5 animate-spin mr-1.5" />}
              {effectiveConfirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ReasonConfirmModal;

