"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdministratorAuditAlias() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/administrator/security/audit-logs");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh] text-sm text-gray-500">
      Redirecting to Audit Logs...
    </div>
  );
}
