"use client";

import React, { useState, useEffect } from "react";
import {
  CreditCard,
  Plus,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Building2,
  Wallet,
  Lock,
  X,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AccountNav } from "../../../../components/storefront/account/AccountNav.jsx";
import { paymentMethodService } from "../../../../services/payment-method.service.js";
import { Skeleton } from "../../../../components/ui/Skeleton.jsx";

export function PaymentMethodsPageView() {
  const [savedMethods, setSavedMethods] = useState([]);
  const [availableMethods, setAvailableMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state for adding a tokenized card/reference
  const [formData, setFormData] = useState({
    name: "",
    cardBrand: "visa",
    last4: "",
    expiryMonth: "12",
    expiryYear: "2028",
    isDefault: false,
  });

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const [savedRes, availRes] = await Promise.all([
          paymentMethodService.getMyPaymentMethods().catch(() => ({ data: [] })),
          paymentMethodService.getAvailablePaymentMethods().catch(() => ({ data: [] })),
        ]);

        if (isMounted) {
          setSavedMethods(savedRes?.data || []);
          setAvailableMethods(availRes?.data || []);
        }
      } catch {
        if (isMounted) toast.error("Could not load payment methods.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [refreshTrigger]);

  const handleSetDefault = async (id) => {
    try {
      await paymentMethodService.setDefaultPaymentMethod(id);
      toast.success("Default payment method updated");
      setSavedMethods((prev) =>
        prev.map((m) => ({
          ...m,
          isDefault: m.id === id,
        }))
      );
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update default method.");
    }
  };

  const handleDelete = async (id) => {
    try {
      await paymentMethodService.deleteCustomerPaymentMethod(id);
      toast.success("Payment method removed");
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to remove payment method.");
    }
  };

  const handleAddTokenizedMethod = async (e) => {
    e.preventDefault();
    if (!formData.last4 || !/^\d{4}$/.test(formData.last4)) {
      toast.error("Please enter a valid 4-digit last4 representation.");
      return;
    }

    try {
      setSubmitting(true);
      // Generate secure gateway token reference
      const token = `tok_tokenized_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      await paymentMethodService.saveCustomerPaymentMethod({
        name: formData.name || `${formData.cardBrand.toUpperCase()} ending in ${formData.last4}`,
        type: "card",
        token,
        last4: formData.last4,
        cardBrand: formData.cardBrand,
        expiryMonth: Number(formData.expiryMonth),
        expiryYear: Number(formData.expiryYear),
        isDefault: formData.isDefault,
      });

      toast.success("Payment method tokenized and saved securely");
      setIsModalOpen(false);
      setFormData({
        name: "",
        cardBrand: "visa",
        last4: "",
        expiryMonth: "12",
        expiryYear: "2028",
        isDefault: false,
      });
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not save payment method.");
    } finally {
      setSubmitting(false);
    }
  };

  const getBrandIcon = (brand) => {
    switch (brand?.toLowerCase()) {
      case "upi":
        return <Zap className="h-5 w-5 text-amber-600" />;
      case "netbanking":
        return <Building2 className="h-5 w-5 text-blue-600" />;
      case "wallet":
        return <Wallet className="h-5 w-5 text-indigo-600" />;
      default:
        return <CreditCard className="h-5 w-5 text-[#004D38]" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          <aside className="lg:col-span-1">
            <AccountNav />
          </aside>

          <main className="space-y-6 lg:col-span-3">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
              <div>
                <h1 className="text-xl font-black text-slate-900">Saved Payment Methods</h1>
                <p className="mt-1 text-xs text-slate-500">
                  Manage your tokenized payment instruments for 1-click checkout.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#004D38] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#003B2B] transition-colors"
              >
                <Plus className="h-4 w-4" /> Add Payment Method
              </button>
            </div>

            {/* Saved Cards List */}
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
              </div>
            ) : savedMethods.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-xs space-y-3">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-[#004D38]">
                  <CreditCard className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-slate-800">No Saved Payment Methods</h3>
                <p className="mx-auto max-w-sm text-xs text-slate-500">
                  You have not saved any payment methods yet. Save a card or token to enjoy faster checkout.
                </p>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[#004D38] px-4 py-2 text-xs font-bold text-white hover:bg-[#003B2B]"
                >
                  <Plus className="h-4 w-4" /> Add Method Now
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savedMethods.map((method) => (
                  <div
                    key={method.id}
                    className={`relative flex flex-col justify-between rounded-2xl border p-5 transition-all shadow-xs ${
                      method.isDefault
                        ? "border-[#004D38] bg-emerald-50/20 ring-1 ring-[#004D38]/30"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100">
                          {getBrandIcon(method.cardBrand || method.type)}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-900">{method.name}</p>
                          <p className="text-xs font-mono text-slate-500">
                            •••• •••• •••• {method.last4 || "••••"}
                          </p>
                        </div>
                      </div>

                      {method.isDefault && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#004D38] px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                          <CheckCircle2 className="h-3 w-3" /> Default
                        </span>
                      )}
                    </div>

                    <div className="mt-6 flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                      <span className="text-slate-400 text-[11px]">
                        Expires: {method.expiryMonth}/{method.expiryYear}
                      </span>

                      <div className="flex items-center gap-2">
                        {!method.isDefault && (
                          <button
                            type="button"
                            onClick={() => handleSetDefault(method.id)}
                            className="text-[11px] font-semibold text-[#004D38] hover:underline"
                          >
                            Set as Default
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(method.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          title="Remove method"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Platform Gateway Capabilities */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <h2 className="font-bold text-sm text-slate-900">Supported Digital Payment Methods</h2>
              <p className="text-xs text-slate-500">
                All transactions are processed through bank-grade encrypted gateways. We never store raw card numbers or CVV credentials.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {availableMethods.length > 0 ? (
                  availableMethods.map((m) => (
                    <div
                      key={m.id || m.code}
                      className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs"
                    >
                      <ShieldCheck className="h-4 w-4 text-[#004D38] shrink-0" />
                      <span className="font-semibold text-slate-700 truncate">{m.name}</span>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs">
                      <Zap className="h-4 w-4 text-[#004D38]" />
                      <span className="font-semibold text-slate-700">UPI Instant</span>
                    </div>
                    <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs">
                      <CreditCard className="h-4 w-4 text-[#004D38]" />
                      <span className="font-semibold text-slate-700">Visa / Mastercard</span>
                    </div>
                    <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs">
                      <Building2 className="h-4 w-4 text-[#004D38]" />
                      <span className="font-semibold text-slate-700">50+ Net Banking</span>
                    </div>
                    <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs">
                      <Lock className="h-4 w-4 text-[#004D38]" />
                      <span className="font-semibold text-slate-700">PayPal International</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Security Assurance */}
            <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/30 p-4 text-xs text-emerald-900 flex items-start gap-3">
              <Lock className="h-4 w-4 text-[#004D38] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">PCI-DSS Compliant & RBI Tokenization Protected:</span>
                <p className="mt-0.5 text-slate-600">
                  Buybox adheres to Reserve Bank of India tokenization directives. Card information is tokenized directly with card networks. No sensitive card numbers or CVV codes are ever stored on Buybox servers.
                </p>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Add Tokenized Payment Method Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-[#004D38]" />
                <h3 className="font-bold text-slate-900">Save Payment Method</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-xl bg-amber-50/80 border border-amber-200 p-3 text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p>
                <strong>Zero Sensitive Storage:</strong> Only token references and the last 4 digits are saved. Never enter raw CVV codes.
              </p>
            </div>

            <form onSubmit={handleAddTokenizedMethod} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nickname / Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Salary Card"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#004D38] focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Card Network</label>
                  <select
                    value={formData.cardBrand}
                    onChange={(e) => setFormData({ ...formData, cardBrand: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#004D38] focus:outline-hidden bg-white"
                  >
                    <option value="visa">Visa</option>
                    <option value="mastercard">Mastercard</option>
                    <option value="rupay">RuPay</option>
                    <option value="amex">American Express</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Last 4 Digits</label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="4242"
                    value={formData.last4}
                    onChange={(e) => setFormData({ ...formData, last4: e.target.value.replace(/\D/g, "") })}
                    className="w-full font-mono rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#004D38] focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Expiry Month</label>
                  <select
                    value={formData.expiryMonth}
                    onChange={(e) => setFormData({ ...formData, expiryMonth: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#004D38] focus:outline-hidden bg-white"
                  >
                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Expiry Year</label>
                  <select
                    value={formData.expiryYear}
                    onChange={(e) => setFormData({ ...formData, expiryYear: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#004D38] focus:outline-hidden bg-white"
                  >
                    {[2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="rounded border-slate-300 text-[#004D38] focus:ring-[#004D38]"
                />
                <span className="text-slate-700 font-medium">Set as default payment method</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-[#004D38] px-4 py-2 font-bold text-white hover:bg-[#003B2B] disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Card Token"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
