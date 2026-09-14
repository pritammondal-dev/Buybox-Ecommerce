"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  User,
  ShieldCheck,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Bell,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../hooks/useAuth.js";
import { useAuthStore } from "../../../stores/auth.store.js";
import { customerService } from "../../../services/customer.service.js";
import { AccountNav } from "./AccountNav.jsx";
import { Skeleton } from "../../ui/Skeleton.jsx";

export function ProfilePageView() {
  const { user, customerProfile, isAuthenticated } = useAuth();
  const setCustomerProfileInStore = useAuthStore((state) => state.setCustomerProfile);

  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [marketingSms, setMarketingSms] = useState(false);
  const [marketingPush, setMarketingPush] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    let isMounted = true;
    customerService
      .getProfile()
      .then((res) => {
        if (!isMounted) return;
        const prof = res?.data?.customer || res?.data;
        if (prof) {
          setProfile(prof);
          setPhone(prof.phone || "");
          if (prof.dateOfBirth) {
            try {
              const d = new Date(prof.dateOfBirth);
              setDateOfBirth(d.toISOString().split("T")[0]);
            } catch {
              setDateOfBirth("");
            }
          }
          setGender(prof.gender || "");
          if (prof.preferences) {
            setMarketingEmails(Boolean(prof.preferences.marketingEmails));
            setMarketingSms(Boolean(prof.preferences.marketingSms));
            setMarketingPush(Boolean(prof.preferences.marketingPush));
          }
        }
      })
      .catch(() => {
        // Customer profile may not have been created yet
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    const payload = {};

    const trimmedPhone = phone.trim();
    if (trimmedPhone) {
      if (trimmedPhone.length < 7 || trimmedPhone.length > 20) {
        toast.error("Invalid Phone Number", {
          description: "Phone number must be between 7 and 20 digits.",
        });
        setIsSaving(false);
        return;
      }
      payload.phone = trimmedPhone;
    } else {
      payload.phone = null;
    }

    if (dateOfBirth) {
      try {
        const isoDate = new Date(dateOfBirth + "T00:00:00.000Z").toISOString();
        payload.dateOfBirth = isoDate;
      } catch {
        payload.dateOfBirth = null;
      }
    } else {
      payload.dateOfBirth = null;
    }

    if (gender) {
      payload.gender = gender;
    } else {
      payload.gender = null;
    }

    payload.preferences = {
      marketingEmails,
      marketingSms,
      marketingPush,
    };

    try {
      let response;
      if (profile) {
        response = await customerService.updateProfile(payload);
      } else {
        response = await customerService.createProfile(payload);
      }

      const updatedCustomer = response?.data?.customer || response?.data || payload;
      setProfile(updatedCustomer);
      setCustomerProfileInStore(updatedCustomer);

      toast.success("Profile Updated Successfully", {
        description: "Your customer details have been saved to your account.",
      });
    } catch (err) {
      toast.error("Failed to Update Profile", {
        description: err?.message || "Please check your inputs and try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-[#007A55] transition-colors">
          Home
        </Link>
        <span>/</span>
        <Link href="/account" className="hover:text-[#007A55] transition-colors">
          My Account
        </Link>
        <span>/</span>
        <span className="font-semibold text-foreground">Profile</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <AccountNav />
        </div>

        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-2xl border bg-white p-6 shadow-xs space-y-6">
            <div className="pb-4 border-b">
              <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                Profile Details
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                View your registered identity and manage communication preferences
              </p>
            </div>

            {isLoading ? (
              <div className="space-y-4 max-w-xl py-2">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            ) : (
              <form onSubmit={handleSaveProfile} className="space-y-5 max-w-xl text-xs">
                {/* Account Read-only Identity Section */}
                <div className="rounded-xl bg-slate-50 p-4 border space-y-3">
                  <div className="flex items-center gap-2 font-extrabold text-slate-900 pb-1 border-b border-slate-200">
                    <ShieldCheck className="size-4 text-[#007A55]" />
                    <span>Primary Account Identity (Read-Only)</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">
                        First Name
                      </label>
                      <input
                        type="text"
                        value={user?.firstName || ""}
                        disabled
                        className="w-full rounded-lg border bg-white px-3 py-2 text-slate-700 cursor-not-allowed font-medium"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={user?.lastName || ""}
                        disabled
                        className="w-full rounded-lg border bg-white px-3 py-2 text-slate-700 cursor-not-allowed font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-600">
                        Primary Email
                      </label>
                      {user?.isEmailVerified ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#007A55]">
                          <CheckCircle2 className="size-3" />
                          Verified
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-700">
                          Unverified
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="email"
                        value={user?.email || ""}
                        disabled
                        className="w-full rounded-lg border bg-white px-3 py-2 pl-9 text-slate-700 cursor-not-allowed font-medium"
                      />
                      <Mail className="size-4 text-slate-400 absolute left-3 top-2.5" />
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1 block">
                      Email is tied to your login credentials and cannot be modified directly.
                    </span>
                  </div>
                </div>

                {/* Editable Profile Fields */}
                <div className="space-y-4 pt-1">
                  <h3 className="font-extrabold uppercase tracking-wider text-slate-900 text-xs">
                    Contact & Personal Information
                  </h3>

                  {/* Phone */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Contact Phone Number
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. 9876543210"
                        maxLength={20}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pl-9 text-slate-900 outline-none focus:border-[#007A55] focus:ring-1 focus:ring-[#007A55]"
                      />
                      <Phone className="size-4 text-slate-400 absolute left-3 top-2.5" />
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-0.5 block">
                      Used for delivery notifications and driver dispatch coordination.
                    </span>
                  </div>

                  {/* Date of Birth & Gender */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        value={dateOfBirth}
                        onChange={(e) => setDateOfBirth(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-[#007A55]"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Gender
                      </label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-[#007A55]"
                      >
                        <option value="">Select Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                        <option value="prefer_not_to_say">Prefer not to say</option>
                      </select>
                    </div>
                  </div>

                  {/* Notification Preferences */}
                  <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-white">
                    <div className="flex items-center gap-2 font-bold text-slate-900 pb-1 border-b border-slate-100">
                      <Bell className="size-4 text-[#007A55]" />
                      <span>Communication Preferences</span>
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={marketingEmails}
                          onChange={(e) => setMarketingEmails(e.target.checked)}
                          className="size-4 rounded text-[#007A55] focus:ring-[#007A55] border-slate-300"
                        />
                        <span className="text-xs text-slate-700">
                          Receive promotional product announcements via Email
                        </span>
                      </label>

                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={marketingSms}
                          onChange={(e) => setMarketingSms(e.target.checked)}
                          className="size-4 rounded text-[#007A55] focus:ring-[#007A55] border-slate-300"
                        />
                        <span className="text-xs text-slate-700">
                          Receive order milestone updates and deals via SMS
                        </span>
                      </label>

                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={marketingPush}
                          onChange={(e) => setMarketingPush(e.target.checked)}
                          className="size-4 rounded text-[#007A55] focus:ring-[#007A55] border-slate-300"
                        />
                        <span className="text-xs text-slate-700">
                          Receive browser push alerts for price drops
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="rounded-full bg-[#007A55] text-white font-bold text-xs px-8 py-2.5 hover:bg-[#004D38] transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Save Profile Details"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilePageView;
