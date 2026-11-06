"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  KeyRound,
  Shield,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Edit2,
  Lock,
  Mail,
  CreditCard,
  Truck,
  ExternalLink,
  X,
  Play,
  Check,
  EyeOff,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import credentialService from "@/services/credential.service.js";

const PROVIDER_CONFIG = {
  google_oauth: {
    category: "auth",
    name: "Google OAuth 2.0",
    description: "Customer and staff single sign-on (SSO) authentication via Google",
    icon: Lock,
    fields: [
      { name: "clientId", label: "Google Client ID", placeholder: "xxxx.apps.googleusercontent.com", secret: false },
      { name: "clientSecret", label: "Google Client Secret", placeholder: "GOCSPX-xxxx", secret: true },
    ],
  },
  elastic_email: {
    category: "email",
    name: "Elastic Email",
    description: "Transactional notifications, order confirmations, and OTP deliveries",
    icon: Mail,
    fields: [
      { name: "apiKey", label: "Elastic Email API Key", placeholder: "01234567-89ab-cdef-...", secret: true },
      { name: "fromEmail", label: "Verified Sender Email", placeholder: "noreply@yourdomain.com", secret: false },
      { name: "senderName", label: "Sender Display Name", placeholder: "Buybox Marketplace", secret: false },
    ],
  },
  razorpay: {
    category: "payment",
    name: "Razorpay Gateway",
    description: "UPI, Cards, NetBanking, and Wallets payment processing for India",
    icon: CreditCard,
    fields: [
      { name: "keyId", label: "Key ID", placeholder: "rzp_live_xxxx or rzp_test_xxxx", secret: false },
      { name: "keySecret", label: "Key Secret", placeholder: "Key Secret", secret: true },
      { name: "webhookSecret", label: "Webhook Signing Secret", placeholder: "whsec_xxxx", secret: true },
    ],
  },
  paypal: {
    category: "payment",
    name: "PayPal Global",
    description: "International checkout processing in USD, EUR, and global currencies",
    icon: CreditCard,
    fields: [
      { name: "clientId", label: "PayPal Client ID", placeholder: "Axxxx...", secret: false },
      { name: "clientSecret", label: "PayPal Secret", placeholder: "Exxxx...", secret: true },
      { name: "mode", label: "Environment Mode", placeholder: "sandbox or live", secret: false },
    ],
  },
  delhivery: {
    category: "shipping",
    name: "Delhivery Logistics",
    description: "Domestic express courier, automated AWB generation, and shipment tracking",
    icon: Truck,
    fields: [
      { name: "apiToken", label: "API Token", placeholder: "Bearer token", secret: true },
      { name: "clientId", label: "Client ID / Account Code", placeholder: "DELHIVERY_CLIENT_CODE", secret: false },
    ],
  },
  shiprocket: {
    category: "shipping",
    name: "Shiprocket Multi-Carrier",
    description: "Multi-courier aggregation and shipping management integration",
    icon: Truck,
    fields: [
      { name: "email", label: "Shiprocket Account Email", placeholder: "shipping@yourdomain.com", secret: false },
      { name: "password", label: "API Password", placeholder: "Account Password", secret: true },
    ],
  },
};

export default function PlatformCredentialsPage() {
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Modal State
  const [activeModalProvider, setActiveModalProvider] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  // Testing State
  const [testingProvider, setTestingProvider] = useState(null);
  const [testResult, setTestResult] = useState(null);

  const fetchCredentials = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await credentialService.listCredentials();
      const items = res?.data?.data?.credentials || res?.data?.data || res?.data?.credentials || [];
      setCredentials(Array.isArray(items) ? items : []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load platform credentials"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  const openConfigure = (providerKey) => {
    setActiveModalProvider(providerKey);
    setFormData({});
  };

  const handleFieldChange = (fieldName, value) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleSaveCredentials = async (e) => {
    e.preventDefault();
    if (!activeModalProvider) return;

    setSaving(true);
    try {
      await credentialService.updateCredentials(activeModalProvider, formData);
      toast.success(`Credentials for ${PROVIDER_CONFIG[activeModalProvider]?.name || activeModalProvider} saved securely`);
      setSuccess(`Credentials for ${PROVIDER_CONFIG[activeModalProvider]?.name || activeModalProvider} saved securely`);
      setActiveModalProvider(null);
      setFormData({});
      setTimeout(() => setSuccess(null), 4000);
      fetchCredentials();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to update credentials");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (providerKey) => {
    setTestingProvider(providerKey);
    setTestResult(null);
    try {
      const res = await credentialService.testCredential(providerKey);
      const outcome = res?.data?.data || res?.data || res;
      setTestResult({
        provider: providerKey,
        success: outcome.success !== false,
        message: outcome.message || "Connectivity and credential validation passed!",
      });
      fetchCredentials();
    } catch (err) {
      setTestResult({
        provider: providerKey,
        success: false,
        message: err?.response?.data?.message || err?.message || "Connection test failed",
      });
    } finally {
      setTestingProvider(null);
    }
  };

  const filteredCredentials = credentials.filter((c) => {
    if (categoryFilter === "all") return true;
    return c.category === categoryFilter;
  });

  return (
    <div className="space-y-6">
      {/* Security Governance Banner */}
      <div className="bg-gradient-to-r from-[#004D38] via-[#005B43] to-[#007A55] text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-lg border border-emerald-800/40">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 text-emerald-100 rounded-full text-xs font-semibold border border-white/20 backdrop-blur-xs">
            <Lock className="size-3.5" />
            <span>FIPS-Compliant Envelope Encryption</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Integration Credentials</h1>
          <p className="text-sm text-emerald-100/90 leading-relaxed">
            Sensitive platform API keys, payment provider secrets, and OAuth credentials are encrypted at rest using AES-256-GCM. Raw secrets are strictly masked and never returned in plaintext to web browsers.
          </p>
        </div>
        <div className="absolute right-6 -bottom-6 opacity-10 pointer-events-none">
          <Shield className="size-56 text-white" />
        </div>
      </div>

      {/* Action Bar & Alerts */}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2.5">
          <CheckCircle className="size-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2.5">
          <AlertTriangle className="size-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {testResult && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center justify-between gap-2.5 border ${
            testResult.success
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {testResult.success ? (
              <CheckCircle className="size-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="size-4 text-rose-600 shrink-0" />
            )}
            <span>
              <strong>{PROVIDER_CONFIG[testResult.provider]?.name}:</strong> {testResult.message}
            </span>
          </div>
          <button
            onClick={() => setTestResult(null)}
            className="text-xs font-semibold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "all", label: "All Integrations" },
            { id: "auth", label: "Authentication" },
            { id: "payment", label: "Payments" },
            { id: "email", label: "Email & Notifications" },
            { id: "shipping", label: "Logistics & Shipping" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-colors ${
                categoryFilter === cat.id
                  ? "bg-[#004D38] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <button
          onClick={fetchCredentials}
          className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-xl transition-colors self-end sm:self-auto"
          title="Refresh"
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-400 text-xs">
            <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-[#004D38]" />
            <span>Loading integration credentials...</span>
          </div>
        ) : filteredCredentials.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 text-xs bg-white rounded-2xl border border-dashed border-slate-200">
            No integration providers configured.
          </div>
        ) : (
          filteredCredentials.map((c) => {
            const config = PROVIDER_CONFIG[c.provider] || {
              name: c.name || c.provider,
              category: c.category,
              description: "Third-party platform integration",
              icon: KeyRound,
              fields: [],
            };
            const IconComponent = config.icon || KeyRound;
            const isConfigured = c.status === "connected" || c.isConfigured || (c.maskedValues && Object.keys(c.maskedValues).length > 0);

            return (
              <div
                key={c.provider}
                className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-colors"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="size-11 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#004D38]">
                        <IconComponent className="size-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">{config.name}</h3>
                        <span className="capitalize text-[10px] font-semibold text-slate-400">
                          {c.category} Integration
                        </span>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        c.status === "connected"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : c.status === "error"
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : isConfigured
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          c.status === "connected"
                            ? "bg-emerald-600"
                            : c.status === "error"
                            ? "bg-rose-600"
                            : isConfigured
                            ? "bg-blue-600"
                            : "bg-slate-400"
                        }`}
                      />
                      {c.status === "connected"
                        ? "Active"
                        : c.status === "error"
                        ? "Error"
                        : isConfigured
                        ? "Configured"
                        : "Not Configured"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                    {config.description}
                  </p>

                  {/* Masked Values Display */}
                  <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5 text-[11px]">
                    {config.fields.map((f) => {
                      const maskedVal = c.maskedValues?.[f.name] || (isConfigured ? "••••••••••••••••" : "Not set");
                      return (
                        <div key={f.name} className="flex items-center justify-between text-slate-600 font-mono">
                          <span className="text-slate-400 font-sans">{f.label}:</span>
                          <span className="truncate max-w-[150px] font-semibold text-slate-800">
                            {maskedVal}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Last Test Outcome */}
                  {c.lastTestedAt && (
                    <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between">
                      <span>Last verified: {new Date(c.lastTestedAt).toLocaleDateString("en-IN")}</span>
                      <span className={c.lastTestStatus === "success" ? "text-emerald-700 font-medium" : "text-rose-600 font-medium"}>
                        {c.lastTestStatus === "success" ? "Valid" : "Failed"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <button
                    onClick={() => handleTestConnection(c.provider)}
                    disabled={testingProvider === c.provider || !isConfigured}
                    className="inline-flex items-center gap-1 text-[#004D38] font-semibold hover:underline disabled:opacity-40"
                  >
                    <Activity className={`size-3.5 ${testingProvider === c.provider ? "animate-spin" : ""}`} />
                    <span>{testingProvider === c.provider ? "Testing..." : "Test Connection"}</span>
                  </button>

                  <button
                    onClick={() => openConfigure(c.provider)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#004D38] hover:bg-[#003828] text-white font-semibold rounded-xl shadow-xs transition-colors"
                  >
                    <Edit2 className="size-3" />
                    <span>{isConfigured ? "Update Keys" : "Configure"}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CONFIGURE MODAL */}
      {activeModalProvider && PROVIDER_CONFIG[activeModalProvider] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-[#004D38] rounded-xl">
                  <Lock className="size-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Configure {PROVIDER_CONFIG[activeModalProvider].name}
                  </h3>
                  <p className="text-slate-400 text-[11px]">Values are encrypted via AES-256-GCM</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModalProvider(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCredentials} className="space-y-3.5">
              {PROVIDER_CONFIG[activeModalProvider].fields.map((f) => (
                <div key={f.name}>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {f.label} *
                  </label>
                  <input
                    type={f.secret ? "password" : "text"}
                    required
                    value={formData[f.name] || ""}
                    onChange={(e) => handleFieldChange(f.name, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                  />
                </div>
              ))}

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] flex items-center gap-2">
                <Shield className="size-4 shrink-0 text-amber-600" />
                <span>Security Audit: Modifying platform keys will generate an immutable audit log entry.</span>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setActiveModalProvider(null)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 font-semibold text-white bg-[#004D38] hover:bg-[#003828] rounded-xl shadow-xs disabled:opacity-50"
                >
                  {saving ? "Encrypting & Saving..." : "Save Credentials"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
