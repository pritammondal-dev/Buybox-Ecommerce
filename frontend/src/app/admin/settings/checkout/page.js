"use client";

import React, { useState, useEffect } from "react";
import {
  CreditCard,
  Shield,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Send,
  Eye,
  EyeOff,
  Lock,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader.jsx";
import { credentialService } from "@/services/credential.service.js";

export default function CheckoutSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [savingProvider, setSavingProvider] = useState(null);
  const [testingProvider, setTestingProvider] = useState(null);
  const [credentials, setCredentials] = useState({});
  const [feedback, setFeedback] = useState({});
  const [visibleSecrets, setVisibleSecrets] = useState({});

  // Razorpay state
  const [razorpayKeyId, setRazorpayKeyId] = useState("");
  const [razorpayKeySecret, setRazorpayKeySecret] = useState("");
  const [razorpayWebhookSecret, setRazorpayWebhookSecret] = useState("");

  // PayPal state
  const [paypalClientId, setPaypalClientId] = useState("");
  const [paypalClientSecret, setPaypalClientSecret] = useState("");
  const [paypalMode, setPaypalMode] = useState("sandbox");

  const fetchCredentials = async () => {
    try {
      const res = await credentialService.listCredentials();
      const list = res?.data?.data?.credentials || res?.data?.credentials || [];
      const credMap = {};

      list.forEach((c) => {
        credMap[c.provider] = c;
      });

      setCredentials(credMap);

      if (credMap.razorpay) {
        setRazorpayKeyId(credMap.razorpay.maskedValues?.keyId || "");
        setRazorpayKeySecret(credMap.razorpay.maskedValues?.keySecret || "");
        setRazorpayWebhookSecret(credMap.razorpay.maskedValues?.webhookSecret || "");
      }

      if (credMap.paypal) {
        setPaypalClientId(credMap.paypal.maskedValues?.clientId || "");
        setPaypalClientSecret(credMap.paypal.maskedValues?.clientSecret || "");
        setPaypalMode(credMap.paypal.maskedValues?.mode || "sandbox");
      }
    } catch (err) {
      setFeedback({
        global: {
          type: "error",
          message: err?.response?.data?.message || err?.message || "Failed to load payment credentials.",
        },
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    credentialService
      .listCredentials()
      .then((res) => {
        if (!active) return;
        const list = res?.data?.data?.credentials || res?.data?.credentials || [];
        const credMap = {};
        list.forEach((c) => {
          credMap[c.provider] = c;
        });
        setCredentials(credMap);

        if (credMap.razorpay) {
          setRazorpayKeyId(credMap.razorpay.maskedValues?.keyId || "");
          setRazorpayKeySecret(credMap.razorpay.maskedValues?.keySecret || "");
          setRazorpayWebhookSecret(credMap.razorpay.maskedValues?.webhookSecret || "");
        }

        if (credMap.paypal) {
          setPaypalClientId(credMap.paypal.maskedValues?.clientId || "");
          setPaypalClientSecret(credMap.paypal.maskedValues?.clientSecret || "");
          setPaypalMode(credMap.paypal.maskedValues?.mode || "sandbox");
        }
      })
      .catch((err) => {
        if (!active) return;
        setFeedback({
          global: {
            type: "error",
            message: err?.response?.data?.message || err?.message || "Failed to load payment credentials.",
          },
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const toggleSecret = (key) => {
    setVisibleSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveRazorpay = async (e) => {
    e.preventDefault();
    setSavingProvider("razorpay");
    setFeedback((prev) => ({ ...prev, razorpay: null }));

    try {
      await credentialService.updateCredentials("razorpay", {
        keyId: razorpayKeyId.trim(),
        keySecret: razorpayKeySecret.trim(),
        webhookSecret: razorpayWebhookSecret.trim(),
        isEnabled: Boolean(razorpayKeyId.trim()),
      });

      setFeedback((prev) => ({
        ...prev,
        razorpay: {
          type: "success",
          message: "Razorpay credentials encrypted and stored securely.",
        },
      }));
      fetchCredentials();
    } catch (err) {
      setFeedback((prev) => ({
        ...prev,
        razorpay: {
          type: "error",
          message: err?.response?.data?.message || err?.message || "Failed to save Razorpay credentials.",
        },
      }));
    } finally {
      setSavingProvider(null);
    }
  };

  const handleSavePaypal = async (e) => {
    e.preventDefault();
    setSavingProvider("paypal");
    setFeedback((prev) => ({ ...prev, paypal: null }));

    try {
      await credentialService.updateCredentials("paypal", {
        clientId: paypalClientId.trim(),
        clientSecret: paypalClientSecret.trim(),
        mode: paypalMode,
        isEnabled: Boolean(paypalClientId.trim()),
      });

      setFeedback((prev) => ({
        ...prev,
        paypal: {
          type: "success",
          message: "PayPal credentials encrypted and stored securely.",
        },
      }));
      fetchCredentials();
    } catch (err) {
      setFeedback((prev) => ({
        ...prev,
        paypal: {
          type: "error",
          message: err?.response?.data?.message || err?.message || "Failed to save PayPal credentials.",
        },
      }));
    } finally {
      setSavingProvider(null);
    }
  };

  const handleTest = async (provider) => {
    setTestingProvider(provider);
    setFeedback((prev) => ({ ...prev, [provider]: null }));

    try {
      const res = await credentialService.testCredential(provider);
      setFeedback((prev) => ({
        ...prev,
        [provider]: {
          type: res?.data?.success ? "success" : "error",
          message: res?.data?.message || `${provider} validation finished.`,
        },
      }));
      fetchCredentials();
    } catch (err) {
      setFeedback((prev) => ({
        ...prev,
        [provider]: {
          type: "error",
          message: err?.response?.data?.message || err?.message || "Validation failed.",
        },
      }));
    } finally {
      setTestingProvider(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl pb-12">
      <PageHeader
        title="Payment Gateway Settings"
        description="Configure production keys and secrets for Razorpay and PayPal. All sensitive keys are server-side encrypted with AES-256-GCM and never returned raw."
        backHref="/admin/settings"
        backLabel="Settings"
      />

      {feedback.global && (
        <div className="p-4 rounded-xl text-xs flex items-start gap-2.5 bg-red-50 text-red-800 border border-red-200">
          <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
          <span>{feedback.global.message}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-500">
          <Loader2 className="size-8 animate-spin mx-auto text-[#007A55] mb-2" />
          <p className="text-xs">Loading payment provider configurations...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Razorpay Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <CreditCard className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Razorpay Payments</h3>
                  <p className="text-xs text-slate-500">UPI, Net Banking, Cards & Wallets</p>
                </div>
              </div>

              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  credentials.razorpay?.status === "connected"
                    ? "bg-emerald-100 text-emerald-800"
                    : credentials.razorpay?.status === "error"
                    ? "bg-red-100 text-red-800"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                <span
                  className={`size-2 rounded-full ${
                    credentials.razorpay?.status === "connected"
                      ? "bg-emerald-500"
                      : credentials.razorpay?.status === "error"
                      ? "bg-red-500"
                      : "bg-slate-400"
                  }`}
                />
                {credentials.razorpay?.status === "connected"
                  ? "Active & Connected"
                  : credentials.razorpay?.status === "error"
                  ? "Configuration Error"
                  : "Not Configured"}
              </span>
            </div>

            {feedback.razorpay && (
              <div
                className={`p-3.5 rounded-xl text-xs flex items-start gap-2 border ${
                  feedback.razorpay.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-red-50 text-red-800 border-red-200"
                }`}
              >
                {feedback.razorpay.type === "success" ? (
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <span>{feedback.razorpay.message}</span>
              </div>
            )}

            <form onSubmit={handleSaveRazorpay} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Razorpay Key ID
                  </label>
                  <input
                    type="text"
                    value={razorpayKeyId}
                    onChange={(e) => setRazorpayKeyId(e.target.value)}
                    placeholder="rzp_live_••••••••"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-[#007A55]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Razorpay Key Secret
                  </label>
                  <div className="relative">
                    <input
                      type={visibleSecrets.rzpSecret ? "text" : "password"}
                      value={razorpayKeySecret}
                      onChange={(e) => setRazorpayKeySecret(e.target.value)}
                      placeholder="••••••••••••••••"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-[#007A55]"
                    />
                    <button
                      type="button"
                      onClick={() => toggleSecret("rzpSecret")}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {visibleSecrets.rzpSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Webhook Secret
                  </label>
                  <div className="relative">
                    <input
                      type={visibleSecrets.rzpWebhook ? "text" : "password"}
                      value={razorpayWebhookSecret}
                      onChange={(e) => setRazorpayWebhookSecret(e.target.value)}
                      placeholder="••••••••••••••••"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-[#007A55]"
                    />
                    <button
                      type="button"
                      onClick={() => toggleSecret("rzpWebhook")}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {visibleSecrets.rzpWebhook ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => handleTest("razorpay")}
                  disabled={testingProvider === "razorpay" || !credentials.razorpay?.isConfigured}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs px-4 py-2 transition-all disabled:opacity-50"
                >
                  {testingProvider === "razorpay" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                  Verify Config
                </button>

                <button
                  type="submit"
                  disabled={savingProvider === "razorpay"}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#007A55] hover:bg-[#006346] text-white font-bold text-xs px-5 py-2 shadow-xs transition-all disabled:opacity-50"
                >
                  {savingProvider === "razorpay" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                  Save Razorpay
                </button>
              </div>
            </form>
          </div>

          {/* PayPal Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                  <CreditCard className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">PayPal International</h3>
                  <p className="text-xs text-slate-500">Cross-border global payments</p>
                </div>
              </div>

              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  credentials.paypal?.status === "connected"
                    ? "bg-emerald-100 text-emerald-800"
                    : credentials.paypal?.status === "error"
                    ? "bg-red-100 text-red-800"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                <span
                  className={`size-2 rounded-full ${
                    credentials.paypal?.status === "connected"
                      ? "bg-emerald-500"
                      : credentials.paypal?.status === "error"
                      ? "bg-red-500"
                      : "bg-slate-400"
                  }`}
                />
                {credentials.paypal?.status === "connected"
                  ? "Active & Connected"
                  : credentials.paypal?.status === "error"
                  ? "Configuration Error"
                  : "Not Configured"}
              </span>
            </div>

            {feedback.paypal && (
              <div
                className={`p-3.5 rounded-xl text-xs flex items-start gap-2 border ${
                  feedback.paypal.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-red-50 text-red-800 border-red-200"
                }`}
              >
                {feedback.paypal.type === "success" ? (
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <span>{feedback.paypal.message}</span>
              </div>
            )}

            <form onSubmit={handleSavePaypal} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    PayPal Client ID
                  </label>
                  <input
                    type="text"
                    value={paypalClientId}
                    onChange={(e) => setPaypalClientId(e.target.value)}
                    placeholder="PAYPAL_CLIENT_••••••••"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-[#007A55]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    PayPal Client Secret
                  </label>
                  <div className="relative">
                    <input
                      type={visibleSecrets.paypalSecret ? "text" : "password"}
                      value={paypalClientSecret}
                      onChange={(e) => setPaypalClientSecret(e.target.value)}
                      placeholder="••••••••••••••••"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-[#007A55]"
                    />
                    <button
                      type="button"
                      onClick={() => toggleSecret("paypalSecret")}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {visibleSecrets.paypalSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Environment Mode
                  </label>
                  <select
                    value={paypalMode}
                    onChange={(e) => setPaypalMode(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#007A55]"
                  >
                    <option value="sandbox">Sandbox (Testing)</option>
                    <option value="live">Live (Production)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => handleTest("paypal")}
                  disabled={testingProvider === "paypal" || !credentials.paypal?.isConfigured}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs px-4 py-2 transition-all disabled:opacity-50"
                >
                  {testingProvider === "paypal" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                  Verify Config
                </button>

                <button
                  type="submit"
                  disabled={savingProvider === "paypal"}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#007A55] hover:bg-[#006346] text-white font-bold text-xs px-5 py-2 shadow-xs transition-all disabled:opacity-50"
                >
                  {savingProvider === "paypal" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                  Save PayPal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
