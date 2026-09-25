"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  SlidersHorizontal,
  CreditCard,
  Receipt,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { Button } from "../../ui/Button.jsx";
import { Card } from "../../ui/Card.jsx";
import { paymentMethodService } from "../../../services/payment-method.service.js";

const STATUS_CONFIG = {
  captured: {
    label: "Captured",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40",
    icon: CheckCircle2,
  },
  pending: {
    label: "Pending",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/40",
    icon: Clock,
  },
  created: {
    label: "Created",
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/40",
    icon: Clock,
  },
  failed: {
    label: "Failed",
    color: "bg-destructive/10 text-destructive border-destructive/20",
    icon: AlertCircle,
  },
  refunded: {
    label: "Refunded",
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900/40",
    icon: RotateCcw,
  },
  partially_refunded: {
    label: "Partially Refunded",
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900/40",
    icon: RotateCcw,
  },
};

export function AdminPaymentTransactionsView() {
  const [transactions, setTransactions] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 15, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [selectedGateway, setSelectedGateway] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      try {
        const res = await paymentMethodService.listTransactions({
          page: currentPage,
          limit: 15,
          gateway: selectedGateway !== "all" ? selectedGateway : undefined,
          status: selectedStatus !== "all" ? selectedStatus : undefined,
        });

        if (!isCancelled) {
          setTransactions(res.data || []);
          if (res.meta) {
            setMeta(res.meta);
          }
          setError(null);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.response?.data?.message || err.message || "Failed to load payment transactions");
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
  }, [currentPage, selectedGateway, selectedStatus, refreshTrigger]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* Alert Notices */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm font-medium">
          <AlertCircle className="size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Toolbar & Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-card rounded-xl border border-border">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-muted-foreground">Gateway:</label>
            <select
              aria-label="Filter transactions by gateway"
              value={selectedGateway}
              onChange={(e) => {
                setSelectedGateway(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 rounded-lg border border-input bg-background px-3 text-xs font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
            >
              <option value="all">All Gateways</option>
              <option value="razorpay">Razorpay</option>
              <option value="paypal">PayPal</option>
              <option value="internal">Internal</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-muted-foreground">Status:</label>
            <select
              aria-label="Filter transactions by status"
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 rounded-lg border border-input bg-background px-3 text-xs font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
            >
              <option value="all">All Statuses</option>
              <option value="captured">Captured (Paid)</option>
              <option value="created">Created</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
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
        </div>
      </div>

      {/* Transactions Table */}
      <Card className="overflow-hidden border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Payment ID / Receipt</th>
                <th className="py-3 px-4">Order Number</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Gateway</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="size-6 animate-spin mx-auto mb-2 text-primary" />
                    <span>Loading payment transaction records...</span>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-muted-foreground">
                    <SlidersHorizontal className="size-8 mx-auto mb-2 text-muted-foreground/60" />
                    <p className="font-medium text-foreground">No transactions found</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      No payment transaction records match your selected filters.
                    </p>
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const statusInfo = STATUS_CONFIG[tx.status] || {
                    label: tx.status,
                    color: "bg-muted text-muted-foreground border-border",
                    icon: Clock,
                  };
                  const StatusIcon = statusInfo.icon;

                  const orderId = tx.orderId?._id || tx.orderId;
                  const orderNumber = tx.orderId?.orderNumber || "View Order";

                  return (
                    <tr
                      key={tx._id}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      {/* ID / Receipt */}
                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        <div className="font-semibold text-foreground">
                          {tx.gatewayPaymentId ? (
                            <span>{tx.gatewayPaymentId}</span>
                          ) : (
                            <span className="text-muted-foreground">Tx: {tx._id.slice(-8)}</span>
                          )}
                        </div>
                        {tx.receipt && (
                          <div className="text-[10px] text-muted-foreground">
                            Receipt: {tx.receipt}
                          </div>
                        )}
                      </td>

                      {/* Order */}
                      <td className="py-3.5 px-4">
                        {orderId ? (
                          <Link
                            href={`/orders/${orderId}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                          >
                            <span>{orderNumber}</span>
                            <ExternalLink className="size-3" />
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        {tx.customerId ? (
                          <div>
                            <div className="font-medium text-foreground">
                              {tx.customerId.name || "Buybox Customer"}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {tx.customerId.email || tx.customerId.phone || ""}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Customer Profile</span>
                        )}
                      </td>

                      {/* Gateway */}
                      <td className="py-3.5 px-4">
                        <span className="font-semibold capitalize text-foreground">
                          {tx.gateway}
                        </span>
                      </td>

                      {/* Method */}
                      <td className="py-3.5 px-4">
                        <span className="text-muted-foreground uppercase text-[11px] font-medium tracking-wide">
                          {tx.method || "card/upi"}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-foreground">
                          ₹{Number(tx.amount?.toString() || 0).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                        {Number(tx.refundedAmount?.toString() || 0) > 0 && (
                          <div className="text-[10px] text-purple-600 dark:text-purple-400">
                            Refunded: ₹{tx.refundedAmount}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusInfo.color}`}
                        >
                          <StatusIcon className="size-3" />
                          <span>{statusInfo.label}</span>
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-right text-muted-foreground text-[11px]">
                        {tx.createdAt ? new Date(tx.createdAt).toLocaleString("en-IN") : "-"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
            <div className="text-xs text-muted-foreground">
              Showing page <span className="font-semibold text-foreground">{meta.page}</span> of{" "}
              <span className="font-semibold text-foreground">{meta.totalPages}</span> (
              {meta.total} total transactions)
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-8 text-xs"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= meta.totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="h-8 text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default AdminPaymentTransactionsView;
