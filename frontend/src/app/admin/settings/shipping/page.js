"use client";

import React, { useState, useEffect } from "react";
import {
  Truck,
  Shield,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Send,
  Eye,
  EyeOff,
  Radio,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader.jsx";
import { credentialService } from "@/services/credential.service.js";

export default function ShippingSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [savingProvider, setSavingProvider] = useState(null);
  const [testingProvider, setTestingProvider] = useState(null);
  const [credentials, setCredentials] = useState({});
  const [feedback, setFeedback] = useState({}); // { [provider]: { type: "success" | "error", message: string } }
  const [visibleSecrets, setVisibleSecrets] = useState({});

  // Delhivery form state
  const [delhiveryApiKey, setDelhiveryApiKey] = useState("");
  const [delhiveryClientId, setDelhiveryClientId] = useState("");
  const [delhiverySecret, setDelhiverySecret] = useState("");

  // Shiprocket form state
  const [shiprocketEmail, setShiprocketEmail] = useState("");
  const [shiprocketPassword, setShiprocketPassword] = useState("");
  const [shiprocketApiKey, setShiprocketApiKey] = useState("");

  const fetchCredentials = async () => {
    try {
      const res = await credentialService.listCredentials();
      const list = res?.data?.data?.credentials || res?.data?.credentials || [];
      const credMap = {};

      list.forEach((c) => {
        credMap[c.provider] = c;
      });

      setCredentials(credMap);

      if (credMap.delhivery) {
        setDelhiveryApiKey(credMap.delhivery.maskedValues?.apiKey || "");
        setDelhiveryClientId(credMap.delhivery.maskedValues?.clientId || "");
        setDelhiverySecret(credMap.delhivery.maskedValues?.clientSecret || "");
      }

      if (credMap.shiprocket) {
        setShiprocketEmail(credMap.shiprocket.maskedValues?.email || "");
        setShiprocketPassword(credMap.shiprocket.maskedValues?.password || "");
        setShiprocketApiKey(credMap.shiprocket.maskedValues?.apiKey || "");
      }
    } catch (err) {
      setFeedback({
        global: {
          type: "error",
          message: err?.response?.data?.message || err?.message || "Failed to load courier credentials.",
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

        if (credMap.delhivery) {
          setDelhiveryApiKey(credMap.delhivery.maskedValues?.apiKey || "");
          setDelhiveryClientId(credMap.delhivery.maskedValues?.clientId || "");
          setDelhiverySecret(credMap.delhivery.maskedValues?.clientSecret || "");
        }

        if (credMap.shiprocket) {
          setShiprocketEmail(credMap.shiprocket.maskedValues?.email || "");
          setShiprocketPassword(credMap.shiprocket.maskedValues?.password || "");
          setShiprocketApiKey(credMap.shiprocket.maskedValues?.apiKey || "");
        }
      })
      .catch((err) => {
        if (!active) return;
        setFeedback({
          global: {
            type: "error",
            message: err?.response?.data?.message || err?.message || "Failed to load courier credentials.",
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

  const handleSaveDelhivery = async (e) => {
    e.preventDefault();
    setSavingProvider("delhivery");
    setFeedback((prev) => ({ ...prev, delhivery: null }));

    try {
      await credentialService.updateCredentials("delhivery", {
        apiKey: delhiveryApiKey.trim(),
        clientId: delhiveryClientId.trim(),
        clientSecret: delhiverySecret.trim(),
        isEnabled: Boolean(delhiveryApiKey.trim()),
      });

      setFeedback((prev) => ({
        ...prev,
        delhivery: {
          type: "success",
          message: "Delhivery logistics credentials encrypted and saved successfully.",
        },
      }));
      fetchCredentials();
    } catch (err) {
      setFeedback((prev) => ({
        ...prev,
        delhivery: {
          type: "error",
          message: err?.response?.data?.message || err?.message || "Failed to update Delhivery credentials.",
        },
      }));
    } finally {
      setSavingProvider(null);
    }
  };

  const handleSaveShiprocket = async (e) => {
    e.preventDefault();
    setSavingProvider("shiprocket");
    setFeedback((prev) => ({ ...prev, shiprocket: null }));

    try {
      await credentialService.updateCredentials("shiprocket", {
        email: shiprocketEmail.trim(),
        password: shiprocketPassword.trim(),
        apiKey: shiprocketApiKey.trim(),
        isEnabled: Boolean(shiprocketEmail.trim()),
      });

      setFeedback((prev) => ({
        ...prev,
        shiprocket: {
          type: "success",
          message: "Shiprocket credentials encrypted and saved successfully.",
        },
      }));
      fetchCredentials();
    } catch (err) {
      setFeedback((prev) => ({
        ...prev,
        shiprocket: {
          type: "error",
          message: err?.response?.data?.message || err?.message || "Failed to update Shiprocket credentials.",
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
          message: res?.data?.message || `${provider} credential verification finished.`,
        },
      }));
      fetchCredentials();
    } catch (err) {
      setFeedback((prev) => ({
        ...prev,
        [provider]: {
          type: "error",
          message: err?.response?.data?.message || err?.message || "Credential validation failed.",
        },
      }));
    } finally {
      setTestingProvider(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl pb-12">
      <PageHeader
        title="Courier & Logistics Integrations"
        description="Connect real courier carriers (Delhivery, Shiprocket) for automated waybill generation, tracking URL synchronization, and webhook status progression. Credentials remain blank until configured."
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
          <p className="text-xs">Loading courier integration state...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Delhivery Integration Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
                  <Truck className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Delhivery Express Logistics</h3>
                  <p className="text-xs text-slate-500">Direct carrier REST API & Webhook handler</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    credentials.delhivery?.status === "connected"
                      ? "bg-emerald-100 text-emerald-800"
                      : credentials.delhivery?.status === "error"
                      ? "bg-red-100 text-red-800"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <span
                    className={`size-2 rounded-full ${
                      credentials.delhivery?.status === "connected"
                        ? "bg-emerald-500"
                        : credentials.delhivery?.status === "error"
                        ? "bg-red-500"
                        : "bg-slate-400"
                    }`}
                  />
                  {credentials.delhivery?.status === "connected"
                    ? "Active & Connected"
                    : credentials.delhivery?.status === "error"
                    ? "Configuration Error"
                    : "Blank / Not Configured"}
                </span>
              </div>
            </div>

            {feedback.delhivery && (
              <div
                className={`p-3.5 rounded-xl text-xs flex items-start gap-2 border ${
                  feedback.delhivery.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-red-50 text-red-800 border-red-200"
                }`}
              >
                {feedback.delhivery.type === "success" ? (
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <span>{feedback.delhivery.message}</span>
              </div>
            )}

            <form onSubmit={handleSaveDelhivery} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* API Token */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    API Authorization Token
                  </label>
                  <div className="relative">
                    <input
                      type={visibleSecrets.delhiveryToken ? "text" : "password"}
                      value={delhiveryApiKey}
                      onChange={(e) => setDelhiveryApiKey(e.target.value)}
                      placeholder="••••••••••••••••"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-[#007A55]"
                    />
                    <button
                      type="button"
                      onClick={() => toggleSecret("delhiveryToken")}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {visibleSecrets.delhiveryToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {/* Client ID */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Client Name / ID
                  </label>
                  <input
                    type="text"
                    value={delhiveryClientId}
                    onChange={(e) => setDelhiveryClientId(e.target.value)}
                    placeholder="BUYBOX_EXP"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#007A55]"
                  />
                </div>

                {/* Webhook Secret */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Webhook HMAC Secret
                  </label>
                  <div className="relative">
                    <input
                      type={visibleSecrets.delhiverySecret ? "text" : "password"}
                      value={delhiverySecret}
                      onChange={(e) => setDelhiverySecret(e.target.value)}
                      placeholder="••••••••••••••••"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-[#007A55]"
                    />
                    <button
                      type="button"
                      onClick={() => toggleSecret("delhiverySecret")}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {visibleSecrets.delhiverySecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <Radio className="size-3.5 text-emerald-600" />
                  <span>Webhook URL: <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px]">/api/v1/shipping/webhooks/delhivery</code></span>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleTest("delhivery")}
                    disabled={testingProvider === "delhivery" || !credentials.delhivery?.isConfigured}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs px-4 py-2 transition-all disabled:opacity-50"
                  >
                    {testingProvider === "delhivery" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Send className="size-3.5" />
                    )}
                    Verify Config
                  </button>

                  <button
                    type="submit"
                    disabled={savingProvider === "delhivery"}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#007A55] hover:bg-[#006346] text-white font-bold text-xs px-5 py-2 shadow-xs transition-all disabled:opacity-50"
                  >
                    {savingProvider === "delhivery" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    Save Delhivery
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Shiprocket Integration Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <Truck className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Shiprocket Aggregator</h3>
                  <p className="text-xs text-slate-500">Multi-carrier automated dispatch & tracking</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    credentials.shiprocket?.status === "connected"
                      ? "bg-emerald-100 text-emerald-800"
                      : credentials.shiprocket?.status === "error"
                      ? "bg-red-100 text-red-800"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <span
                    className={`size-2 rounded-full ${
                      credentials.shiprocket?.status === "connected"
                        ? "bg-emerald-500"
                        : credentials.shiprocket?.status === "error"
                        ? "bg-red-500"
                        : "bg-slate-400"
                    }`}
                  />
                  {credentials.shiprocket?.status === "connected"
                    ? "Active & Connected"
                    : credentials.shiprocket?.status === "error"
                    ? "Configuration Error"
                    : "Blank / Not Configured"}
                </span>
              </div>
            </div>

            {feedback.shiprocket && (
              <div
                className={`p-3.5 rounded-xl text-xs flex items-start gap-2 border ${
                  feedback.shiprocket.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-red-50 text-red-800 border-red-200"
                }`}
              >
                {feedback.shiprocket.type === "success" ? (
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <span>{feedback.shiprocket.message}</span>
              </div>
            )}

            <form onSubmit={handleSaveShiprocket} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Shiprocket Account Email
                  </label>
                  <input
                    type="email"
                    value={shiprocketEmail}
                    onChange={(e) => setShiprocketEmail(e.target.value)}
                    placeholder="logistics@yourdomain.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#007A55]"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Shiprocket Account Password
                  </label>
                  <div className="relative">
                    <input
                      type={visibleSecrets.shiprocketPassword ? "text" : "password"}
                      value={shiprocketPassword}
                      onChange={(e) => setShiprocketPassword(e.target.value)}
                      placeholder="••••••••••••••••"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-[#007A55]"
                    />
                    <button
                      type="button"
                      onClick={() => toggleSecret("shiprocketPassword")}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {visibleSecrets.shiprocketPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {/* API / Webhook Key */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    API / Webhook Token
                  </label>
                  <div className="relative">
                    <input
                      type={visibleSecrets.shiprocketApiKey ? "text" : "password"}
                      value={shiprocketApiKey}
                      onChange={(e) => setShiprocketApiKey(e.target.value)}
                      placeholder="••••••••••••••••"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-[#007A55]"
                    />
                    <button
                      type="button"
                      onClick={() => toggleSecret("shiprocketApiKey")}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {visibleSecrets.shiprocketApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <Radio className="size-3.5 text-purple-600" />
                  <span>Webhook URL: <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px]">/api/v1/shipping/webhooks/shiprocket</code></span>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleTest("shiprocket")}
                    disabled={testingProvider === "shiprocket" || !credentials.shiprocket?.isConfigured}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs px-4 py-2 transition-all disabled:opacity-50"
                  >
                    {testingProvider === "shiprocket" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Send className="size-3.5" />
                    )}
                    Verify Config
                  </button>

                  <button
                    type="submit"
                    disabled={savingProvider === "shiprocket"}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#007A55] hover:bg-[#006346] text-white font-bold text-xs px-5 py-2 shadow-xs transition-all disabled:opacity-50"
                  >
                    {savingProvider === "shiprocket" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    Save Shiprocket
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
