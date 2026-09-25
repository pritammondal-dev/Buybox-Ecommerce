"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SuperadminJobRolesAlias() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/administrator/job-roles");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh] text-sm text-gray-500">
      Redirecting to canonical Job Roles dashboard...
    </div>
  );
}
