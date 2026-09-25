"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Award,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  ShoppingBag,
  HelpCircle,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { rewardService } from "../../../../services/reward.service.js";
import { AccountNav } from "../../../../components/storefront/account/AccountNav.jsx";
import { Skeleton } from "../../../../components/ui/Skeleton.jsx";
import { formatCurrency } from "../../../../utils/formatCurrency.js";

export function RewardsPageView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const res = await rewardService.getMyRewards();
        if (!isMounted) return;
        setData(res?.data?.data || res?.data);
      } catch {
        // Fallback default
        if (isMounted) setData({ account: { pointsBalance: 0, tier: "bronze" }, transactions: [] });
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const account = data?.account || { pointsBalance: 0, tier: "bronze" };
  const transactions = data?.transactions || [];

  const tierColors = {
    bronze: "bg-amber-100 text-amber-800 border-amber-300",
    silver: "bg-slate-200 text-slate-800 border-slate-300",
    gold: "bg-amber-300 text-amber-950 border-amber-400",
    platinum: "bg-emerald-100 text-emerald-900 border-emerald-300",
  };

  return (
    <div className="min-h-screen bg-slate-50/50 py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4">
            <AccountNav />
          </div>

          <div className="lg:col-span-8 space-y-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-black text-slate-900">Rewards & Loyalty Points</h1>
              <p className="text-xs text-slate-500">
                Earn points on verified audio purchases and redeem them for instant discounts at checkout.
              </p>
            </div>

            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-44 w-full rounded-3xl" />
                <Skeleton className="h-64 w-full rounded-2xl" />
              </div>
            ) : (
              <>
                {/* Rewards Balance Hero Banner */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#004D38] to-[#002B1F] p-8 text-white shadow-xl">
                  <div className="absolute -right-8 -top-8 h-48 w-48 rounded-full bg-emerald-400/10 blur-2xl" />
                  <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider border ${
                            tierColors[account.tier] || tierColors.bronze
                          }`}
                        >
                          <Award className="h-3.5 w-3.5" />
                          {account.tier || "Bronze"} Member
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-emerald-100">Available Points Balance</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl sm:text-5xl font-extrabold tracking-tight">
                          {(account.pointsBalance || 0).toLocaleString()}
                        </span>
                        <span className="text-sm text-emerald-200">Points</span>
                      </div>
                      <p className="text-xs text-emerald-200/90">
                        Equivalent to {formatCurrency(account.pointsBalance || 0)} discount on your next checkout.
                      </p>
                    </div>

                    <Link
                      href="/products"
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FFF8D6] px-5 py-3 text-xs font-bold text-[#004D38] shadow-sm hover:bg-amber-100 transition-colors shrink-0"
                    >
                      <ShoppingBag className="h-4 w-4" /> Shop to Earn Points
                    </Link>
                  </div>
                </div>

                {/* How to Earn & Redeem */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2 shadow-sm">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-[#004D38] font-black">
                      1x
                    </span>
                    <p className="font-bold text-slate-900">Earn with Purchases</p>
                    <p className="text-slate-500 text-[11px] leading-relaxed">
                      Earn 1 reward point for every ₹100 spent across all verified equipment.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2 shadow-sm">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-[#004D38] font-black">
                      50
                    </span>
                    <p className="font-bold text-slate-900">Verified Reviews</p>
                    <p className="text-slate-500 text-[11px] leading-relaxed">
                      Get 50 points when you submit a verified purchase review with audio impressions.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2 shadow-sm">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-[#004D38] font-black">
                      1:1
                    </span>
                    <p className="font-bold text-slate-900">Direct Checkout Credit</p>
                    <p className="text-slate-500 text-[11px] leading-relaxed">
                      Redeem accumulated points directly on your payment screen with 1 point = ₹1 value.
                    </p>
                  </div>
                </div>

                {/* Transaction Ledger */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                  <h2 className="text-base font-bold text-slate-900">Points History</h2>

                  {transactions.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400 italic">
                      No points transactions recorded yet. Complete your first order to start earning!
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {transactions.map((tx, idx) => {
                        const isEarned = tx.type === "earned" || tx.type === "credit";
                        return (
                          <div key={idx} className="flex items-center justify-between py-3 text-xs">
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                                  isEarned ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                                }`}
                              >
                                {isEarned ? (
                                  <ArrowDownLeft className="h-4 w-4" />
                                ) : (
                                  <ArrowUpRight className="h-4 w-4" />
                                )}
                              </div>
                              <div className="space-y-0.5">
                                <p className="font-bold text-slate-800">{tx.description || tx.type}</p>
                                <span className="text-[10px] text-slate-400">
                                  {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : ""}
                                </span>
                              </div>
                            </div>
                            <span
                              className={`font-mono font-bold text-sm ${
                                isEarned ? "text-emerald-700" : "text-amber-700"
                              }`}
                            >
                              {isEarned ? `+${tx.points}` : `-${tx.points}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
