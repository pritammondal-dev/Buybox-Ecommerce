"use client";

import React, { useState, useEffect } from "react";
import {
  Gift,
  Check,
  CreditCard,
  Plus,
  Search,
  Clock,
  ShieldCheck,
  Loader2,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { giftCardService } from "../../../../services/giftCard.service.js";
import { AccountNav } from "../../../../components/storefront/account/AccountNav.jsx";
import { formatCurrency } from "../../../../utils/formatCurrency.js";
import { Skeleton } from "../../../../components/ui/Skeleton.jsx";

export function GiftCardsPageView() {
  const [giftCards, setGiftCards] = useState([]);
  const [loading, setLoading] = useState(true);

  // Claim form
  const [claimCode, setClaimCode] = useState("");
  const [isClaiming, setIsClaiming] = useState(false);

  // Check balance tool
  const [checkCode, setCheckCode] = useState("");
  const [balanceResult, setBalanceResult] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  const loadCards = React.useCallback(async () => {
    try {
      const res = await giftCardService.getMyGiftCards();
      const list = Array.isArray(res?.data) ? res.data : res?.data?.giftCards || [];
      setGiftCards(list);
    } catch {
      setGiftCards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const res = await giftCardService.getMyGiftCards();
        if (!isMounted) return;
        const list = Array.isArray(res?.data) ? res.data : res?.data?.giftCards || [];
        setGiftCards(list);
      } catch {
        if (isMounted) setGiftCards([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleClaim = async (e) => {
    e.preventDefault();
    if (!claimCode.trim()) return;

    setIsClaiming(true);
    try {
      await giftCardService.claimGiftCard(claimCode.trim());
      toast.success("Gift card claimed successfully!");
      setClaimCode("");
      loadCards();
    } catch (err) {
      toast.error(err?.message || "Failed to claim gift card. Verify code.");
    } finally {
      setIsClaiming(false);
    }
  };

  const handleCheckBalance = async (e) => {
    e.preventDefault();
    if (!checkCode.trim()) return;

    setIsChecking(true);
    try {
      const res = await giftCardService.checkBalance(checkCode.trim());
      setBalanceResult(res?.data?.data || res?.data);
    } catch (err) {
      toast.error(err?.message || "Could not find gift card with that code.");
      setBalanceResult(null);
    } finally {
      setIsChecking(false);
    }
  };

  const totalBalance = giftCards.reduce(
    (acc, c) => acc + (Number(c.currentBalance || c.balance || 0)),
    0
  );

  return (
    <div className="min-h-screen bg-slate-50/50 py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4">
            <AccountNav />
          </div>

          <div className="lg:col-span-8 space-y-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-black text-slate-900">Gift Cards & Vouchers</h1>
              <p className="text-xs text-slate-500">
                Claim gift cards, check card balances, and store credits for future checkout deductions.
              </p>
            </div>

            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-40 w-full rounded-3xl" />
                <Skeleton className="h-56 w-full rounded-2xl" />
              </div>
            ) : (
              <>
                {/* Gift Card Wallet Banner */}
                <div className="rounded-3xl bg-gradient-to-r from-[#004D38] to-[#0A3D2F] p-8 text-white shadow-lg space-y-4">
                  <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider">
                    <Gift className="h-4 w-4" /> Buybox Gift Wallet
                  </div>
                  <div>
                    <p className="text-xs text-emerald-100">Total Available Balance</p>
                    <div className="text-4xl font-extrabold tracking-tight">
                      {formatCurrency(totalBalance)}
                    </div>
                  </div>
                  <p className="text-[11px] text-emerald-200/80">
                    {giftCards.length} active {giftCards.length === 1 ? "card" : "cards"} linked to your account.
                  </p>
                </div>

                {/* Claim & Check Balance Side-by-Side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Claim Card Form */}
                  <form
                    onSubmit={handleClaim}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3"
                  >
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Plus className="h-4 w-4 text-[#004D38]" /> Add a Gift Card
                    </h2>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Have a 16-digit gift card code? Add it to your wallet for instant checkout use.
                    </p>
                    <input
                      type="text"
                      value={claimCode}
                      onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
                      placeholder="e.g. BB-GIFT-9923-ABCD"
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-xs text-slate-800 uppercase outline-none focus:border-[#004D38]"
                    />
                    <button
                      type="submit"
                      disabled={isClaiming || !claimCode.trim()}
                      className="w-full rounded-xl bg-[#004D38] py-2 text-xs font-bold text-white hover:bg-[#003B2B] transition-colors disabled:opacity-50"
                    >
                      {isClaiming ? "Claiming..." : "Claim & Add to Account"}
                    </button>
                  </form>

                  {/* Check Balance Tool */}
                  <form
                    onSubmit={handleCheckBalance}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3"
                  >
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Search className="h-4 w-4 text-[#004D38]" /> Check Card Balance
                    </h2>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Verify the balance or validity of any unredeemed Buybox gift card.
                    </p>
                    <input
                      type="text"
                      value={checkCode}
                      onChange={(e) => setCheckCode(e.target.value.toUpperCase())}
                      placeholder="Enter Gift Card Code"
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-xs text-slate-800 uppercase outline-none focus:border-[#004D38]"
                    />
                    <button
                      type="submit"
                      disabled={isChecking || !checkCode.trim()}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
                    >
                      {isChecking ? "Checking..." : "Inspect Balance"}
                    </button>

                    {balanceResult && (
                      <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                        <div className="flex justify-between font-bold">
                          <span>Card Balance:</span>
                          <span>{formatCurrency(balanceResult.currentBalance || balanceResult.balance || 0)}</span>
                        </div>
                        <p className="text-[10px] text-emerald-700">
                          Status: {balanceResult.status || "Active"} • Valid
                        </p>
                      </div>
                    )}
                  </form>
                </div>

                {/* My Linked Cards List */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                  <h2 className="text-base font-bold text-slate-900">Your Linked Gift Cards</h2>

                  {giftCards.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400 italic">
                      No gift cards claimed yet. Claim a card code above to link it to your account.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {giftCards.map((card) => (
                        <div
                          key={card._id || card.code}
                          className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-slate-900">
                              •••• {card.code?.slice(-4) || "CARD"}
                            </span>
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              Active
                            </span>
                          </div>
                          <div className="text-xl font-extrabold text-slate-900">
                            {formatCurrency(card.currentBalance || card.balance || 0)}
                          </div>
                          {card.expiryDate && (
                            <p className="text-[10px] text-slate-400">
                              Valid until {new Date(card.expiryDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      ))}
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
