"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  CreditCard,
  Zap,
  Building2,
  Wallet,
  Globe,
  Banknote,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "../../ui/Button.jsx";
import { Badge } from "../../ui/Badge.jsx";
import { Card } from "../../ui/Card.jsx";
import { Input } from "../../ui/Input.jsx";
import { Switch } from "../../ui/Switch.jsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../../ui/Dialog.jsx";
import { ConfirmDialog } from "../ConfirmDialog.jsx";
import { paymentMethodService } from "../../../services/payment-method.service.js";

const ICON_MAP = {
  Zap: Zap,
  CreditCard: CreditCard,
  Building2: Building2,
  Wallet: Wallet,
  Globe: Globe,
  Banknote: Banknote,
};

const GATEWAY_COLORS = {
  razorpay: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/40",
  paypal: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/40",
  internal: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/40",
};

export function AdminPaymentMethodsView() {
  const [methods, setMethods] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGateway, setSelectedGateway] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  // Edit / Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState(null);
  const [modalFormData, setModalFormData] = useState({
    name: "",
    code: "",
    gateway: "razorpay",
    type: "upi",
    description: "",
    icon: "CreditCard",
    enabled: false,
    displayOrder: 1,
    supportedCountries: "IN",
    supportedCurrencies: "INR",
    minimumOrderAmount: "0",
    maximumOrderAmount: "",
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirm State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [methodToDelete, setMethodToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      try {
        const res = await paymentMethodService.listAllPaymentMethods({
          search: searchTerm || undefined,
          gateway: selectedGateway !== "all" ? selectedGateway : undefined,
          status: selectedStatus !== "all" ? selectedStatus : undefined,
        });
        if (!isCancelled) {
          setMethods(res.data || []);
          setError(null);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.response?.data?.message || err.message || "Failed to load payment methods");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [searchTerm, selectedGateway, selectedStatus, refreshTrigger]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleToggle = async (method) => {
    try {
      setError(null);
      const res = await paymentMethodService.togglePaymentMethod(method._id);
      setMethods((prev) =>
        prev.map((m) => (m._id === method._id ? { ...m, enabled: res.data.enabled } : m))
      );
      setSuccessMessage(
        `Method '${method.name}' ${res.data.enabled ? "activated" : "deactivated"} successfully`
      );
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          `Cannot toggle ${method.name}: Check if server credentials are configured.`
      );
      setTimeout(() => setError(null), 6000);
    }
  };

  const handleMove = async (index, direction) => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= methods.length) return;

    const reordered = [...methods];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    setMethods(reordered);

    try {
      const orderedIds = reordered.map((m) => m._id);
      await paymentMethodService.reorderPaymentMethods(orderedIds);
    } catch (err) {
      setError("Failed to save new display order");
      handleRefresh();
    }
  };

  const openCreateModal = () => {
    setEditingMethod(null);
    setModalFormData({
      name: "",
      code: "",
      gateway: "razorpay",
      type: "card",
      description: "",
      icon: "CreditCard",
      enabled: false,
      displayOrder: methods.length + 1,
      supportedCountries: "IN",
      supportedCurrencies: "INR",
      minimumOrderAmount: "0",
      maximumOrderAmount: "",
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (method) => {
    setEditingMethod(method);
    setModalFormData({
      name: method.name || "",
      code: method.code || "",
      gateway: method.gateway || "razorpay",
      type: method.type || "card",
      description: method.description || "",
      icon: method.icon || "CreditCard",
      enabled: Boolean(method.enabled),
      displayOrder: method.displayOrder || 1,
      supportedCountries: Array.isArray(method.supportedCountries)
        ? method.supportedCountries.join(", ")
        : "IN",
      supportedCurrencies: Array.isArray(method.supportedCurrencies)
        ? method.supportedCurrencies.join(", ")
        : "INR",
      minimumOrderAmount: method.minimumOrderAmount?.toString?.() || "0",
      maximumOrderAmount: method.maximumOrderAmount?.toString?.() || "",
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!modalFormData.name.trim()) errors.name = "Name is required";
    if (!modalFormData.code.trim()) {
      errors.code = "Code is required";
    } else if (!/^[a-z0-9_-]+$/.test(modalFormData.code.trim())) {
      errors.code = "Code must contain only lowercase letters, numbers, hyphens or underscores";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: modalFormData.name.trim(),
        code: modalFormData.code.trim().toLowerCase(),
        gateway: modalFormData.gateway,
        type: modalFormData.type,
        description: modalFormData.description.trim(),
        icon: modalFormData.icon,
        enabled: modalFormData.enabled,
        displayOrder: Number(modalFormData.displayOrder) || 1,
        supportedCountries: modalFormData.supportedCountries
          .split(",")
          .map((c) => c.trim().toUpperCase())
          .filter(Boolean),
        supportedCurrencies: modalFormData.supportedCurrencies
          .split(",")
          .map((c) => c.trim().toUpperCase())
          .filter(Boolean),
        minimumOrderAmount: Number(modalFormData.minimumOrderAmount) || 0,
        maximumOrderAmount: modalFormData.maximumOrderAmount
          ? Number(modalFormData.maximumOrderAmount)
          : null,
      };

      if (editingMethod) {
        await paymentMethodService.updatePaymentMethod(editingMethod._id, payload);
        setSuccessMessage(`Payment method '${payload.name}' updated successfully`);
      } else {
        await paymentMethodService.createPaymentMethod(payload);
        setSuccessMessage(`Payment method '${payload.name}' created successfully`);
      }

      setIsModalOpen(false);
      handleRefresh();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save payment method");
      setTimeout(() => setError(null), 6000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!methodToDelete) return;
    setIsDeleting(true);
    try {
      await paymentMethodService.deletePaymentMethod(methodToDelete._id);
      setSuccessMessage(`Payment method '${methodToDelete.name}' archived successfully`);
      setIsDeleteOpen(false);
      handleRefresh();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to archive payment method");
      setTimeout(() => setError(null), 6000);
    } finally {
      setIsDeleting(false);
    }
  };

  const activeCount = methods.filter((m) => m.enabled).length;

  return (
    <div className="space-y-6">
      {/* Alert Notices */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm font-medium">
          <AlertCircle className="size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
          <CheckCircle2 className="size-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center justify-between border-slate-200 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Methods
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">{methods.length}</p>
          </div>
          <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <CreditCard className="size-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-slate-200 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active on Checkout
            </p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {activeCount}
            </p>
          </div>
          <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="size-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-slate-200 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Gateways
            </p>
            <p className="text-sm font-bold text-foreground mt-1">Razorpay + PayPal</p>
            <p className="text-[11px] text-muted-foreground">Server-side HMAC/OAuth2</p>
          </div>
          <div className="size-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
            <ShieldCheck className="size-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-slate-200 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              COD Policy
            </p>
            <p className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-1">Disabled</p>
            <p className="text-[11px] text-muted-foreground">Prepaid-only enforcement</p>
          </div>
          <div className="size-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <ShieldAlert className="size-5" />
          </div>
        </Card>
      </div>

      {/* Toolbar & Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-card rounded-xl border border-border">
        <div className="flex flex-1 items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search methods by name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <select
            aria-label="Filter by gateway"
            value={selectedGateway}
            onChange={(e) => setSelectedGateway(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-3 text-xs font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
          >
            <option value="all">All Gateways</option>
            <option value="razorpay">Razorpay</option>
            <option value="paypal">PayPal</option>
            <option value="internal">Internal</option>
          </select>

          <select
            aria-label="Filter by status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-3 text-xs font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="disabled">Disabled Only</option>
          </select>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-9 gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          <Button size="sm" onClick={openCreateModal} className="h-9 gap-1.5 font-semibold">
            <Plus className="size-4" />
            <span>Add Payment Method</span>
          </Button>
        </div>
      </div>

      {/* Methods Table */}
      <Card className="overflow-hidden border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 w-12 text-center">Order</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Gateway</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Currencies & Countries</th>
                <th className="py-3 px-4">Limits</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="size-6 animate-spin mx-auto mb-2 text-primary" />
                    <span>Loading payment configurations...</span>
                  </td>
                </tr>
              ) : methods.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-muted-foreground">
                    <SlidersHorizontal className="size-8 mx-auto mb-2 text-muted-foreground/60" />
                    <p className="font-medium text-foreground">No payment methods found</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Try adjusting your filters or click &apos;Add Payment Method&apos; to register one.
                    </p>
                  </td>
                </tr>
              ) : (
                methods.map((method, idx) => {
                  const IconComp = ICON_MAP[method.icon] || CreditCard;
                  const gatewayClass = GATEWAY_COLORS[method.gateway] || "bg-muted text-muted-foreground";

                  return (
                    <tr
                      key={method._id}
                      className="hover:bg-muted/20 transition-colors group"
                    >
                      {/* Order Controls */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMove(idx, "up")}
                            title="Move Up"
                            className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                          >
                            <ArrowUp className="size-3.5" />
                          </button>
                          <span className="font-bold text-[11px] text-muted-foreground">
                            {method.displayOrder || idx + 1}
                          </span>
                          <button
                            type="button"
                            disabled={idx === methods.length - 1}
                            onClick={() => handleMove(idx, "down")}
                            title="Move Down"
                            className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                          >
                            <ArrowDown className="size-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Name & Code */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <IconComp className="size-4" />
                          </div>
                          <div>
                            <span className="font-semibold text-foreground text-sm">
                              {method.name}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <code className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                {method.code}
                              </code>
                              {method.code === "cod" && (
                                <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-300">
                                  Policy: Prepaid Only
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Gateway Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${gatewayClass}`}
                        >
                          {method.gateway}
                        </span>
                      </td>

                      {/* Type */}
                      <td className="py-3.5 px-4">
                        <span className="text-muted-foreground uppercase text-[11px] font-medium tracking-wider">
                          {method.type}
                        </span>
                      </td>

                      {/* Currencies & Countries */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap gap-1">
                            {(method.supportedCurrencies || ["INR"]).map((cur) => (
                              <span
                                key={cur}
                                className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-semibold font-mono text-foreground"
                              >
                                {cur}
                              </span>
                            ))}
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            Countries: {(method.supportedCountries || ["IN"]).join(", ")}
                          </span>
                        </div>
                      </td>

                      {/* Limits */}
                      <td className="py-3.5 px-4 text-muted-foreground">
                        <div>Min: ₹{method.minimumOrderAmount?.toString?.() || "0"}</div>
                        <div>
                          Max: {method.maximumOrderAmount ? `₹${method.maximumOrderAmount}` : "No limit"}
                        </div>
                      </td>

                      {/* Status Switch */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Switch
                            checked={Boolean(method.enabled)}
                            onCheckedChange={() => handleToggle(method)}
                            aria-label={`Toggle ${method.name}`}
                          />
                          <span
                            className={`text-[10px] font-bold ${
                              method.enabled
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-muted-foreground"
                            }`}
                          >
                            {method.enabled ? "Active" : "Disabled"}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(method)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            title="Edit Configuration"
                          >
                            <Edit2 className="size-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setMethodToDelete(method);
                              setIsDeleteOpen(true);
                            }}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            title="Archive Payment Method"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add / Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleModalSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingMethod ? `Edit '${editingMethod.name}'` : "Add Payment Method"}
              </DialogTitle>
              <DialogDescription>
                Configure gateway bindings, supported currencies, and storefront presentation.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-xs">
              {/* Method Name & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    Display Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. UPI, Net Banking"
                    value={modalFormData.name}
                    onChange={(e) =>
                      setModalFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="h-9"
                  />
                  {formErrors.name && (
                    <p className="text-[11px] text-destructive">{formErrors.name}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    Internal Code <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. upi_custom, axis_netbanking"
                    value={modalFormData.code}
                    disabled={Boolean(editingMethod)}
                    onChange={(e) =>
                      setModalFormData((prev) => ({
                        ...prev,
                        code: e.target.value.toLowerCase().replace(/\s+/g, "_"),
                      }))
                    }
                    className="h-9 font-mono"
                  />
                  {formErrors.code && (
                    <p className="text-[11px] text-destructive">{formErrors.code}</p>
                  )}
                </div>
              </div>

              {/* Gateway & Type Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Gateway Provider</label>
                  <select
                    value={modalFormData.gateway}
                    onChange={(e) =>
                      setModalFormData((prev) => ({ ...prev, gateway: e.target.value }))
                    }
                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                  >
                    <option value="razorpay">Razorpay (Cards, UPI, Netbanking, Wallets)</option>
                    <option value="paypal">PayPal REST v2 (International & Cards)</option>
                    <option value="internal">Internal (COD)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Payment Type</label>
                  <select
                    value={modalFormData.type}
                    onChange={(e) =>
                      setModalFormData((prev) => ({ ...prev, type: e.target.value }))
                    }
                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                  >
                    <option value="upi">UPI (Instant VPA)</option>
                    <option value="card">Credit / Debit Card</option>
                    <option value="netbanking">Net Banking</option>
                    <option value="wallet">Digital Wallet</option>
                    <option value="international_card">International Card</option>
                    <option value="paypal">PayPal Account</option>
                    <option value="cod">Cash on Delivery</option>
                    <option value="emi">EMI / Installments</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Customer Storefront Description</label>
                <textarea
                  rows={2}
                  placeholder="Short, helpful summary shown to customers during checkout..."
                  value={modalFormData.description}
                  onChange={(e) =>
                    setModalFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="w-full rounded-lg border border-input bg-background p-2.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Icon & Display Order */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Icon Symbol</label>
                  <select
                    value={modalFormData.icon}
                    onChange={(e) =>
                      setModalFormData((prev) => ({ ...prev, icon: e.target.value }))
                    }
                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                  >
                    <option value="Zap">Zap (UPI / Instant)</option>
                    <option value="CreditCard">CreditCard (Cards)</option>
                    <option value="Building2">Building2 (Banks)</option>
                    <option value="Wallet">Wallet (Wallets)</option>
                    <option value="Globe">Globe (International)</option>
                    <option value="Banknote">Banknote (Cash)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Display Sort Order</label>
                  <Input
                    type="number"
                    min="1"
                    value={modalFormData.displayOrder}
                    onChange={(e) =>
                      setModalFormData((prev) => ({ ...prev, displayOrder: e.target.value }))
                    }
                    className="h-9"
                  />
                </div>
              </div>

              {/* Supported Countries & Currencies */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    Supported Countries (comma-separated)
                  </label>
                  <Input
                    type="text"
                    placeholder="IN, ALL, US, GB"
                    value={modalFormData.supportedCountries}
                    onChange={(e) =>
                      setModalFormData((prev) => ({
                        ...prev,
                        supportedCountries: e.target.value,
                      }))
                    }
                    className="h-9"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    Supported Currencies (comma-separated)
                  </label>
                  <Input
                    type="text"
                    placeholder="INR, USD, EUR"
                    value={modalFormData.supportedCurrencies}
                    onChange={(e) =>
                      setModalFormData((prev) => ({
                        ...prev,
                        supportedCurrencies: e.target.value,
                      }))
                    }
                    className="h-9"
                  />
                </div>
              </div>

              {/* Min and Max Order Amounts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Minimum Order Amount (₹)</label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={modalFormData.minimumOrderAmount}
                    onChange={(e) =>
                      setModalFormData((prev) => ({
                        ...prev,
                        minimumOrderAmount: e.target.value,
                      }))
                    }
                    className="h-9"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    Maximum Order Amount (₹, optional)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="No limit"
                    value={modalFormData.maximumOrderAmount}
                    onChange={(e) =>
                      setModalFormData((prev) => ({
                        ...prev,
                        maximumOrderAmount: e.target.value,
                      }))
                    }
                    className="h-9"
                  />
                </div>
              </div>

              {/* Secret Masking Security Notice */}
              <div className="p-3 rounded-lg bg-muted/60 border border-border text-[11px] text-muted-foreground flex items-start gap-2.5">
                <ShieldCheck className="size-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground">Security &amp; Secret Isolation: </span>
                  Server credentials (<code className="font-mono">RAZORPAY_KEY_SECRET</code>, <code className="font-mono">PAYPAL_CLIENT_SECRET</code>)
                  are strictly managed on the server backend via environment variables. Sensitive keys are never transmitted or stored in the browser.
                </div>
              </div>

              {/* Enabled Checkbox */}
              <div className="flex items-center gap-2 pt-2">
                <Switch
                  checked={modalFormData.enabled}
                  onCheckedChange={(val) =>
                    setModalFormData((prev) => ({ ...prev, enabled: val }))
                  }
                  id="enabled-toggle"
                />
                <label htmlFor="enabled-toggle" className="font-semibold text-foreground cursor-pointer">
                  Activate this payment method immediately on storefront checkout
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" isLoading={isSubmitting}>
                {editingMethod ? "Save Changes" : "Create Payment Method"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete / Archive Confirm Dialog */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        isLoading={isDeleting}
        title={`Archive Payment Method '${methodToDelete?.name || ""}'?`}
        description="Archiving this payment method will deactivate and hide it from storefront customer checkouts. Historical orders, receipts, and payment transaction audit records will NOT be deleted or altered."
        confirmLabel="Archive Method"
        variant="destructive"
      />
    </div>
  );
}

export default AdminPaymentMethodsView;
