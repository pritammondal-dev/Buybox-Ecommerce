"use client";

import React from "react";
import Link from "next/link";
import {
  Store,
  CreditCard,
  Truck,
  KeyRound,
  ShieldCheck,
  Mail,
  Percent,
  Lock,
  ArrowRight,
  Sliders,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader.jsx";

const SETTINGS_MODULES = [
  {
    title: "Store & Feature Flags",
    description: "Manage marketplace branding, localization, currency, and real-time platform feature toggles.",
    href: "/administrator/settings/store",
    icon: Store,
    badge: "Core",
    color: "emerald",
  },
  {
    title: "Payment Gateways",
    description: "Configure Razorpay, PayPal, and domestic payment options with encrypted credential storage.",
    href: "/administrator/settings/checkout",
    icon: CreditCard,
    badge: "Finance",
    color: "blue",
  },
  {
    title: "Courier & Logistics",
    description: "Connect Delhivery, Shiprocket, and automated AWB dispatch integrations.",
    href: "/administrator/settings/shipping",
    icon: Truck,
    badge: "Fulfillment",
    color: "orange",
  },
  {
    title: "Platform Credentials",
    description: "Secure, centralized server-side storage for Google OAuth, Elastic Email, and external APIs.",
    href: "/administrator/settings/credentials",
    icon: KeyRound,
    badge: "Security",
    color: "purple",
  },
  {
    title: "Taxes & Jurisdictions",
    description: "Authoritative tax rules, GST rates, state-level overrides, and priority rules.",
    href: "/administrator/settings/taxes",
    icon: Percent,
    badge: "Compliance",
    color: "teal",
  },
  {
    title: "Customer Login Options",
    description: "Configure password, OTP, Google SSO, and multi-factor customer authentication policies.",
    href: "/administrator/settings/authentication",
    icon: Lock,
    badge: "Auth",
    color: "indigo",
  },
  {
    title: "Email & Notifications",
    description: "Configure transactional email dispatch via Elastic Email provider and review delivery logs.",
    href: "/administrator/settings/notifications",
    icon: Mail,
    badge: "Dispatch",
    color: "sky",
  },
  {
    title: "Role Permissions Matrix",
    description: "Inspect granular permission grants, scope delegations, and authority tier privileges.",
    href: "/administrator/settings/permissions",
    icon: ShieldCheck,
    badge: "RBAC",
    color: "emerald",
  },
];

export default function AdminSettingsHubPage() {
  return (
    <div className="space-y-6 max-w-5xl pb-16">
      <PageHeader
        title="Authoritative Platform Configuration"
        description="Centralized governance hub for marketplace settings, integrations, feature flags, and platform credentials."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SETTINGS_MODULES.map((mod) => {
          const Icon = mod.icon;
          return (
            <Link
              key={mod.href}
              href={mod.href}
              className="group bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:border-[#007A55]/50 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="size-10 rounded-xl bg-slate-100 text-[#007A55] group-hover:bg-[#007A55] group-hover:text-white flex items-center justify-center transition-colors">
                    <Icon className="size-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {mod.badge}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-sm text-slate-900 group-hover:text-[#007A55] transition-colors">
                    {mod.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {mod.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center text-xs font-bold text-[#007A55] pt-4 mt-2 border-t border-slate-100">
                <span>Configure Module</span>
                <ArrowRight className="size-3.5 ml-1 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
