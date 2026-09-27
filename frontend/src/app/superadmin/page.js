import Link from "next/link";

const CONTROL_MODULES = [
  ["Dashboard", "/administrator/dashboard"],
  ["Customers", "/administrator/customers"],
  ["Vendors & Reviews", "/administrator/vendors"],
  ["Staff", "/administrator/staff"],
  ["Job Roles & Permissions", "/superadmin/job-roles"],
  ["CMS & Banners", "/administrator/cms"],
  ["Catalog", "/administrator/catalog"],
  ["Orders", "/administrator/orders"],
  ["Payments", "/administrator/payments"],
  ["Finance & Settlements", "/administrator/finance"],
  ["Shipping", "/administrator/shipping"],
  ["Settings", "/administrator/settings"],
  ["Integrations & Credentials", "/administrator/integrations"],
  ["Security & Audit", "/administrator/security"],
  ["Reports", "/administrator/reports"],
  ["Analytics", "/administrator/analytics"],
];

export default function SuperadminControlPlanePage() {
  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
            Buybox Control Plane
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            Superadmin Global Control
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            One authoritative entry point for marketplace administration. Each module
            opens its existing production management surface and continues to use the
            central backend source of truth.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {CONTROL_MODULES.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-900">{label}</h2>
                <span className="text-emerald-600 transition group-hover:translate-x-1">→</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Open authoritative management controls
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
