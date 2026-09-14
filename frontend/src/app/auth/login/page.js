import React, { Suspense } from "react";
import { LoginForm } from "../../../components/auth/LoginForm.jsx";
import { Skeleton } from "../../../components/ui/Skeleton.jsx";

export const metadata = {
  title: "Sign In | Buybox",
  description: "Sign in to your Buybox customer account.",
};

function LoginFallback() {
  return (
    <div className="w-full max-w-md rounded-3xl border bg-white p-8 shadow-card space-y-4">
      <Skeleton className="size-12 rounded-xl mx-auto" />
      <Skeleton className="h-6 w-36 mx-auto" />
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-10 w-full rounded-full" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-slate-50/50">
      <Suspense fallback={<LoginFallback />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
