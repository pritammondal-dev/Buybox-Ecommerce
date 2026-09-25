"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RolesPermissionsAlias() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/administrator/settings/permissions");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh] text-sm text-gray-500">
      Redirecting to Role Permissions matrix...
    </div>
  );
}
