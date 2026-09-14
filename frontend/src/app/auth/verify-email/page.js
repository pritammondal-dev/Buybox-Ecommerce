import React, { Suspense } from "react";
import { VerifyEmailView } from "../../../components/auth/VerifyEmailView.jsx";
import { Skeleton } from "../../../components/ui/Skeleton.jsx";

export const metadata = {
  title: "Verify Email | Buybox",
  description: "Verify your email address for Buybox.",
};

function VerifyFallback() {
  return (
    <div className="w-full max-w-md rounded-3xl border bg-white p-8 shadow-card text-center space-y-4">
      <Skeleton className="size-14 rounded-full mx-auto" />
      <Skeleton className="h-6 w-36 mx-auto" />
      <Skeleton className="h-4 w-64 mx-auto" />
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-slate-50/50">
      <Suspense fallback={<VerifyFallback />}>
        <VerifyEmailView />
      </Suspense>
    </div>
  );
}
