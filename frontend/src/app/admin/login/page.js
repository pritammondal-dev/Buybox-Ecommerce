"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyAdminLoginRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/administrator/login");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 text-sm">
      Redirecting to Administrator Portal...
    </div>
  );
}
