"use client";

import React, { useState } from "react";
import { CreditCard, History, ShieldCheck } from "lucide-react";
import { PageHeader } from "../../../components/admin/PageHeader.jsx";
import { AdminPaymentMethodsView } from "../../../components/admin/payments/AdminPaymentMethodsView.jsx";
import { AdminPaymentTransactionsView } from "../../../components/admin/payments/AdminPaymentTransactionsView.jsx";

export default function AdminPaymentsPage() {
  const [activeTab, setActiveTab] = useState("methods");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Systems"
        description="Configure active customer payment methods, manage gateway integrations, supported currencies, and review financial transaction audit logs."
        actions={
          <div className="flex items-center gap-1.5 p-1 bg-muted rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setActiveTab("methods")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "methods"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CreditCard className="size-3.5" />
              <span>Payment Methods</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("transactions")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "transactions"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <History className="size-3.5" />
              <span>Transaction Audit</span>
            </button>
          </div>
        }
      />

      {activeTab === "methods" ? (
        <AdminPaymentMethodsView />
      ) : (
        <AdminPaymentTransactionsView />
      )}
    </div>
  );
}
