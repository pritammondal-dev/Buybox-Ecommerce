"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Landmark,
  Search,
  Plus,
  RefreshCw,
  Building,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Edit2,
  ShieldCheck,
  ShieldAlert,
  Globe2,
  FileText,
  ChevronRight,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { adminPartnerBankService } from "../../../services/admin/partner-bank.service.js";
import { useAdminAuthStore } from "../../../stores/admin-auth.store.js";
import { ReasonConfirmModal } from "../../../components/admin/ReasonConfirmModal.jsx";
import { SUPPORTED_COUNTRIES, INDIAN_STATES } from "../../../constants/bank-geo.constants.js";
import { Button } from "../../../components/ui/Button.jsx";

export default function AdminPartnerBanksPage() {
  const hasPermission = useAdminAuthStore((state) => state.hasPermission);
  const canManage = hasPermission("partner_banks.manage") || hasPermission("vendors.manage");

  const [banks, setBanks] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editBank, setEditBank] = useState(null);
  const [toggleStatusTarget, setToggleStatusTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState(null);

  const fetchBanks = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 15,
        search: search.trim() || undefined,
        country: countryFilter !== "all" ? countryFilter : undefined,
        isActive: statusFilter === "active" ? "true" : statusFilter === "inactive" ? "false" : undefined,
      };

      const res = await adminPartnerBankService.listPartnerBanks(params);
      setBanks(res.items || []);
      setTotal(res.meta?.total || 0);
      setTotalPages(res.meta?.totalPages || 1);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to load partner banks");
    } finally {
      setLoading(false);
    }
  }, [page, search, countryFilter, statusFilter]);

  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchBanks();
  };

  // Toggle bank status confirm
  const handleToggleStatusConfirm = async (reasonArg) => {
    if (!toggleStatusTarget) return;
    setActionLoading(true);
    setModalError(null);
    try {
      const reason = typeof reasonArg === "object" && reasonArg !== null ? reasonArg.reason : reasonArg;
      const { bank, targetEligible } = toggleStatusTarget;
      await adminPartnerBankService.togglePartnerBankStatus(bank.id || bank._id, {
        isEligibleForNewApplications: targetEligible,
        reason,
      });

      toast.success(
        targetEligible
          ? `${bank.name} enabled for new vendor applications`
          : `${bank.name} disabled for new applications`
      );
      setToggleStatusTarget(null);
      await fetchBanks();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Failed to update bank status";
      setModalError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 tracking-wider uppercase mb-1">
            <Landmark className="size-3.5" />
            Institutional Banking Directory
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Partner Bank Catalogue</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage verified banking institutions eligible for vendor payout settlements and account applications.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchBanks}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          {canManage && (
            <Button
              size="sm"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="size-4" />
              Add Partner Bank
            </Button>
          )}
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96 flex items-center">
          <Search className="size-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bank name, code, or alias..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
          />
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Country Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 whitespace-nowrap">Country:</span>
            <select
              value={countryFilter}
              onChange={(e) => {
                setCountryFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            >
              <option value="all">All Countries</option>
              {SUPPORTED_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 whitespace-nowrap">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Bank Name & Aliases</th>
                <th className="py-3 px-4">Identifier Code</th>
                <th className="py-3 px-4">Jurisdiction & Routing</th>
                <th className="py-3 px-4">Directory Status</th>
                <th className="py-3 px-4">Application Eligibility</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="size-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    Loading partner directory...
                  </td>
                </tr>
              )}

              {!loading && banks.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Landmark className="size-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-medium text-slate-700 text-sm">No partner banks found</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting your search criteria or register a new bank.</p>
                  </td>
                </tr>
              )}

              {!loading &&
                banks.map((bank) => {
                  const bankId = bank.id || bank._id;
                  const isEligible = bank.isEligibleForNewApplications;
                  const isActive = bank.isActive;

                  return (
                    <tr key={bankId} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name & Aliases */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-200">
                            {bank.code?.slice(0, 2) || "BK"}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 text-xs">{bank.name}</div>
                            {bank.aliases && bank.aliases.length > 0 && (
                              <div className="text-[10px] text-slate-400 truncate max-w-xs mt-0.5">
                                Aliases: {bank.aliases.join(", ")}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Code */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        <span className="px-2 py-1 rounded bg-slate-100 border border-slate-200 text-xs">
                          {bank.code}
                        </span>
                      </td>

                      {/* Jurisdiction & Routing */}
                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="flex items-center gap-1.5 font-medium">
                          <Globe2 className="size-3 text-slate-400" />
                          <span>{bank.countries?.join(", ") || "IN"}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {bank.routingSystem || "IFSC"} {bank.ifscPrefix ? `(Prefix: ${bank.ifscPrefix})` : ""}
                        </div>
                      </td>

                      {/* Directory Status */}
                      <td className="py-3.5 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="size-3 text-emerald-600" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            <XCircle className="size-3 text-slate-400" /> Inactive
                          </span>
                        )}
                      </td>

                      {/* Application Eligibility */}
                      <td className="py-3.5 px-4">
                        {isEligible ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            <ShieldCheck className="size-3 text-blue-600" /> Eligible for Vendors
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <ShieldAlert className="size-3 text-amber-600" /> Disabled for New
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {canManage && (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditBank(bank)}
                              className="text-xs text-slate-600 hover:text-slate-900"
                              title="Edit metadata"
                            >
                              <Edit2 className="size-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setToggleStatusTarget({
                                  bank,
                                  targetEligible: !isEligible,
                                })
                              }
                              className={`text-xs ${
                                isEligible
                                  ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                  : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              }`}
                            >
                              {isEligible ? "Disable" : "Enable"}
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>
              Showing {banks.length} of {total} partner banks
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <span className="px-2 font-medium">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add Partner Bank Modal */}
      {showAddModal && (
        <BankFormModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchBanks();
          }}
        />
      )}

      {/* Edit Partner Bank Modal */}
      {editBank && (
        <BankFormModal
          isOpen={!!editBank}
          bank={editBank}
          onClose={() => setEditBank(null)}
          onSuccess={() => {
            setEditBank(null);
            fetchBanks();
          }}
        />
      )}

      {/* Toggle Status Confirmation Modal */}
      <ReasonConfirmModal
        isOpen={!!toggleStatusTarget}
        onClose={() => {
          setToggleStatusTarget(null);
          setModalError(null);
        }}
        onConfirm={handleToggleStatusConfirm}
        title={
          toggleStatusTarget?.targetEligible
            ? "Enable Partner Bank for Applications"
            : "Disable Partner Bank for Applications"
        }
        description={
          toggleStatusTarget?.targetEligible
            ? "Enabling this bank will allow marketplace vendors to search and select it when submitting new bank accounts."
            : "Disabling this bank will prevent vendors from submitting new accounts with it. Note: Existing vendor bank accounts, historical settlements, and payout snapshots will remain completely intact."
        }
        targetIdentity={toggleStatusTarget?.bank?.name || ""}
        actionType={toggleStatusTarget?.targetEligible ? "reactivate" : "deactivate"}
        isDestructive={!toggleStatusTarget?.targetEligible}
        confirmLabel={toggleStatusTarget?.targetEligible ? "Enable Bank" : "Disable Bank"}
        isLoading={actionLoading}
        errorMessage={modalError}
        minChars={10}
        maxChars={500}
        placeholder="State the operational reason for this status change (e.g. Bank merger, API downtime, partner review)..."
      />
    </div>
  );
}

/**
 * Add / Edit Partner Bank Modal
 */
function BankFormModal({ isOpen, bank = null, onClose, onSuccess }) {
  const isEdit = Boolean(bank);
  const [name, setName] = useState(bank?.name || "");
  const [code, setCode] = useState(bank?.code || "");
  const [aliases, setAliases] = useState(bank?.aliases?.join(", ") || "");
  const [country, setCountry] = useState(bank?.countries?.[0] || "IN");
  const [routingSystem, setRoutingSystem] = useState(bank?.routingSystem || "IFSC");
  const [ifscPrefix, setIfscPrefix] = useState(bank?.ifscPrefix || "");
  const [isActive, setIsActive] = useState(bank?.isActive !== undefined ? bank.isActive : true);
  const [isEligible, setIsEligible] = useState(
    bank?.isEligibleForNewApplications !== undefined ? bank.isEligibleForNewApplications : true
  );

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!name.trim()) errs.name = "Bank name is required";
    if (!code.trim()) errs.code = "Bank code is required";
    else if (!/^[A-Za-z0-9]+$/.test(code.trim())) errs.code = "Code must be alphanumeric";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        aliases: aliases
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        countries: [country],
        routingSystem,
        ifscPrefix: ifscPrefix.trim() ? ifscPrefix.trim().toUpperCase() : null,
        isActive,
        isEligibleForNewApplications: isEligible,
      };

      if (isEdit) {
        await adminPartnerBankService.updatePartnerBank(bank.id || bank._id, payload);
        toast.success("Partner bank updated successfully");
      } else {
        await adminPartnerBankService.createPartnerBank(payload);
        toast.success("Partner bank registered successfully");
      }
      onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to save partner bank");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-100">
              <Landmark className="size-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              {isEdit ? "Edit Partner Bank" : "Register Partner Bank"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Canonical Bank Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. State Bank of India"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
            {errors.name && <p className="text-[11px] text-rose-500 mt-1">{errors.name}</p>}
          </div>

          {/* Code */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bank Code / ID <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. SBIN"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 uppercase font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
              {errors.code && <p className="text-[11px] text-rose-500 mt-1">{errors.code}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Country <span className="text-rose-500">*</span>
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white"
              >
                {SUPPORTED_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Routing & Prefix */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Routing System
              </label>
              <select
                value={routingSystem}
                onChange={(e) => setRoutingSystem(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white"
              >
                <option value="IFSC">IFSC (India)</option>
                <option value="SWIFT">SWIFT / BIC</option>
                <option value="ROUTING_NUMBER">ABA Routing Number (US)</option>
                <option value="IBAN">IBAN</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                IFSC Prefix (Optional)
              </label>
              <input
                type="text"
                value={ifscPrefix}
                onChange={(e) => setIfscPrefix(e.target.value.toUpperCase())}
                placeholder="e.g. SBIN"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 uppercase font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
          </div>

          {/* Aliases */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Searchable Aliases (Comma-separated)
            </label>
            <input
              type="text"
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
              placeholder="e.g. SBI, State Bank, State Bank of India Ltd"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Merchants can find this bank using any of these aliases in the account application form.
            </p>
          </div>

          {/* Checkboxes */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Active in Directory
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={isEligible}
                onChange={(e) => setIsEligible(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Eligible for Applications
            </label>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {loading ? "Saving..." : isEdit ? "Update Bank" : "Create Bank"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

