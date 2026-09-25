"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdministrationRolesRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/administrator/job-roles");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh] text-sm text-gray-500">
      Redirecting to Job Roles &amp; Hierarchy...
    </div>
  );
}
