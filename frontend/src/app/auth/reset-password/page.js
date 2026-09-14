import React, { Suspense } from "react";
import { ResetPasswordForm } from "../../../components/auth/ResetPasswordForm.jsx";
import { Skeleton } from "../../../components/ui/Skeleton.jsx";

export const metadata = {
  title: "Reset Password | Buybox",
  description: "Set a new password for your Buybox customer account.",
};

function ResetFallback() {
  return (
    <div className="w-full max-w-md rounded-3xl border bg-white p-8 shadow-card space-y-4">
      <Skeleton className="size-12 rounded-xl mx-auto" />
      <Skeleton className="h-6 w-48 mx-auto" />
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-10 w-full rounded-full" />
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-slate-50/50">
      <Suspense fallback={<ResetFallback />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
