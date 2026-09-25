"use client";

import React, { useState, useEffect } from "react";
import {
  Mail,
  Shield,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Save,
  Send,
  Eye,
  EyeOff,
  History,
  Key,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader.jsx";
import { credentialService } from "@/services/credential.service.js";

export default function NotificationsSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [credential, setCredential] = useState(null);
  const [showApiKey, setShowApiKey] = useState(false);

  // Form states
  const [apiKey, setApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");

  // Feedback states
  const [statusMessage, setStatusMessage] = useState(null); // { type: "success" | "error" | "info", text: string }
  const [testResult, setTestResult] = useState(null);

  const fetchCredentials = async () => {
    try {
      const res = await credentialService.listCredentials();
      const list = res?.data?.data?.credentials || res?.data?.credentials || [];
      const emailCred = list.find((c) => c.provider === "elastic_email") || null;

      if (emailCred) {
        setCredential(emailCred);
        setApiKey(emailCred.maskedValues?.apiKey || "");
        setFromEmail(emailCred.maskedValues?.fromEmail || "");
        setFromName(emailCred.maskedValues?.fromName || "Buybox Support");
      }
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err?.response?.data?.message || err?.message || "Failed to load platform credentials.",
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
        const emailCred = list.find((c) => c.provider === "elastic_email") || null;
        if (emailCred) {
          setCredential(emailCred);
          setApiKey(emailCred.maskedValues?.apiKey || "");
          setFromEmail(emailCred.maskedValues?.fromEmail || "");
          setFromName(emailCred.maskedValues?.fromName || "Buybox Support");
        }
      })
      .catch((err) => {
        if (!active) return;
        setStatusMessage({
          type: "error",
          text: err?.response?.data?.message || err?.message || "Failed to load platform credentials.",
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    try {
      const res = await credentialService.updateCredentials("elastic_email", {
        apiKey: apiKey.trim(),
        fromEmail: fromEmail.trim(),
        fromName: fromName.trim(),
        isEnabled: true,
      });

      const updated = res?.data?.data?.credential || res?.data?.credential;
      if (updated) {
        setCredential(updated);
        setApiKey(updated.maskedValues?.apiKey || apiKey);
      }

      setStatusMessage({
        type: "success",
        text: "Elastic Email production credentials updated and securely encrypted at rest.",
      });
      fetchCredentials();
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err?.response?.data?.message || err?.message || "Failed to update credentials.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async (e) => {
    e.preventDefault();
    setTesting(true);
    setTestResult(null);

    try {
      const res = await credentialService.testCredential("elastic_email", {
        recipientEmail: recipientEmail.trim() || undefined,
      });

      setTestResult({
        success: res?.data?.success ?? true,
        message: res?.data?.message || "Test email dispatched successfully.",
      });
      fetchCredentials();
    } catch (err) {
      setTestResult({
        success: false,
        message:
          err?.response?.data?.message ||
          err?.message ||
          "Elastic Email rejected connection test. Verify API key and account status.",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl pb-12">
      <PageHeader
        title="Email & Notification Settings"
        description="Configure transactional email delivery via the official Elastic Email REST API. All credentials are encrypted server-side with AES-256-GCM."
        backHref="/admin/settings"
        backLabel="Settings"
      />

      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs flex items-start gap-2.5 border ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-500">
          <Loader2 className="size-8 animate-spin mx-auto text-[#007A55] mb-2" />
          <p className="text-xs">Loading integration status...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Credentials Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-emerald-50 text-[#007A55] flex items-center justify-center font-bold">
                    <Mail className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Elastic Email Configuration</h3>
                    <p className="text-xs text-slate-500">Official REST API v4 Integration</p>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    credential?.status === "connected"
                      ? "bg-emerald-100 text-emerald-800"
                      : credential?.status === "error"
                      ? "bg-red-100 text-red-800"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <span
                    className={`size-2 rounded-full ${
                      credential?.status === "connected"
                        ? "bg-emerald-500"
                        : credential?.status === "error"
                        ? "bg-red-500"
                        : "bg-slate-400"
                    }`}
                  />
                  {credential?.status === "connected"
                    ? "Active & Connected"
                    : credential?.status === "error"
                    ? "Connection Error"
                    : "Not Configured"}
                </span>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                {/* API Key */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Elastic Email API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="00000000-0000-0000-0000-000000000000"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-[#007A55] focus:ring-1 focus:ring-[#007A55]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Existing keys are masked. Leaving the masked value untouched preserves the current secret.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* From Email */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Sender Email (From)
                    </label>
                    <input
                      type="email"
                      value={fromEmail}
                      onChange={(e) => setFromEmail(e.target.value)}
                      placeholder="support@yourdomain.com"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#007A55] focus:ring-1 focus:ring-[#007A55]"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Must be a verified sender in Elastic Email.
                    </p>
                  </div>

                  {/* From Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Sender Display Name
                    </label>
                    <input
                      type="text"
                      value={fromName}
                      onChange={(e) => setFromName(e.target.value)}
                      placeholder="Buybox Notifications"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#007A55] focus:ring-1 focus:ring-[#007A55]"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-full bg-[#007A55] hover:bg-[#006346] text-white font-bold text-xs px-6 py-2.5 shadow-sm active:scale-95 transition-all disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Saving Secrets...
                      </>
                    ) : (
                      <>
                        <Save className="size-3.5" />
                        Save Credentials
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Test Email Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Send className="size-4 text-[#007A55]" />
                <h3>Test Live Delivery</h3>
              </div>
              <p className="text-xs text-slate-500">
                Dispatch a real test notification through the configured Elastic Email provider to verify API connectivity and sender validation.
              </p>

              {testResult && (
                <div
                  className={`p-3.5 rounded-xl text-xs flex items-start gap-2 border ${
                    testResult.success
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-amber-50 text-amber-800 border-amber-200"
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              <form onSubmit={handleTestEmail} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="admin@yourdomain.com (test recipient)"
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#007A55]"
                />
                <button
                  type="submit"
                  disabled={testing || !credential?.isConfigured}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-5 py-2 shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testing ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Send className="size-3.5" />
                      Send Test Ping
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Security & Audit Sidebar */}
          <div className="space-y-6">
            <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-5 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                <Shield className="size-4 text-[#007A55]" />
                Security Standards
              </div>
              <ul className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="size-1.5 rounded-full bg-[#007A55] mt-1.5 shrink-0" />
                  <span><strong>Render SMTP Forbidden:</strong> All emails use official Elastic Email REST API endpoints directly.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="size-1.5 rounded-full bg-[#007A55] mt-1.5 shrink-0" />
                  <span><strong>AES-256-GCM Encryption:</strong> Sensitive keys are encrypted at rest with unique initialization vectors and authentication tags.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="size-1.5 rounded-full bg-[#007A55] mt-1.5 shrink-0" />
                  <span><strong>Frontend Secret Redaction:</strong> GET requests return exclusively masked tokens (<code className="text-[10px] bg-slate-200 px-1 py-0.5 rounded font-mono">••••••••cdef</code>).</span>
                </li>
              </ul>
            </div>

            {/* Audit Trail */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider border-b pb-3">
                <History className="size-4 text-slate-500" />
                Audit Trail
              </div>

              {credential?.auditTrail?.length > 0 ? (
                <div className="space-y-3">
                  {credential.auditTrail.slice(0, 5).map((log, idx) => (
                    <div key={idx} className="text-xs text-slate-600 border-b border-slate-100 last:border-0 pb-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">Superadmin</span>
                      </div>
                      <p className="mt-1 text-slate-700 font-medium">
                        Updated: {log.fieldsChanged?.join(", ") || "Configuration"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No recent modification history.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
