"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  Plus,
  RefreshCw,
  Search,
  CheckCircle,
  Truck,
  Package,
  AlertTriangle,
  XCircle,
  Clock,
  Warehouse,
  ChevronRight,
  Filter,
} from "lucide-react";
import { adminInventoryService } from "@/services/admin/admin.service.js";
import { toast } from "sonner";

export default function AdminInventoryTransfersPage() {
  const [transfers, setTransfers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);

  // Form states
  const [submitting, setSubmitting] = useState(false);
  const [sourceWarehouseId, setSourceWarehouseId] = useState("");
  const [destWarehouseId, setDestWarehouseId] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferItems, setTransferItems] = useState([
    { productVariantId: "", quantityRequested: 1 },
  ]);

  // Receive form
  const [receiveInputs, setReceiveInputs] = useState({});

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [transfersRes, whRes] = await Promise.all([
        adminInventoryService.listTransfers({
          status: statusFilter !== "all" ? statusFilter : undefined,
          limit: 50,
        }),
        adminInventoryService.listWarehouses(),
      ]);

      const tList = transfersRes?.items || transfersRes?.transfers || transfersRes || [];
      const wList = whRes?.warehouses || whRes?.items || whRes || [];
      setTransfers(Array.isArray(tList) ? tList : []);
      setWarehouses(Array.isArray(wList) ? wList : []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load transfers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleCreateTransfer = async (e) => {
    e.preventDefault();
    if (!sourceWarehouseId || !destWarehouseId) {
      toast.error("Please select both source and destination warehouses.");
      return;
    }
    if (sourceWarehouseId === destWarehouseId) {
      toast.error("Source and destination warehouses cannot be the same.");
      return;
    }
    const validItems = transferItems.filter(
      (item) => item.productVariantId.trim() && Number(item.quantityRequested) > 0
    );
    if (validItems.length === 0) {
      toast.error("Please add at least one valid item with a positive quantity.");
      return;
    }

    setSubmitting(true);
    try {
      await adminInventoryService.createTransfer({
        sourceWarehouseId,
        destinationWarehouseId: destWarehouseId,
        items: validItems.map((item) => ({
          productVariantId: item.productVariantId.trim(),
          quantityRequested: Number(item.quantityRequested),
        })),
        reason: transferReason || "Operational rebalance",
      });
      toast.success("Stock transfer draft created successfully.");
      setCreateModalOpen(false);
      setTransferItems([{ productVariantId: "", quantityRequested: 1 }]);
      setTransferReason("");
      fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to create transfer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await adminInventoryService.approveTransfer(id);
      toast.success("Transfer approved.");
      fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to approve transfer");
    }
  };

  const handleDispatch = async (e) => {
    e.preventDefault();
    if (!selectedTransfer) return;
    setSubmitting(true);
    try {
      await adminInventoryService.dispatchTransfer(selectedTransfer._id, {
        carrier: carrier.trim(),
        trackingNumber: trackingNumber.trim(),
      });
      toast.success("Transfer dispatched. Source stock is now in transit.");
      setDispatchModalOpen(false);
      setSelectedTransfer(null);
      setCarrier("");
      setTrackingNumber("");
      fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to dispatch transfer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceive = async (e) => {
    e.preventDefault();
    if (!selectedTransfer) return;
    setSubmitting(true);
    try {
      const receivedItems = selectedTransfer.items.map((item) => {
        const receivedQty = Number(receiveInputs[item.productVariantId?._id || item.productVariantId] ?? item.quantityDispatched);
        return {
          productVariantId: item.productVariantId?._id || item.productVariantId,
          quantityReceived: Math.max(0, receivedQty),
          discrepancyReason: receivedQty < item.quantityDispatched ? "Shortage or damage reported" : undefined,
        };
      });

      await adminInventoryService.receiveTransfer(selectedTransfer._id, {
        receivedItems,
      });
      toast.success("Stock received and destination inventory updated.");
      setReceiveModalOpen(false);
      setSelectedTransfer(null);
      setReceiveInputs({});
      fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to receive transfer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id) => {
    if (!confirm("Are you sure you want to cancel this transfer?")) return;
    try {
      await adminInventoryService.cancelTransfer(id, { reason: "Cancelled by staff" });
      toast.success("Transfer cancelled.");
      fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to cancel transfer");
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "draft":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20"><Clock className="w-3 h-3" /> Draft</span>;
      case "approved":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20"><CheckCircle className="w-3 h-3" /> Approved</span>;
      case "dispatched":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"><Truck className="w-3 h-3" /> In Transit</span>;
      case "partially_received":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20"><AlertTriangle className="w-3 h-3" /> Partial</span>;
      case "received":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle className="w-3 h-3" /> Received</span>;
      case "cancelled":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20"><XCircle className="w-3 h-3" /> Cancelled</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300">{status}</span>;
    }
  };

  const filteredTransfers = transfers.filter((t) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    const tNum = t.transferNumber?.toLowerCase() || "";
    const sWh = t.sourceWarehouseId?.name?.toLowerCase() || "";
    const dWh = t.destinationWarehouseId?.name?.toLowerCase() || "";
    return tNum.includes(s) || sWh.includes(s) || dWh.includes(s);
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <ArrowLeftRight className="w-6 h-6 text-indigo-400" />
            Inter-Warehouse Transfers
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Dispatch, track in-transit stock, and safely receive transfers with authoritative ledger reconciliation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors border border-zinc-700"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            New Transfer
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-zinc-900/50 p-3 rounded-xl border border-zinc-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search transfer #, source, or destination..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="approved">Approved</option>
            <option value="dispatched">In Transit</option>
            <option value="partially_received">Partially Received</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Transfers Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-zinc-950/60 text-xs uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4">Transfer Number</th>
                <th className="px-6 py-4">Route</th>
                <th className="px-6 py-4">Items / Qty</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Logistics</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-medium">
              {loading && transfers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-zinc-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading stock transfers...
                  </td>
                </tr>
              ) : filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-zinc-500">
                    No warehouse transfers found.
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((t) => {
                  const totalRequested = (t.items || []).reduce((acc, i) => acc + (i.quantityRequested || 0), 0);
                  const totalDispatched = (t.items || []).reduce((acc, i) => acc + (i.quantityDispatched || 0), 0);
                  const totalReceived = (t.items || []).reduce((acc, i) => acc + (i.quantityReceived || 0), 0);

                  return (
                    <tr key={t._id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-white">
                        {t.transferNumber}
                        <div className="text-[11px] text-zinc-500 mt-0.5">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-zinc-200">
                          <span className="font-semibold">{t.sourceWarehouseId?.name || "Source"}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                          <span className="font-semibold">{t.destinationWarehouseId?.name || "Destination"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <div>{t.items?.length || 0} variant(s)</div>
                        <div className="text-zinc-500 text-[11px]">
                          Req: {totalRequested} | Disp: {totalDispatched} | Rec: {totalReceived}
                        </div>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(t.status)}</td>
                      <td className="px-6 py-4 text-xs text-zinc-400">
                        {t.carrier ? (
                          <div>
                            <span className="text-zinc-300 font-medium">{t.carrier}</span>
                            {t.trackingNumber && <div className="text-[11px] font-mono text-zinc-500">{t.trackingNumber}</div>}
                          </div>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {t.status === "draft" && (
                            <>
                              <button
                                onClick={() => handleApprove(t._id)}
                                className="px-2.5 py-1 text-xs rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleCancel(t._id)}
                                className="px-2.5 py-1 text-xs rounded bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 transition-colors"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {t.status === "approved" && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedTransfer(t);
                                  setDispatchModalOpen(true);
                                }}
                                className="px-2.5 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                              >
                                Dispatch
                              </button>
                              <button
                                onClick={() => handleCancel(t._id)}
                                className="px-2.5 py-1 text-xs rounded bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 transition-colors"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {(t.status === "dispatched" || t.status === "partially_received") && (
                            <button
                              onClick={() => {
                                setSelectedTransfer(t);
                                const initialInputs = {};
                                (t.items || []).forEach((item) => {
                                  initialInputs[item.productVariantId?._id || item.productVariantId] = item.quantityDispatched - item.quantityReceived;
                                });
                                setReceiveInputs(initialInputs);
                                setReceiveModalOpen(true);
                              }}
                              className="px-2.5 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                            >
                              Receive Stock
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create Transfer */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-indigo-400" />
              New Stock Transfer
            </h2>
            <form onSubmit={handleCreateTransfer} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-400">Source Warehouse</label>
                  <select
                    value={sourceWarehouseId}
                    onChange={(e) => setSourceWarehouseId(e.target.value)}
                    required
                    className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white"
                  >
                    <option value="">Select source...</option>
                    {warehouses.map((w) => (
                      <option key={w._id} value={w._id}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-400">Destination Warehouse</label>
                  <select
                    value={destWarehouseId}
                    onChange={(e) => setDestWarehouseId(e.target.value)}
                    required
                    className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white"
                  >
                    <option value="">Select destination...</option>
                    {warehouses.map((w) => (
                      <option key={w._id} value={w._id}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400">Reason</label>
                <input
                  type="text"
                  placeholder="e.g., Regional fulfillment rebalance"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-400">Items to Transfer</label>
                  <button
                    type="button"
                    onClick={() => setTransferItems([...transferItems, { productVariantId: "", quantityRequested: 1 }])}
                    className="text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    + Add item
                  </button>
                </div>
                {transferItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Product Variant ID"
                      value={item.productVariantId}
                      onChange={(e) => {
                        const copy = [...transferItems];
                        copy[idx].productVariantId = e.target.value;
                        setTransferItems(copy);
                      }}
                      required
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-white"
                    />
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={item.quantityRequested}
                      onChange={(e) => {
                        const copy = [...transferItems];
                        copy[idx].quantityRequested = Number(e.target.value);
                        setTransferItems(copy);
                      }}
                      required
                      className="w-24 bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-white"
                    />
                    {transferItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setTransferItems(transferItems.filter((_, i) => i !== idx))}
                        className="text-zinc-500 hover:text-rose-400 px-2"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20"
                >
                  {submitting ? "Creating..." : "Create Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Dispatch Transfer */}
      {dispatchModalOpen && selectedTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-indigo-400" />
              Dispatch Transfer {selectedTransfer.transferNumber}
            </h2>
            <p className="text-xs text-zinc-400">
              Dispatching will deduct stock from the source warehouse and mark it as in transit.
            </p>
            <form onSubmit={handleDispatch} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-400">Carrier / Logistics Provider</label>
                <input
                  type="text"
                  placeholder="e.g., FedEx, BlueDart, Internal Fleet"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-400">Tracking Number</label>
                <input
                  type="text"
                  placeholder="e.g., FDX-98234710"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setDispatchModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white"
                >
                  {submitting ? "Dispatching..." : "Confirm Dispatch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Receive Stock */}
      {receiveModalOpen && selectedTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-400" />
              Receive Transfer {selectedTransfer.transferNumber}
            </h2>
            <p className="text-xs text-zinc-400">
              Verify actual quantities received. Discrepancies and shortages will be logged.
            </p>
            <form onSubmit={handleReceive} className="space-y-4">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {selectedTransfer.items.map((item, idx) => {
                  const vId = item.productVariantId?._id || item.productVariantId;
                  const dispatchedQty = item.quantityDispatched || item.quantityRequested;
                  const alreadyReceived = item.quantityReceived || 0;
                  const remaining = Math.max(0, dispatchedQty - alreadyReceived);

                  return (
                    <div key={idx} className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-mono text-zinc-300">{item.productVariantId?.sku || String(vId).slice(-8)}</div>
                        <div className="text-[11px] text-zinc-500">Dispatched: {dispatchedQty} | Received: {alreadyReceived}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-zinc-400">Receiving:</label>
                        <input
                          type="number"
                          min="0"
                          max={remaining}
                          value={receiveInputs[vId] ?? remaining}
                          onChange={(e) => setReceiveInputs({ ...receiveInputs, [vId]: Number(e.target.value) })}
                          className="w-20 bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-white text-right"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setReceiveModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white"
                >
                  {submitting ? "Receiving..." : "Confirm Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
