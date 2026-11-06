"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Package,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Tag,
  Layers,
  Store,
  DollarSign,
  Edit,
  Trash2,
  X,
  Save,
  Check,
  Info,
  RotateCcw,
  Image as ImageIcon,
  Send,
  Building2,
  Mail,
  Phone,
  MapPin,
  Barcode,
  Scale,
  Box,
  ShieldCheck,
  Clock,
  ExternalLink,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { adminCatalogService } from "@/services/admin/admin.service.js";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog.jsx";
import { collectProductGalleryImages } from "@/utils/product-image.util.js";

export { collectProductGalleryImages };

export function ProductImageGallery({ product }) {
  const images = collectProductGalleryImages(product);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [failedUrls, setFailedUrls] = useState(new Set());

  useEffect(() => {
    setSelectedIndex(0);
    setFailedUrls(new Set());
  }, [product?._id]);

  const activeImage = images[selectedIndex] || images[0];
  const isFailed = activeImage ? failedUrls.has(activeImage.url) : true;

  const handleImageError = (url) => {
    setFailedUrls((prev) => new Set(prev).add(url));
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="size-4 text-slate-500" />
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Product & Variant Imagery
          </h2>
        </div>
        <span className="text-xs font-semibold text-slate-500 px-2 py-0.5 rounded-full bg-slate-100">
          {images.length} {images.length === 1 ? "image" : "images"}
        </span>
      </div>

      {images.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center space-y-2">
          <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <Package className="size-6" />
          </div>
          <div className="text-xs font-semibold text-slate-700">No images available</div>
          <p className="text-[11px] text-slate-400 max-w-xs">
            This product does not currently have any gallery or variant images attached.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Main preview */}
          <div className="relative w-full h-72 sm:h-96 rounded-2xl overflow-hidden bg-slate-50 border border-slate-200 flex items-center justify-center">
            {!isFailed && activeImage?.url ? (
              <NextImage
                src={activeImage.url}
                alt={activeImage.altText || product?.name || "Product image"}
                fill
                className="object-contain"
                unoptimized
                onError={() => handleImageError(activeImage.url)}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Package className="size-10" />
                <span className="text-xs">Image unavailable</span>
              </div>
            )}
            <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-xs text-white text-[10px] font-semibold">
                {activeImage?.sourceLabel}
              </span>
              {activeImage?.variantSku && (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-600/90 backdrop-blur-xs text-white text-[10px] font-mono font-semibold">
                  SKU: {activeImage.variantSku}
                </span>
              )}
            </div>
            {activeImage?.altText && (
              <div className="absolute bottom-3 inset-x-3 text-center pointer-events-none">
                <span className="inline-block px-3 py-1 rounded-lg bg-black/60 backdrop-blur-xs text-white text-[11px] truncate max-w-full">
                  {activeImage.altText}
                </span>
              </div>
            )}
          </div>

          {/* Thumbnails strip */}
          {images.length > 1 && (
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-1">
              {images.map((img, idx) => {
                const imgFailed = failedUrls.has(img.url);
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={`${img.url}-${idx}`}
                    type="button"
                    onClick={() => setSelectedIndex(idx)}
                    className={`relative shrink-0 size-16 sm:size-20 rounded-xl overflow-hidden border-2 transition-all ${
                      isSelected
                        ? "border-emerald-500 ring-2 ring-emerald-500/20"
                        : "border-slate-200 hover:border-slate-300 opacity-80 hover:opacity-100"
                    } bg-slate-50 flex items-center justify-center`}
                    aria-label={`View ${img.sourceLabel}`}
                  >
                    {!imgFailed ? (
                      <NextImage
                        src={img.url}
                        alt={img.altText || `Thumbnail ${idx + 1}`}
                        fill
                        className="object-cover"
                        unoptimized
                        onError={() => handleImageError(img.url)}
                      />
                    ) : (
                      <Package className="size-4 text-slate-400" />
                    )}
                    {img.variantSku && (
                      <span className="absolute bottom-0 inset-x-0 bg-emerald-700/80 text-white text-[8px] font-mono text-center py-0.5 truncate px-0.5">
                        {img.variantSku}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SellerAttributionCard({ product }) {
  const [copiedId, setCopiedId] = useState(false);

  const vendorAttribution = product?.vendorAttribution;
  const vendor =
    (product?.vendorId && typeof product.vendorId === "object" && product.vendorId.businessName)
      ? product.vendorId
      : vendorAttribution?.vendor || null;

  const rawVendorId =
    product?.vendorId?._id
      ? String(product.vendorId._id)
      : (typeof product?.vendorId === "string" && product?.vendorId)
      ? product.vendorId
      : vendorAttribution?.vendorId || null;

  const status =
    vendorAttribution?.status ||
    (vendor ? "assigned" : rawVendorId ? "unresolved_record" : "unassigned");

  const copyToClipboard = (text) => {
    if (!text) return;
    try {
      navigator?.clipboard?.writeText(text);
      setCopiedId(true);
      toast.success("Vendor ID copied to clipboard");
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      // fallback
    }
  };

  const address = vendor?.businessAddress;
  const formattedAddress = [
    address?.addressLine1,
    address?.addressLine2,
    address?.city,
    address?.state,
    address?.postalCode,
    address?.country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-5"
      data-testid="seller-vendor-attribution-card"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/60 shadow-xs">
            <Building2 className="size-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Seller &amp; Vendor Attribution
              {status === "assigned" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="size-3 text-emerald-600" />
                  Verified Merchant Partner
                </span>
              )}
              {status === "unresolved_record" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                  <AlertTriangle className="size-3 text-rose-600" />
                  Vendor Record Unavailable
                </span>
              )}
              {status === "unassigned" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <Info className="size-3 text-amber-600" />
                  Vendor Not Assigned
                </span>
              )}
            </h2>
            <p className="text-[11px] text-slate-500">
              Authoritative merchant ownership and store identity for this catalog product
            </p>
          </div>
        </div>

        {rawVendorId && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 truncate max-w-[200px]">
              ID: {rawVendorId}
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(rawVendorId)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
              title="Copy Vendor ID"
              aria-label="Copy Vendor ID"
            >
              {copiedId ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
            </button>
            <Link
              href="/administrator/vendors"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
            >
              <span>Vendor Directory</span>
              <ExternalLink className="size-3" />
            </Link>
          </div>
        )}
      </div>

      {status === "assigned" && vendor ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Store / Business Info */}
          <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Business / Store Name
            </span>
            <div className="text-sm font-bold text-slate-900 truncate">
              {vendor.businessName}
            </div>
            <div className="text-[11px] font-mono text-slate-500">
              @{vendor.businessSlug || "store"}
            </div>
          </div>

          {/* Account & Onboarding Status */}
          <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Vendor Account Status
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                  vendor.onboardingStatus === "approved"
                    ? "bg-emerald-100 text-emerald-800"
                    : vendor.onboardingStatus === "pending" || vendor.onboardingStatus === "under_review"
                    ? "bg-amber-100 text-amber-800"
                    : vendor.onboardingStatus === "suspended" || vendor.onboardingStatus === "rejected"
                    ? "bg-rose-100 text-rose-800"
                    : "bg-slate-200 text-slate-800"
                }`}
              >
                {vendor.onboardingStatus || "Active"}
              </span>
              <span className="text-[11px] text-slate-500">
                {vendor.isActive !== false ? "Active Merchant" : "Inactive"}
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              Ownership: Direct Product Owner
            </div>
          </div>

          {/* Contact Details */}
          <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Support &amp; Contact
            </span>
            <div className="space-y-1 text-slate-600">
              <div className="flex items-center gap-1.5 truncate">
                <Mail className="size-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{vendor.supportEmail || "No email registered"}</span>
              </div>
              <div className="flex items-center gap-1.5 truncate">
                <Phone className="size-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{vendor.phone || "No phone registered"}</span>
              </div>
            </div>
          </div>

          {/* Business Address */}
          <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Registered Address
            </span>
            <div className="flex items-start gap-1.5 text-slate-600">
              <MapPin className="size-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span className="line-clamp-2 leading-relaxed">
                {formattedAddress || "No physical address registered"}
              </span>
            </div>
          </div>
        </div>
      ) : status === "unresolved_record" ? (
        <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 text-rose-800 flex items-start gap-3 text-xs leading-relaxed">
          <AlertTriangle className="size-4 shrink-0 text-rose-600 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-rose-900">
              Referenced Vendor Record Not Found
            </p>
            <p className="text-rose-700">
              This product references vendor ID <code className="font-mono bg-rose-100 px-1 py-0.5 rounded text-rose-900 font-semibold">{rawVendorId}</code>, but the corresponding vendor profile document is missing or was deleted from the database.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 flex items-start gap-3 text-xs leading-relaxed">
          <Info className="size-4 shrink-0 text-slate-500 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-slate-900">
              Vendor Not Assigned
            </p>
            <p className="text-slate-600">
              This product does not currently have an assigned vendor or seller record in the catalog. It is managed directly at the platform level or awaiting vendor assignment.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProductSpecificationsCard({ product }) {
  const specs = product?.specifications;
  const specEntries =
    specs instanceof Map
      ? Array.from(specs.entries())
      : specs && typeof specs === "object"
      ? Object.entries(specs)
      : [];

  const dims = product?.dimensions;
  const weight = product?.weight;

  const dimStr =
    dims && (dims.length || dims.width || dims.height)
      ? `${dims.length || 0} × ${dims.width || 0} × ${dims.height || 0} ${dims.unit || "cm"}`
      : "Not specified";

  const weightStr =
    weight && weight.value
      ? `${weight.value} ${weight.unit || "kg"}`
      : "Not specified";

  const createdAtStr = product?.createdAt
    ? new Date(product.createdAt).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "N/A";

  const updatedAtStr = product?.updatedAt
    ? new Date(product.updatedAt).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "N/A";

  const moderatedAtStr = product?.moderatedAt
    ? new Date(product.moderatedAt).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <div
      className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-6"
      data-testid="product-specifications-card"
    >
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200/60 shadow-xs">
            <Box className="size-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Specifications, Logistics &amp; Audit
            </h2>
            <p className="text-[11px] text-slate-500">
              Physical dimensions, tax compliance, technical specs, and audit history
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        {/* Logistics & Dimensions */}
        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Physical Dimensions
          </span>
          <div className="flex items-center gap-2 text-slate-800 font-medium">
            <Box className="size-3.5 text-slate-400 shrink-0" />
            <span>{dimStr}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-800 font-medium">
            <Scale className="size-3.5 text-slate-400 shrink-0" />
            <span>Weight: {weightStr}</span>
          </div>
        </div>

        {/* Tax & Shipping */}
        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Tax &amp; Shipping Class
          </span>
          <div className="text-slate-800 font-medium">
            Tax Category: <span className="font-semibold text-slate-900">{product?.taxCategory || "Standard"}</span>
          </div>
          <div className="text-slate-600 text-[11px]">
            Taxable: <span className="font-semibold text-slate-800">{product?.isTaxable !== false ? "Yes (Taxable)" : "No (Tax-Exempt)"}</span>
          </div>
          <div className="text-slate-600 text-[11px]">
            Shipping: <span className="font-semibold text-slate-800">{product?.shippingClass || "Standard Shipping"}</span>
          </div>
        </div>

        {/* Identifiers & Barcode */}
        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Identifiers &amp; Barcode
          </span>
          <div className="flex items-center gap-2 text-slate-800 font-mono text-[11px]">
            <Barcode className="size-3.5 text-slate-400 shrink-0" />
            <span>Barcode: {product?.barcode || "None"}</span>
          </div>
          <div className="text-slate-500 font-mono text-[10px] truncate" title={product?._id}>
            Mongo ID: {product?._id || "N/A"}
          </div>
          {product?.secureId && (
            <div className="text-slate-500 font-mono text-[10px] truncate" title={product.secureId}>
              Secure ID: {product.secureId}
            </div>
          )}
        </div>

        {/* Audit & Timestamps */}
        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Audit Timestamps
          </span>
          <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
            <Clock className="size-3 text-slate-400 shrink-0" />
            <span>Created: {createdAtStr}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
            <Clock className="size-3 text-slate-400 shrink-0" />
            <span>Updated: {updatedAtStr}</span>
          </div>
          {moderatedAtStr && (
            <div className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
              Moderated on {moderatedAtStr}
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      {product?.tags?.length > 0 && (
        <div className="space-y-1.5 pt-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Product Tags ({product.tags.length})
          </span>
          <div className="flex flex-wrap gap-1.5">
            {product.tags.map((tag, idx) => (
              <span
                key={`${tag}-${idx}`}
                className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-medium text-[11px] border border-slate-200"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Custom Technical Specifications Table */}
      {specEntries.length > 0 && (
        <div className="space-y-2 pt-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Technical Specifications ({specEntries.length})
          </span>
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                <tr>
                  <th className="py-2 px-3 w-1/3">Specification</th>
                  <th className="py-2 px-3">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {specEntries.map(([key, val], idx) => (
                  <tr key={`${key}-${idx}`} className="hover:bg-slate-50/50">
                    <td className="py-2 px-3 font-semibold text-slate-900 bg-slate-50/40">
                      {key}
                    </td>
                    <td className="py-2 px-3">
                      {typeof val === "object" ? JSON.stringify(val) : String(val)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params?.id;

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Reject Modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);

  // Archive Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reservationErrors, setReservationErrors] = useState(null);

  // Edit Drawer
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [editForm, setEditForm] = useState({
    name: "",
    slug: "",
    sku: "",
    productType: "simple",
    price: "",
    compareAtPrice: "",
    categoryId: "",
    brandId: "",
    status: "active",
    shortDescription: "",
    description: "",
    isFeatured: false,
  });
  const [saving, setSaving] = useState(false);

  const parseDecimalString = (val) => {
    if (val == null) return "";
    if (typeof val === "object" && val.$numberDecimal) return String(val.$numberDecimal);
    return String(val);
  };

  const fetchProduct = async () => {
    if (!productId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await adminCatalogService.getProduct(productId);
      const data = res?.product || res?.data?.product || res?.data || res;
      setProduct(data);
      // Initialize edit form
      setEditForm({
        name: data.name || data.title || "",
        slug: data.slug || "",
        sku: data.sku || "",
        productType: data.productType || "simple",
        price: parseDecimalString(data.price),
        compareAtPrice: parseDecimalString(data.compareAtPrice),
        categoryId: data.categoryId?._id || data.categoryId || "",
        brandId: data.brandId?._id || data.brandId || "",
        status: data.status || "active",
        shortDescription: data.shortDescription || "",
        description: data.description || "",
        isFeatured: Boolean(data.isFeatured),
      });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load product details"
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchLookups = async () => {
    try {
      const [catsRes, brandsRes] = await Promise.allSettled([
        adminCatalogService.listCategories(),
        adminCatalogService.listBrands(),
      ]);
      if (catsRes.status === "fulfilled") {
        setCategories(catsRes.value?.categories || catsRes.value?.items || []);
      }
      if (brandsRes.status === "fulfilled") {
        setBrands(brandsRes.value?.brands || brandsRes.value?.items || []);
      }
    } catch {
      // Non-fatal lookup fallback
    }
  };

  useEffect(() => {
    fetchProduct();
    fetchLookups();
  }, [productId]);

  const handleApprove = () => {
    setShowApproveConfirm(true);
  };

  const handleConfirmApprove = async () => {
    setActionLoading(true);
    try {
      await adminCatalogService.approveProduct(productId);
      setSuccess("Product approved successfully");
      setTimeout(() => setSuccess(null), 4000);
      fetchProduct();
      setShowApproveConfirm(false);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to approve product");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitForApproval = async () => {
    setActionLoading(true);
    setError(null);
    try {
      await adminCatalogService.submitProduct(productId);
      toast.success("Product submitted for approval");
      setSuccess("Product submitted for approval successfully");
      setTimeout(() => setSuccess(null), 4000);
      fetchProduct();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to submit product for approval";
      toast.error(msg);
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejecting the product.");
      return;
    }
    setActionLoading(true);
    try {
      await adminCatalogService.rejectProduct(productId, rejectReason.trim());
      setShowRejectModal(false);
      setRejectReason("");
      toast.success("Product rejected successfully");
      setSuccess("Product rejected successfully");
      setTimeout(() => setSuccess(null), 4000);
      fetchProduct();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to reject product");
      setError(err?.response?.data?.message || err?.message || "Failed to reject product");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setReservationErrors(null);
    try {
      await adminCatalogService.deleteProduct(productId);
      toast.success("Product archived successfully");
      router.push("/administrator/catalog/products");
    } catch (err) {
      const errDetails = err?.response?.data?.details;
      if (Array.isArray(errDetails) && errDetails.length > 0) {
        setReservationErrors(errDetails);
      } else {
        setShowDeleteModal(false);
      }
      setError(err?.response?.data?.message || "Failed to archive product");
      toast.error(err?.response?.data?.message || "Failed to archive product");
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: editForm.name.trim(),
        slug: editForm.slug.trim(),
        sku: editForm.sku.trim().toUpperCase(),
        price: editForm.price,
        status: editForm.status,
        shortDescription: editForm.shortDescription.trim(),
        description: editForm.description.trim(),
        isFeatured: editForm.isFeatured,
      };

      if (editForm.productType) {
        payload.productType = editForm.productType;
      }
      if (editForm.compareAtPrice) {
        payload.compareAtPrice = editForm.compareAtPrice;
      }
      if (editForm.categoryId) {
        payload.categoryId = editForm.categoryId;
      }
      if (editForm.brandId) {
        payload.brandId = editForm.brandId;
      }

      await adminCatalogService.updateProduct(productId, payload);
      setSuccess("Product updated successfully");
      setShowEditDrawer(false);
      setTimeout(() => setSuccess(null), 4000);
      fetchProduct();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to update product");
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreProduct = async () => {
    setActionLoading(true);
    try {
      await adminCatalogService.restoreProduct(productId);
      toast.success("Product and variants restored successfully");
      setSuccess("Product and variants restored successfully");
      setTimeout(() => setSuccess(null), 4000);
      fetchProduct();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to restore product");
      setError(err?.response?.data?.message || err?.message || "Failed to restore product");
    } finally {
      setActionLoading(false);
    }
  };

  const formatAttributes = (attrs) => {
    if (!attrs) return "Default";
    if (attrs instanceof Map) {
      const entries = Array.from(attrs.entries());
      if (entries.length === 0) return "Default";
      return entries.map(([k, v]) => `${k}: ${v}`).join(", ");
    }
    if (Array.isArray(attrs)) {
      return attrs.map((a) => (typeof a === "object" ? `${a.name || a.key}: ${a.value}` : String(a))).join(", ");
    }
    if (typeof attrs === "object") {
      const keys = Object.keys(attrs);
      if (keys.length === 0) return "Default";
      return keys.map((k) => `${k}: ${attrs[k]}`).join(", ");
    }
    return String(attrs);
  };

  const parseDecimalNumber = (val) => {
    if (val == null) return 0;
    if (typeof val === "object" && val.$numberDecimal) return Number(val.$numberDecimal) || 0;
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(parseDecimalNumber(val));
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6">
        <div className="h-6 w-32 bg-slate-200 rounded-lg animate-pulse" />
        <div className="h-44 bg-slate-200 rounded-3xl animate-pulse" />
        <div className="h-64 bg-slate-200 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (error && !product) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <Link
          href="/administrator/catalog/products"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Products</span>
        </Link>
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3 text-sm">
          <AlertTriangle className="size-5 shrink-0" />
          <span>{error || "Product could not be found."}</span>
        </div>
      </div>
    );
  }

  const isArchived = Boolean(product?.deletedAt || product?.status === "archived");

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link
          href="/administrator/catalog/products"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Product Catalog</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEditDrawer(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-xs"
          >
            <Edit className="size-3.5" />
            <span>Edit Product</span>
          </button>
          {isArchived ? (
            <button
              onClick={handleRestoreProduct}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-xl transition-colors disabled:opacity-50"
            >
              <RotateCcw className="size-3.5" />
              <span>Restore Product</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setReservationErrors(null);
                setShowDeleteModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-xl transition-colors"
            >
              <Trash2 className="size-3.5" />
              <span>Archive Product</span>
            </button>
          )}
          <button
            onClick={fetchProduct}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="size-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
          <CheckCircle className="size-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Details Card */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {product?.name || product?.title || "Product Details"}
              </h1>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  product?.status === "active"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : product?.status === "pending_approval"
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : product?.status === "rejected"
                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                    : "bg-slate-100 text-slate-700 border border-slate-200"
                }`}
              >
                {product?.status || "Unknown"}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                {product?.productType === "variable" ? "Variable Product" : "Simple Product"}
              </span>
              {product?.isFeatured && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Featured
                </span>
              )}
            </div>
            <p className="text-xs font-mono text-slate-500 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>SKU: {product?.sku || "N/A"}</span>
              <span>•</span>
              <span>Slug: {product?.slug || "N/A"}</span>
              {product?.barcode && (
                <>
                  <span>•</span>
                  <span>Barcode: {product.barcode}</span>
                </>
              )}
              {product?._id && (
                <>
                  <span>•</span>
                  <span className="text-slate-400">ID: {product._id}</span>
                </>
              )}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5">
            {(product?.status === "draft" || product?.status === "rejected") && (
              <button
                onClick={handleSubmitForApproval}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs disabled:opacity-50"
              >
                <Send className="size-3.5" />
                <span>Submit for Approval</span>
              </button>
            )}

            {product?.status === "pending_approval" && (
              <>
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  Approve Product
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors disabled:opacity-50"
                >
                  Reject
                </button>
              </>
            )}
          </div>
        </div>

        {product?.rejectionReason && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            <span className="font-semibold">Rejection Notes: </span>
            {product.rejectionReason}
          </div>
        )}

        {/* Pricing & Categorization Info */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 pt-4 border-t border-slate-100">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Catalog Price
            </div>
            <div className="text-lg font-bold text-slate-900 mt-0.5">
              {formatCurrency(product?.price)}
            </div>
            {parseDecimalNumber(product?.compareAtPrice) > parseDecimalNumber(product?.price) && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-slate-400 line-through">
                  {formatCurrency(product.compareAtPrice)}
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                  {Math.round(
                    ((parseDecimalNumber(product.compareAtPrice) - parseDecimalNumber(product.price)) /
                      parseDecimalNumber(product.compareAtPrice)) *
                      100
                  )}% off
                </span>
              </div>
            )}
          </div>

          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Primary Merchant
            </div>
            <div className="text-sm font-semibold text-slate-800 mt-0.5 flex items-center gap-1.5 truncate">
              <Store className="size-3.5 text-slate-400 shrink-0" />
              <span className="truncate">
                {product?.vendorId?.businessName ||
                  product?.vendorAttribution?.vendor?.businessName ||
                  (product?.vendorAttribution?.status === "unresolved_record"
                    ? "Unresolved Vendor"
                    : "Vendor Not Assigned")}
              </span>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Category
            </div>
            <div className="text-sm font-medium text-slate-800 mt-0.5 flex items-center gap-1.5 truncate">
              <Layers className="size-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{product?.categoryId?.name || "Uncategorized"}</span>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Brand
            </div>
            <div className="text-sm font-medium text-slate-800 mt-0.5 flex items-center gap-1.5 truncate">
              <Tag className="size-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{product?.brandId?.name || "Generic"}</span>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Stock &amp; Availability
            </div>
            <div className="text-sm font-medium text-slate-800 mt-0.5 flex items-center gap-1.5">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                  product?.stockStatus === "in_stock" || (product?.inStock && !product?.stockStatus)
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : product?.stockStatus === "low_stock"
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-rose-50 text-rose-700 border border-rose-200"
                }`}
              >
                {product?.stockStatus === "in_stock"
                  ? "In Stock"
                  : product?.stockStatus === "low_stock"
                  ? "Low Stock"
                  : product?.stockStatus === "out_of_stock"
                  ? "Out of Stock"
                  : product?.inStock
                  ? "In Stock"
                  : "Out of Stock"}
              </span>
              {product?.availableQuantity !== undefined && (
                <span className="text-xs text-slate-500 font-semibold">
                  ({product.availableQuantity} units)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Short Description */}
        {product?.shortDescription && (
          <div className="space-y-1.5 pt-4 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Short Description
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {product.shortDescription}
            </p>
          </div>
        )}

        {/* Description */}
        <div className="space-y-2 pt-4 border-t border-slate-100">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Detailed Description
          </div>
          <div className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100 whitespace-pre-line">
            {product?.description || "No description provided."}
          </div>
        </div>

        {/* Variants Table */}
        {product?.variants?.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Product Variants ({product.variants.length})
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                {product.productType === "variable" ? "Variable Combinations" : "Canonical Default Variant"}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Variant SKU</th>
                    <th className="py-2.5 px-3">Attributes</th>
                    <th className="py-2.5 px-3">Price</th>
                    <th className="py-2.5 px-3">Stock &amp; Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {product.variants.map((v, i) => (
                    <tr key={v._id || i} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                        {v.sku || `Variant ${i + 1}`}
                        {v.isDefault && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Canonical Default
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[11px]">
                          {formatAttributes(v.attributes)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {formatCurrency(v.price || product.price)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                              v.isActive !== false ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {v.isActive !== false ? "Active" : "Inactive"}
                          </span>
                          <span className="text-slate-500 text-[11px]">
                            {v.stockQuantity !== undefined ? `${v.stockQuantity} in stock` : ""}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Dedicated Seller / Vendor Attribution Card */}
      <SellerAttributionCard product={product} />

      {/* Specifications, Logistics & Audit Details */}
      <ProductSpecificationsCard product={product} />

      {/* Product Image Gallery (DEF-007) */}
      <ProductImageGallery product={product} />

      {/* Edit Drawer Modal */}
      {showEditDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Edit Product</h2>
                <p className="text-xs text-slate-500">Update catalog product details and listing status</p>
              </div>
              <button
                onClick={() => setShowEditDrawer(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">SKU</label>
                  <input
                    type="text"
                    required
                    value={editForm.sku}
                    onChange={(e) => setEditForm({ ...editForm, sku: e.target.value.toUpperCase() })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-mono uppercase focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Slug</label>
                  <input
                    type="text"
                    required
                    value={editForm.slug}
                    onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-mono lowercase focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editForm.price}
                    onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Compare-at Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.compareAtPrice}
                    onChange={(e) => setEditForm({ ...editForm, compareAtPrice: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={editForm.categoryId}
                    onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Brand</label>
                  <select
                    value={editForm.brandId}
                    onChange={(e) => setEditForm({ ...editForm, brandId: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    <option value="">Select Brand</option>
                    {brands.map((b) => (
                      <option key={b._id} value={b._id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Product Type</label>
                  <select
                    value={editForm.productType}
                    onChange={(e) => setEditForm({ ...editForm, productType: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    <option value="simple">Simple (Canonical Variant)</option>
                    <option value="variable">Variable (Combinations)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                  <option value="active">Active (Published)</option>
                  <option value="draft">Draft</option>
                  <option value="inactive">Inactive</option>
                  <option value="archived">Archived</option>
                  <option value="rejected">Rejected</option>
                </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Short Description</label>
                <input
                  type="text"
                  value={editForm.shortDescription}
                  onChange={(e) => setEditForm({ ...editForm, shortDescription: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  placeholder="One sentence summary..."
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Description</label>
                <textarea
                  rows="4"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  placeholder="Comprehensive product details..."
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isFeatured"
                  checked={editForm.isFeatured}
                  onChange={(e) => setEditForm({ ...editForm, isFeatured: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="isFeatured" className="text-xs font-medium text-slate-700">
                  Featured on marketplace homepage
                </label>
              </div>

              <div className="pt-6 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowEditDrawer(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  <Save className="size-3.5" />
                  <span>{saving ? "Saving Changes..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="size-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="size-5" />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-base font-bold text-slate-900">Archive Product</h2>
              <p className="text-xs text-slate-500">
                Are you sure you want to archive this product? It will be hidden from the active storefront while historical order items, shipments, and financial records remain preserved.
              </p>
            </div>

            {reservationErrors && reservationErrors.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl space-y-2 text-xs text-left">
                <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                  <AlertTriangle className="size-4 text-amber-600 shrink-0" />
                  <span>Active Reservations Blocking Archival ({reservationErrors.length})</span>
                </div>
                <p className="text-[11px] text-amber-800">
                  The following variants have active customer reservations. Outstanding orders must be fulfilled or cancelled first:
                </p>
                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                  {reservationErrors.map((r, idx) => (
                    <div key={idx} className="bg-white p-2.5 rounded-xl border border-amber-200/80 text-[11px] text-slate-700">
                      <div className="flex items-center justify-between font-mono font-bold text-slate-900">
                        <span>{r.sku}</span>
                        <span className="text-amber-700 font-semibold">{r.reservedQuantity} reserved</span>
                      </div>
                      <div className="text-slate-500 text-[10px]">
                        Warehouse: {r.warehouseName} {r.warehouseCode ? `(${r.warehouseCode})` : ""}
                      </div>
                      <div className="text-slate-400 text-[10px] mt-0.5">{r.resolution}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setReservationErrors(null);
                }}
                className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || (reservationErrors && reservationErrors.length > 0)}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold text-xs transition-colors disabled:opacity-50"
              >
                {deleting ? "Archiving..." : "Archive Product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900">
              Reject Product Application
            </h3>
            <p className="text-xs text-slate-500">
              Specify reason why this product does not comply with marketplace catalog standards.
            </p>
            <form onSubmit={handleReject} className="space-y-4">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g., Inadequate product imagery, incorrect pricing, or prohibited item category..."
                rows={4}
                required
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 resize-none"
              />
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors disabled:opacity-50"
                >
                  {actionLoading ? "Rejecting..." : "Confirm Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Approve Product Dialog */}
      <ConfirmDialog
        isOpen={showApproveConfirm}
        onClose={() => setShowApproveConfirm(false)}
        onConfirm={handleConfirmApprove}
        title="Approve Product"
        description="Are you sure you want to approve this product for catalog listing? It will become active and visible on the marketplace."
        confirmLabel="Approve Product"
        variant="default"
        isLoading={actionLoading}
      />
    </div>
  );
}
