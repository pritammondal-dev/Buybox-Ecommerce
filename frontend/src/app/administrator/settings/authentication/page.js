"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck,
  Lock,
  Mail,
  Smartphone,
  Globe,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Loader2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { adminAuthPolicyService } from "@/services/admin/admin.service.js";
import { useAdminAuth } from "@/hooks/useAdminAuth.js";

const METHOD_METADATA = {
  emailPassword: {
    id: "emailPassword",
    name: "Email + Password",
    description: "Traditional email and password authentication with argon2id/bcrypt verification.",
    icon: Lock,
    accentColor: "text-blue-600 bg-blue-50 border-blue-200",
  },
  google: {
    id: "google",
    name: "Google Login",
    description: "Cryptographically verified Google OAuth / OpenID Connect token sign-in.",
    icon: Globe,
    accentColor: "text-amber-600 bg-amber-50 border-amber-200",
  },
  emailOtp: {
    id: "emailOtp",
    name: "Email OTP",
    description: "Passwordless 6-digit one-time authentication code delivered via email.",
    icon: Mail,
    accentColor: "text-purple-600 bg-purple-50 border-purple-200",
  },
  mobileOtp: {
    id: "mobileOtp",
    name: "Mobile OTP",
    description: "Passwordless mobile OTP authentication delivered via SMS provider gateway.",
    icon: Smartphone,
    accentColor: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
};

export default function ManagedUserLoginOptionsPage() {
  const { user } = useAdminAuth();
  const [policyData, setPolicyData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingMethod, setUpdatingMethod] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchPolicy = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    setErrorMessage("");
    try {
      const data = await adminAuthPolicyService.getLoginMethods();
      setPolicyData(data);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Failed to load authentication policy";
      setErrorMessage(msg);
      toast.error("Failed to load policy", { description: msg });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchPolicy(true);
  };

  const handleToggle = async (methodId, currentEnabled) => {
    if (!policyData?.customerLogin) return;

    const newEnabled = !currentEnabled;
    setUpdatingMethod(methodId);
    setErrorMessage("");

    // Optimistic state backup
    const previousState = { ...policyData };

    // Optimistic local update
    setPolicyData((prev) => {
      if (!prev) return prev;
      const updatedLogin = { ...prev.customerLogin };
      const currentMethodData = updatedLogin[methodId];
      if (currentMethodData) {
        const isReady = currentMethodData.systemStatus === "READY";
        updatedLogin[methodId] = {
          ...currentMethodData,
          enabled: newEnabled,
          effectiveEnabled: newEnabled && isReady,
        };
      }
      return { ...prev, customerLogin: updatedLogin };
    });

    try {
      const updated = await adminAuthPolicyService.updateLoginMethods({
        [methodId]: newEnabled,
      });

      setPolicyData(updated);
      toast.success(`${METHOD_METADATA[methodId]?.name || methodId} policy updated`, {
        description: `Policy is now ${newEnabled ? "ON" : "OFF"}. Effective status: ${
          updated?.customerLogin?.[methodId]?.effectiveEnabled ? "AVAILABLE" : "UNAVAILABLE"
        }`,
      });
    } catch (err) {
      // Rollback on failure
      setPolicyData(previousState);
      const msg = err?.response?.data?.message || err?.message || "Failed to update login method policy.";
      setErrorMessage(msg);
      toast.error("Update rejected", { description: msg });
    } finally {
      setUpdatingMethod(null);
    }
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case "READY":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="size-3.5" />
            READY
          </span>
        );
      case "NOT_READY":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="size-3.5" />
            NOT READY
          </span>
        );
      case "NOT_CONFIGURED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <HelpCircle className="size-3.5" />
            NOT CONFIGURED
          </span>
        );
      case "ERROR":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="size-3.5" />
            ERROR
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            {status || "UNKNOWN"}
          </span>
        );
    }
  };

  const renderEffectiveBadge = (isEffective) => {
    if (isEffective) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-sm">
          <CheckCircle2 className="size-3.5" />
          AVAILABLE
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700">
        <XCircle className="size-3.5" />
        UNAVAILABLE
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#007A55]">
              Settings &rarr; Authentication
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Managed User Login Options
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Control which authentication methods customers can use to sign in to the storefront.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isLoading || isRefreshing}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin text-[#007A55]" : ""}`} />
          Refresh Status
        </button>
      </div>

      {/* Security Rule Callout */}
      <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-4 flex items-start gap-3.5">
        <ShieldCheck className="size-5 text-[#007A55] shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-950 space-y-1">
          <p className="font-bold">Security Invariant & Policy Enforcement</p>
          <p className="text-emerald-900 leading-relaxed">
            A login method is only available to customers when both <strong>Superadmin Policy is ON</strong> and{" "}
            <strong>System Readiness is READY</strong>. At least one usable login method must remain enabled at all times.
            The backend strictly rejects policy updates that would leave customers with zero login methods.
          </p>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 flex items-start gap-3">
          <AlertTriangle className="size-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-900">
            <p className="font-bold">Operation Failed</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Main Content / Loading */}
      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <Loader2 className="size-8 animate-spin text-[#007A55] mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Loading authentication policy and system readiness...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.keys(METHOD_METADATA).map((methodKey) => {
            const meta = METHOD_METADATA[methodKey];
            const methodData = policyData?.customerLogin?.[methodKey] || {
              enabled: false,
              systemStatus: "NOT_CONFIGURED",
              effectiveEnabled: false,
              reason: null,
            };

            const isUpdating = updatingMethod === methodKey;
            const IconComponent = meta.icon;

            return (
              <div
                key={methodKey}
                className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm transition-all hover:border-slate-300"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Left: Icon, Name, Description */}
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex size-11 shrink-0 items-center justify-center rounded-2xl border ${meta.accentColor}`}
                    >
                      <IconComponent className="size-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-base font-bold text-slate-900">{meta.name}</h2>
                        {renderEffectiveBadge(methodData.effectiveEnabled)}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 max-w-xl">
                        {meta.description}
                      </p>
                    </div>
                  </div>

                  {/* Right: Switch Toggle */}
                  <div className="flex items-center sm:self-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <span className="text-xs font-bold text-slate-600">
                      {methodData.enabled ? "Policy: ON" : "Policy: OFF"}
                    </span>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={methodData.enabled}
                      aria-label={`Toggle ${meta.name}`}
                      disabled={isUpdating}
                      onClick={() => handleToggle(methodKey, methodData.enabled)}
                      className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#007A55] focus:ring-offset-2 disabled:opacity-50 ${
                        methodData.enabled ? "bg-[#007A55]" : "bg-slate-300"
                      }`}
                    >
                      <span className="sr-only">Toggle {meta.name}</span>
                      <span
                        className={`pointer-events-none inline-block size-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                          methodData.enabled ? "translate-x-6" : "translate-x-0"
                        }`}
                      >
                        {isUpdating && <Loader2 className="size-3 animate-spin text-[#007A55]" />}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Status Matrix Subpanel */}
                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50/70 rounded-xl p-3.5">
                  <div>
                    <span className="text-slate-500 font-medium block mb-1">Superadmin Policy</span>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-md font-bold text-xs ${
                        methodData.enabled
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {methodData.enabled ? "ON" : "OFF"}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 font-medium block mb-1">System Readiness</span>
                    {renderStatusBadge(methodData.systemStatus)}
                  </div>

                  <div>
                    <span className="text-slate-500 font-medium block mb-1">Effective Availability</span>
                    <span
                      className={`font-bold ${
                        methodData.effectiveEnabled ? "text-emerald-700" : "text-slate-600"
                      }`}
                    >
                      {methodData.effectiveEnabled ? "AVAILABLE to customers" : "UNAVAILABLE to customers"}
                    </span>
                  </div>
                </div>

                {/* Reason Explanation if not effective */}
                {!methodData.effectiveEnabled && (
                  <div className="mt-2.5 px-3.5 py-2 rounded-lg bg-amber-50/80 border border-amber-200/60 text-xs text-amber-900 flex items-start gap-2">
                    <Info className="size-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      {!methodData.enabled && methodData.systemStatus === "READY" && (
                        <span>Disabled by Superadmin policy. Method is ready to use once enabled.</span>
                      )}
                      {methodData.enabled && methodData.systemStatus !== "READY" && (
                        <span>
                          <strong>Provider unavailable:</strong> {methodData.reason || "Underlying provider infrastructure is not configured or ready."}
                        </span>
                      )}
                      {!methodData.enabled && methodData.systemStatus !== "READY" && (
                        <span>
                          Disabled by policy. Additionally, {methodData.reason?.toLowerCase() || "provider is not configured."}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
