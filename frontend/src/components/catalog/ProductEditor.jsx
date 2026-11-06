"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Package,
  Layers,
  Image as ImageIcon,
  DollarSign,
  Boxes,
  Truck,
  Sliders,
  Search as SearchIcon,
  Globe,
  FileText,
  Warehouse,
  Save,
  Send,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  Info,
  ShieldCheck,
  Eye,
  Loader2,
  Trash2,
  Upload,
  Download,
  FileCheck,
  HardDrive,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { productService } from "@/services/product.service";
import { vendorService } from "@/services/vendor.service";
import { categoryService } from "@/services/category.service";
import { brandService } from "@/services/brand.service";
import { getVendorProductUrl } from "@/utils/secure-id.util";
import ImageGalleryManager from "./ImageGalleryManager";
import ProductTypeSwitcher from "@/components/vendor/variants/ProductTypeSwitcher";
import AttributeBuilder from "@/components/vendor/variants/AttributeBuilder";
import CombinationReviewModal from "@/components/vendor/variants/CombinationReviewModal";
import VariantTable from "@/components/vendor/variants/VariantTable";
import VariantEditModal from "@/components/vendor/variants/VariantEditModal";
import StockAdjustmentModal from "@/components/vendor/variants/StockAdjustmentModal";
import AddVariantModal from "@/components/vendor/variants/AddVariantModal";
import StorefrontPreviewModal from "@/components/vendor/variants/StorefrontPreviewModal";
import {
  generateCartesianCombinations,
  getAttributeEntries,
} from "@/utils/attribute.util";

/**
 * ProductEditor
 *
 * Comprehensive WooCommerce-inspired product management interface.
 * Unified architecture supporting both Vendor Portal and Admin Catalog Control Plane.
 *
 * @param {Object} props
 * @param {"create"|"edit"} props.mode - Create new or edit existing product
 * @param {"vendor"|"admin"} [props.portal="vendor"] - Current actor portal
 * @param {string} [props.productId] - Target product ID (for mode="edit")
 */
export default function ProductEditor({
  mode = "create",
  portal = "vendor",
  productId = null,
}) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const isAdmin = portal === "admin";

  // Tab State: "basic" | "type" | "images" | "pricing" | "inventory" | "shipping" | "variations" | "seo" | "publishing" | "digital"
  const [activeTab, setActiveTab] = useState("basic");

  // Lookup data
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [categoryAttributes, setCategoryAttributes] = useState([]);

  // Product and Variant Domain State
  const [product, setProduct] = useState(null);
  const [variants, setVariants] = useState([]);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isTypeUpdating, setIsTypeUpdating] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Main Form Data
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    sku: "",
    productType: "simple",
    price: "",
    compareAtPrice: "",
    currency: "INR",
    isTaxable: true,
    taxCategory: "standard",
    stockStatus: "out_of_stock",
    stockQuantity: "10",
    warehouseId: "",
    categoryId: "",
    brandId: "",
    description: "",
    shortDescription: "",
    tags: [],
    images: [],
    specifications: {},
    shippingClass: "",
    dimensions: {
      length: "",
      width: "",
      height: "",
      unit: "cm",
    },
    weight: {
      value: "",
      unit: "kg",
    },
    seo: {
      title: "",
      description: "",
      keywords: [],
    },
    status: "draft",
    isVirtual: false,
    isDownloadable: false,
    downloadableFiles: [],
    downloadLimit: "",
    downloadExpiryDays: "",
  });

  // Tag & Keyword local inputs
  const [tagInput, setTagInput] = useState("");
  const [keywordInput, setKeywordInput] = useState("");

  // Variable product attribute builder state
  const [attributeDefinitions, setAttributeDefinitions] = useState([]);

  // Modals state
  const [combinationReviewOpen, setCombinationReviewOpen] = useState(false);
  const [generatedCombinations, setGeneratedCombinations] = useState([]);
  const [isCreatingBulk, setIsCreatingBulk] = useState(false);
  const [editingVariant, setEditingVariant] = useState(null);
  const [adjustingVariant, setAdjustingVariant] = useState(null);
  const [addSingleVariantOpen, setAddSingleVariantOpen] = useState(false);
  const [storefrontPreviewOpen, setStorefrontPreviewOpen] = useState(false);

  // Digital product files state
  const [isUploadingDigitalFile, setIsUploadingDigitalFile] = useState(false);
  const [digitalUploadError, setDigitalUploadError] = useState(null);
  const [digitalUploadName, setDigitalUploadName] = useState("");
  const [digitalUploadVersion, setDigitalUploadVersion] = useState("1.0");

  const handleDigitalFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingDigitalFile(true);
    setDigitalUploadError(null);

    try {
      const res = await (isAdmin
        ? productService.uploadDigitalAsset(file, { version: digitalUploadVersion || "1.0" })
        : vendorService.uploadDigitalAsset(file, { version: digitalUploadVersion || "1.0" }));

      const assetData = res?.data?.data?.file || res?.data?.file;
      if (!assetData) throw new Error("File upload response missing asset metadata");

      const newFileEntry = {
        id: assetData.id,
        name: digitalUploadName.trim() || assetData.name || file.name,
        fileName: assetData.fileName || file.name,
        fileUrl: assetData.fileUrl || `digital://${assetData.storageKey}`,
        storageKey: assetData.storageKey,
        fileSize: assetData.fileSize || file.size,
        mimeType: assetData.mimeType || file.type || "application/octet-stream",
        version: assetData.version || digitalUploadVersion || "1.0",
        uploadedAt: assetData.uploadedAt || new Date().toISOString(),
      };

      setFormData((prev) => ({
        ...prev,
        downloadableFiles: [...prev.downloadableFiles, newFileEntry],
      }));
      setHasUnsavedChanges(true);
      setDigitalUploadName("");
      toast.success(`Digital file "${file.name}" uploaded securely`);
    } catch (err) {
      console.error("Digital file upload error:", err);
      const msg = err.response?.data?.message || err.message || "Failed to upload digital asset";
      setDigitalUploadError(msg);
      toast.error("Upload failed", { description: msg });
    } finally {
      setIsUploadingDigitalFile(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleRemoveDigitalFile = (fileId) => {
    setFormData((prev) => ({
      ...prev,
      downloadableFiles: prev.downloadableFiles.filter((f) => f.id !== fileId),
    }));
    setHasUnsavedChanges(true);
    toast.info("Digital file removed from product");
  };

  // Re-fetch product data for edit mode
  const refetchProductData = useCallback(async () => {
    if (!isEdit || !productId) return;
    try {
      const res = await (isAdmin
        ? productService.getProductById(productId)
        : vendorService.getProductById(productId));

      const prd = res?.data?.data?.product || res?.data?.product || res?.data;
      if (!prd) return;

      setProduct(prd);
      setFormData((prev) => ({
        ...prev,
        name: prd.name || prd.title || "",
        slug: prd.slug || "",
        sku: prd.sku || "",
        productType: prd.productType || "simple",
        price: prd.price?.toString ? prd.price.toString() : String(prd.price || ""),
        compareAtPrice: prd.compareAtPrice?.toString
          ? prd.compareAtPrice.toString()
          : prd.compareAtPrice != null
          ? String(prd.compareAtPrice)
          : "",
        currency: prd.currency || "INR",
        isTaxable: prd.isTaxable !== false,
        taxCategory: prd.taxCategory || "standard",
        stockStatus: prd.stockStatus || "out_of_stock",
        stockQuantity:
          prd.availableQuantity !== undefined
            ? String(prd.availableQuantity)
            : prd.stockQuantity !== undefined
            ? String(prd.stockQuantity)
            : "0",
        categoryId: prd.categoryId?._id || prd.categoryId || "",
        brandId: prd.brandId?._id || prd.brandId || "",
        description: prd.description || "",
        shortDescription: prd.shortDescription || "",
        tags: Array.isArray(prd.tags) ? prd.tags : [],
        images: Array.isArray(prd.images) ? prd.images : [],
        specifications:
          prd.specifications instanceof Map
            ? Object.fromEntries(prd.specifications)
            : prd.specifications || {},
        shippingClass: prd.shippingClass || "",
        dimensions: {
          length: prd.dimensions?.length != null ? String(prd.dimensions.length) : "",
          width: prd.dimensions?.width != null ? String(prd.dimensions.width) : "",
          height: prd.dimensions?.height != null ? String(prd.dimensions.height) : "",
          unit: prd.dimensions?.unit || "cm",
        },
        weight: {
          value: prd.weight?.value != null ? String(prd.weight.value) : "",
          unit: prd.weight?.unit || "kg",
        },
        seo: {
          title: prd.seo?.title || "",
          description: prd.seo?.description || "",
          keywords: Array.isArray(prd.seo?.keywords) ? prd.seo.keywords : [],
        },
        status: prd.status || "draft",
        isVirtual: Boolean(prd.isVirtual),
        isDownloadable: Boolean(prd.isDownloadable),
        downloadableFiles: Array.isArray(prd.downloadableFiles) ? prd.downloadableFiles : [],
        downloadLimit: prd.downloadLimit != null ? String(prd.downloadLimit) : "",
        downloadExpiryDays: prd.downloadExpiryDays != null ? String(prd.downloadExpiryDays) : "",
      }));

      // Load variants
      try {
        const varRes = await (isAdmin
          ? productService.getVariantsByProductId(prd._id || productId)
          : vendorService.getProductVariants(prd._id || productId));

        const varList = varRes?.data?.data?.variants || varRes?.data?.variants || varRes?.data || [];
        setVariants(Array.isArray(varList) ? varList : []);

        // Derive existing attribute definitions from variants if needed
        if (Array.isArray(varList) && varList.length > 0) {
          const derived = {};
          for (const v of varList) {
            const entries = getAttributeEntries(v.attributes);
            for (const { name, value } of entries) {
              if (!derived[name]) derived[name] = new Set();
              derived[name].add(value);
            }
          }
          const derivedList = Object.entries(derived).map(([name, set]) => ({
            name,
            values: Array.from(set),
          }));
          if (derivedList.length > 0) {
            setAttributeDefinitions((prev) => (prev.length === 0 ? derivedList : prev));
          }
        }
      } catch {
        setVariants([]);
      }
    } catch (err) {
      console.error("Failed to fetch product:", err);
    }
  }, [isEdit, productId, isAdmin]);

  // Initial Lookups Load
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      categoryService.getCategories({ limit: 200 }).catch(() => ({ data: [] })),
      brandService.getBrands({ limit: 200 }).catch(() => ({ data: [] })),
      (isAdmin ? productService.getProducts({ limit: 1 }) : vendorService.getMyWarehouses()).catch(() => ({
        data: [],
      })),
    ]).then(([catRes, brandRes, whRes]) => {
      if (!isMounted) return;
      const catList = catRes?.data?.data?.categories || catRes?.data?.categories || catRes?.data || [];
      const brandList = brandRes?.data?.data?.brands || brandRes?.data?.brands || brandRes?.data || [];
      const whList = whRes?.data?.data?.warehouses || whRes?.data?.warehouses || whRes?.data || [];

      setCategories(Array.isArray(catList) ? catList : []);
      setBrands(Array.isArray(brandList) ? brandList : []);
      setWarehouses(Array.isArray(whList) ? whList : []);
    });

    if (isEdit && productId) {
      refetchProductData().finally(() => {
        if (isMounted) setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [isEdit, productId, refetchProductData, isAdmin]);

  // Load category-specific attributes on category selection
  useEffect(() => {
    if (!formData.categoryId) {
      setCategoryAttributes([]);
      return;
    }
    categoryService
      .getCategoryAttributes(formData.categoryId)
      .then((res) => {
        const list = res?.data?.data || res?.data || [];
        setCategoryAttributes(Array.isArray(list) ? list : []);
      })
      .catch(() => setCategoryAttributes([]));
  }, [formData.categoryId]);

  // Warn before leaving if unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Input change handler
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setHasUnsavedChanges(true);

    if (formErrors[name]) {
      setFormErrors((prev) => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }

    setFormData((prev) => {
      const updated = {
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      };

      // Auto-generate URL slug from product name if slug was not manually set
      if (name === "name" && (!isEdit || !prev.slug)) {
        updated.slug = value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
      }
      return updated;
    });
  };

  // Nested property handlers
  const handleDimensionsChange = (field, value) => {
    setHasUnsavedChanges(true);
    setFormData((prev) => ({
      ...prev,
      dimensions: { ...prev.dimensions, [field]: value },
    }));
  };

  const handleWeightChange = (field, value) => {
    setHasUnsavedChanges(true);
    setFormData((prev) => ({
      ...prev,
      weight: { ...prev.weight, [field]: value },
    }));
  };

  const handleSeoChange = (field, value) => {
    setHasUnsavedChanges(true);
    setFormData((prev) => ({
      ...prev,
      seo: { ...prev.seo, [field]: value },
    }));
  };

  // Tags management
  const handleAddTag = (e) => {
    e.preventDefault();
    const clean = tagInput.trim().toLowerCase();
    if (!clean) return;
    if (!formData.tags.includes(clean)) {
      setHasUnsavedChanges(true);
      setFormData((prev) => ({ ...prev, tags: [...prev.tags, clean] }));
    }
    setTagInput("");
  };

  const handleRemoveTag = (tagToRemove) => {
    setHasUnsavedChanges(true);
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tagToRemove),
    }));
  };

  // SEO Keywords management
  const handleAddKeyword = (e) => {
    e.preventDefault();
    const clean = keywordInput.trim();
    if (!clean) return;
    if (!formData.seo.keywords.includes(clean)) {
      setHasUnsavedChanges(true);
      setFormData((prev) => ({
        ...prev,
        seo: { ...prev.seo, keywords: [...prev.seo.keywords, clean] },
      }));
    }
    setKeywordInput("");
  };

  const handleRemoveKeyword = (kwToRemove) => {
    setHasUnsavedChanges(true);
    setFormData((prev) => ({
      ...prev,
      seo: {
        ...prev.seo,
        keywords: prev.seo.keywords.filter((k) => k !== kwToRemove),
      },
    }));
  };

  // Validate form client-side
  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = "Product name is required";
    if (!formData.sku.trim()) errors.sku = "SKU identifier is required";
    if (!formData.categoryId) errors.categoryId = "Category selection is required";

    const priceNum = parseFloat(formData.price);
    if (isNaN(priceNum) || priceNum < 0) {
      errors.price = "Valid positive selling price is required";
    }

    if (formData.compareAtPrice) {
      const compareNum = parseFloat(formData.compareAtPrice);
      if (isNaN(compareNum) || compareNum < 0) {
        errors.compareAtPrice = "Compare-at price must be a valid positive number";
      } else if (compareNum < priceNum) {
        errors.compareAtPrice =
          "Compare-at (regular MRP) price must be greater than or equal to selling price";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save product payload
  const handleSaveProduct = async (overrideStatus = null) => {
    if (!validateForm()) {
      toast.error("Please resolve validation errors before saving");
      return;
    }

    if (formData.productType === "variable") {
      if (variants.length === 0) {
        toast.error(
          "Variable products must have at least one variant before saving. Please generate or add variants in the Variations tab."
        );
        setActiveTab("variations");
        return;
      }

      // Check variant SKUs and prices
      const skuSet = new Set();
      for (const v of variants) {
        const vSku = (v.sku || "").trim().toUpperCase();
        if (!vSku) {
          toast.error("All variants must have a valid SKU identifier");
          setActiveTab("variations");
          return;
        }
        if (skuSet.has(vSku)) {
          toast.error(`Duplicate variant SKU: "${vSku}". Each variant must have a unique SKU.`);
          setActiveTab("variations");
          return;
        }
        skuSet.add(vSku);

        const vPrice = Number(v.price);
        if (isNaN(vPrice) || vPrice < 0) {
          toast.error(`Variant ${vSku} has an invalid price`);
          setActiveTab("variations");
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const cleanDimensions = {
        length: formData.dimensions.length ? Number(formData.dimensions.length) : null,
        width: formData.dimensions.width ? Number(formData.dimensions.width) : null,
        height: formData.dimensions.height ? Number(formData.dimensions.height) : null,
        unit: formData.dimensions.unit || "cm",
      };

      const cleanWeight = {
        value: formData.weight.value ? Number(formData.weight.value) : null,
        unit: formData.weight.unit || "kg",
      };

      const payload = {
        name: formData.name.trim(),
        title: formData.name.trim(),
        slug:
          formData.slug.trim() ||
          formData.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, ""),
        sku: formData.sku.trim().toUpperCase(),
        productType: formData.productType || "simple",
        price: Number(formData.price),
        compareAtPrice: formData.compareAtPrice ? Number(formData.compareAtPrice) : null,
        currency: formData.currency || "INR",
        isTaxable: Boolean(formData.isTaxable),
        taxCategory: formData.taxCategory,
        categoryId: formData.categoryId,
        brandId: formData.brandId || null,
        description: formData.description.trim(),
        shortDescription: formData.shortDescription.trim(),
        tags: formData.tags,
        images: formData.images,
        specifications: formData.specifications,
        dimensions: cleanDimensions,
        weight: cleanWeight,
        shippingClass: formData.shippingClass || null,
        seo: {
          title: formData.seo.title.trim(),
          description: formData.seo.description.trim(),
          keywords: formData.seo.keywords,
        },
        isVirtual: Boolean(formData.isVirtual),
        isDownloadable: Boolean(formData.isDownloadable),
        downloadableFiles: formData.isDownloadable ? formData.downloadableFiles : [],
        downloadLimit:
          formData.isDownloadable && formData.downloadLimit !== "" && formData.downloadLimit !== null
            ? Number(formData.downloadLimit)
            : null,
        downloadExpiryDays:
          formData.isDownloadable && formData.downloadExpiryDays !== "" && formData.downloadExpiryDays !== null
            ? Number(formData.downloadExpiryDays)
            : null,
      };

      if (!isEdit) {
        payload.stockQuantity = Number(formData.stockQuantity) || 0;
        payload.status = formData.productType === "variable" ? "draft" : (overrideStatus || "draft");
        if (formData.warehouseId) payload.warehouseId = formData.warehouseId;
      } else if (overrideStatus) {
        payload.status = overrideStatus;
      }

      let res;
      if (isEdit) {
        res = await (isAdmin
          ? productService.updateProduct(productId, payload)
          : vendorService.updateProduct(productId, payload));
        toast.success("Product updated successfully");
      } else {
        res = await (isAdmin
          ? productService.createProduct(payload)
          : vendorService.createProduct(payload));
        toast.success("Product created successfully");
      }

      const created = res?.data?.data?.product || res?.data?.product || res?.data;
      const targetId = isEdit ? productId : (created?._id || created?.secureId);

      // Provision variants if variable product in create mode
      if (!isEdit && formData.productType === "variable" && variants.length > 0 && targetId) {
        const cleanVariants = variants.map((v) => ({
          sku: v.sku.trim().toUpperCase(),
          name: v.name || `${formData.name} - ${v.sku}`,
          attributes: v.attributes,
          price: Number(v.price),
          compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : null,
          stockQuantity: Number(v.stockQuantity) || 0,
          warehouseId: v.warehouseId || formData.warehouseId || null,
          image: v.image || null,
          isActive: v.isActive !== false,
        }));

        if (isAdmin) {
          await productService.createBulkVariants(targetId, { variants: cleanVariants });
        } else {
          await vendorService.createBulkProductVariants(targetId, { variants: cleanVariants });
        }

        // If user requested active publishing on creation and has permission
        if (overrideStatus === "active") {
          try {
            await (isAdmin
              ? productService.updateProduct(targetId, { status: "active" })
              : vendorService.updateProduct(targetId, { status: "active" }));
          } catch {
            // Ignore if requires approval flow
          }
        }
      }

      setHasUnsavedChanges(false);

      if (!isEdit && created) {
        const routeId = created.secureId || created._id;
        const isAdministratorPath = typeof window !== "undefined" && window.location.pathname.startsWith("/administrator");
        const targetUrl = isAdministratorPath
          ? `/administrator/catalog/products/${routeId}`
          : isAdmin
          ? `/admin/catalog/products/${routeId}`
          : getVendorProductUrl(routeId);
        router.push(targetUrl);
      } else {
        refetchProductData();
      }
    } catch (err) {
      console.error("Save product error:", err);
      toast.error(isEdit ? "Failed to update product" : "Failed to create product", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsSubmitting(false);
      setIsSavingDraft(false);
    }
  };

  // Product Type Switcher
  const handleProductTypeChange = async (newType) => {
    if (!isEdit) {
      setFormData((prev) => ({ ...prev, productType: newType }));
      if (newType === "variable") {
        toast.info("Variable Product selected. Variations section is now active.");
        setActiveTab("variations");
      }
      return;
    }

    setIsTypeUpdating(true);
    try {
      await (isAdmin
        ? productService.updateProduct(productId, { productType: newType })
        : vendorService.updateProduct(productId, { productType: newType }));

      toast.success(
        `Product successfully converted to ${
          newType === "variable" ? "Variable Product" : "Simple Product"
        }`
      );
      setFormData((prev) => ({ ...prev, productType: newType }));
      if (newType === "variable") {
        setActiveTab("variations");
      }
      refetchProductData();
    } catch (err) {
      toast.error("Failed to transition product type", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsTypeUpdating(false);
    }
  };

  // Variable Cartesian Generator Trigger
  const handleGenerateCombinations = () => {
    const combos = generateCartesianCombinations(attributeDefinitions);
    if (combos.length === 0) {
      toast.warning("Define at least one attribute with values to generate variations");
      return;
    }
    setGeneratedCombinations(combos);
    setCombinationReviewOpen(true);
  };

  // Commit Bulk Variants from Review Modal
  const handleCommitBulkVariants = async (variantsPayload) => {
    if (!isEdit || !productId) {
      const newVariants = variantsPayload.map((v, i) => ({
        _id: `staged-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        isStaged: true,
        productId: null,
        ...v,
      }));
      setVariants(newVariants);
      setHasUnsavedChanges(true);
      setCombinationReviewOpen(false);
      toast.success(`Generated ${newVariants.length} variations ready for listing`);
      return;
    }

    setIsCreatingBulk(true);
    try {
      await (isAdmin
        ? productService.createBulkVariants(productId, { variants: variantsPayload })
        : vendorService.createBulkProductVariants(productId, {
            variants: variantsPayload,
          }));

      toast.success(`Successfully created ${variantsPayload.length} variations`);
      setCombinationReviewOpen(false);
      refetchProductData();
    } catch (err) {
      toast.error("Failed to provision variations batch", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsCreatingBulk(false);
    }
  };

  // Staged variation handlers for create mode
  const handleUpdateStagedVariants = (updatedVariants) => {
    setVariants(updatedVariants);
    setHasUnsavedChanges(true);
  };

  const handleDeleteStagedVariant = (variantId) => {
    setVariants((prev) => prev.filter((v) => v._id !== variantId));
    setHasUnsavedChanges(true);
  };

  const handleAddStagedVariant = (variantPayload) => {
    const newVar = {
      _id: `staged-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      isStaged: true,
      productId: null,
      ...variantPayload,
    };
    setVariants((prev) => [...prev, newVar]);
    setHasUnsavedChanges(true);
  };

  // Submit for approval (Vendor Draft)
  const handleSubmitForApproval = async () => {
    setIsSubmitting(true);
    try {
      await vendorService.submitProductForApproval(productId);
      toast.success("Product submitted for marketplace approval");
      refetchProductData();
    } catch (err) {
      toast.error("Failed to submit for approval", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Admin Direct Approve
  const handleAdminApprove = async () => {
    setIsSubmitting(true);
    try {
      await productService.updateProduct(productId, { status: "active" });
      toast.success("Product approved and published to storefront");
      refetchProductData();
    } catch (err) {
      toast.error("Failed to approve product", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="h-6 w-36 bg-slate-200 rounded-lg animate-pulse" />
        <div className="h-28 bg-slate-200 rounded-3xl animate-pulse" />
        <div className="h-96 bg-slate-200 rounded-3xl animate-pulse" />
      </div>
    );
  }

  const isVariable = formData.productType === "variable";
  const canonicalVariant = variants.find((v) => v.isDefault) || variants[0] || null;
  const isDraft = formData.status === "draft";
  const isActive = formData.status === "active";
  const isAdministratorPath = typeof window !== "undefined" && window.location.pathname.startsWith("/administrator");
  const backCatalogUrl = isAdministratorPath
    ? "/administrator/catalog/products"
    : isAdmin
    ? "/admin/catalog/products"
    : "/vendor/products";

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Top Header Bar */}
      <div>
        <div className="flex items-center justify-between gap-4 mb-2">
          <Link
            href={backCatalogUrl}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to {isAdmin ? "Admin Catalog" : "Product Catalog"}</span>
          </Link>

          {hasUnsavedChanges && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
              <AlertCircle className="size-3 text-amber-600" />
              Unsaved Changes
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {isEdit
                  ? formData.name || "Edit Product"
                  : "Add New Product"}
              </h1>
              <span
                className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : isDraft
                    ? "bg-slate-100 text-slate-700 border border-slate-200"
                    : formData.status === "pending_approval"
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-rose-50 text-rose-700 border border-rose-200"
                }`}
              >
                {formData.status?.replace("_", " ")}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                {formData.productType} Product
              </span>
            </div>

            <p className="text-xs text-slate-500 font-mono">
              SKU: {formData.sku || "UNASSIGNED"} • Slug: /{formData.slug || "auto"}
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-2">
            {isEdit && isActive && (formData.slug || initialData?.slug || initialData?.secureId || initialData?._id) && (
              <Link
                href={`/product/${encodeURIComponent(formData.slug || initialData?.slug || initialData?.secureId || initialData?._id)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-all"
              >
                <ExternalLink className="size-3.5" />
                <span>Storefront</span>
              </Link>
            )}

            {!isAdmin && isEdit && isDraft && (
              <button
                type="button"
                onClick={handleSubmitForApproval}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50"
              >
                <Send className="size-3.5" />
                <span>Submit for Approval</span>
              </button>
            )}

            {isAdmin && isEdit && formData.status === "pending_approval" && (
              <button
                type="button"
                onClick={handleAdminApprove}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50"
              >
                <ShieldCheck className="size-3.5" />
                <span>Approve &amp; Publish</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSaveProduct(null)}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-[#007A55] hover:bg-[#006346] active:scale-95 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              <span>{isEdit ? "Update Product" : "Publish Listing"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* WooCommerce-Style Product Editor Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Navigation Sidebar Tabs */}
        <div className="lg:col-span-1 bg-white rounded-3xl border border-slate-200/80 p-2 shadow-xs space-y-1">
          <div className="px-3 py-2 border-b border-slate-100 mb-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Product Settings Tabs
            </span>
          </div>

          {[
            { id: "basic", label: "Basic Info", icon: Package },
            { id: "type", label: "Product Type", icon: Layers },
            {
              id: "images",
              label: `Images (${formData.images.length})`,
              icon: ImageIcon,
            },
            { id: "pricing", label: "Pricing & Taxes", icon: DollarSign },
            { id: "inventory", label: "Inventory & Stock", icon: Warehouse },
            { id: "shipping", label: "Shipping & Dimensions", icon: Truck },
            ...(isVariable
              ? [
                  {
                    id: "variations",
                    label: `Variations (${variants.length})`,
                    icon: Boxes,
                  },
                ]
              : []),
            { id: "seo", label: "Search Engine (SEO)", icon: Globe },
            { id: "digital", label: "Digital Settings", icon: FileText },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                activeTab === id
                  ? "bg-[#007A55] text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon className={`size-4 shrink-0 ${activeTab === id ? "text-white" : "text-slate-400"}`} />
                <span className="truncate">{label}</span>
              </div>
              <ChevronRight className="size-3.5 shrink-0 opacity-60" />
            </button>
          ))}
        </div>

        {/* Tab Content Panes */}
        <div className="lg:col-span-3 space-y-6">
          {/* TAB 1: BASIC INFORMATION */}
          {activeTab === "basic" && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5 animate-in fade-in duration-100">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">
                  Basic Product Information
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Core identification details displayed to customers across search and browse listings.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Product Title / Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g. Ergonomic Premium Wireless Mechanical Keyboard"
                    className={`w-full px-3.5 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                      formErrors.name ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
                    }`}
                  />
                  {formErrors.name && (
                    <span className="text-[11px] text-rose-500 font-semibold mt-1 block">
                      {formErrors.name}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    SKU (Master Stock Identifier) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="sku"
                    value={formData.sku}
                    onChange={handleInputChange}
                    placeholder="e.g. KEYB-PRO-001"
                    className={`w-full px-3.5 py-2 rounded-xl border text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                      formErrors.sku ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
                    }`}
                  />
                  {formErrors.sku && (
                    <span className="text-[11px] text-rose-500 font-semibold mt-1 block">
                      {formErrors.sku}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    URL Slug
                  </label>
                  <input
                    type="text"
                    name="slug"
                    value={formData.slug}
                    onChange={handleInputChange}
                    placeholder="e.g. ergonomic-premium-keyboard"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Catalog Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    name="categoryId"
                    value={formData.categoryId}
                    onChange={handleInputChange}
                    className={`w-full px-3.5 py-2 rounded-xl border text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                      formErrors.categoryId ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
                    }`}
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {formErrors.categoryId && (
                    <span className="text-[11px] text-rose-500 font-semibold mt-1 block">
                      {formErrors.categoryId}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Brand Association
                  </label>
                  <select
                    name="brandId"
                    value={formData.brandId}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="">No Brand (Generic / Unbranded)</option>
                    {brands.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Short Description (Snippet on search cards)
                  </label>
                  <input
                    type="text"
                    name="shortDescription"
                    value={formData.shortDescription}
                    onChange={handleInputChange}
                    placeholder="Concise overview highlighting key selling proposition..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Description (Markdown or formatted details)
                  </label>
                  <textarea
                    rows={6}
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Enter detailed technical features, materials, care instructions, and package contents..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                {/* Catalog Search Tags */}
                <div className="sm:col-span-2 space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Product Search Tags
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddTag(e)}
                      placeholder="Add tag and press Enter (e.g. bluetooth, gaming, usb-c)"
                      className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      className="px-4 py-2 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700"
                    >
                      Add Tag
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {formData.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700"
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-rose-600"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRODUCT TYPE */}
          {activeTab === "type" && (
            <div className="space-y-6 animate-in fade-in duration-100">
              <ProductTypeSwitcher
                currentType={formData.productType}
                activeVariantsCount={
                  variants.filter((v) => v.isActive !== false && !v.isDefault).length
                }
                hasActiveReservations={variants.some((v) => (v.reserved || 0) > 0)}
                onTypeChange={handleProductTypeChange}
                isUpdating={isTypeUpdating}
                isVirtual={formData.isVirtual}
                isDownloadable={formData.isDownloadable}
                onVirtualChange={(val) => {
                  setFormData((prev) => ({ ...prev, isVirtual: val }));
                  setHasUnsavedChanges(true);
                }}
                onDownloadableChange={(val) => {
                  setFormData((prev) => ({ ...prev, isDownloadable: val }));
                  setHasUnsavedChanges(true);
                }}
                onOpenVariations={() => setActiveTab("variations")}
              />

              {isVariable && (
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Boxes className="size-4 text-emerald-700" />
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Variations Setup ({variants.length} defined)
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {variants.length > 0
                          ? `${variants.length} variation(s) currently configured with unique SKUs and prices.`
                          : "Configure attributes (Size, Color, Material, Storage) and generate variant combinations."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("variations")}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-bold shadow-xs transition-colors shrink-0"
                    >
                      <span>Open Variations Matrix</span>
                      <ChevronRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Type Characteristics
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                    <span className="font-bold text-slate-900 block">Simple Product</span>
                    <p className="text-[11px] text-slate-500">
                      Ideal for standalone goods without variation choices (e.g., a standard book, a single-spec cable). Tracks stock under one canonical SKU with direct warehouse assignments.
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                    <span className="font-bold text-slate-900 block">Variable Product</span>
                    <p className="text-[11px] text-slate-500">
                      Ideal for apparel, electronics with storage options, or footwear. Allows configuring multiple attributes (Size, Color) and managing individual SKUs, prices, images, and inventory for each combination.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: IMAGES AND GALLERY */}
          {activeTab === "images" && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 animate-in fade-in duration-100">
              <ImageGalleryManager
                images={formData.images}
                onChange={(updatedImages) => {
                  setHasUnsavedChanges(true);
                  setFormData((prev) => ({ ...prev, images: updatedImages }));
                }}
              />
            </div>
          )}

          {/* TAB 4: PRICING AND TAXES */}
          {activeTab === "pricing" && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5 animate-in fade-in duration-100">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">
                  Pricing &amp; Tax Configuration
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set baseline prices, strikethrough compare-at amounts, and GST classification.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Selling Price (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    className={`w-full px-3.5 py-2 rounded-xl border font-bold text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                      formErrors.price ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
                    }`}
                  />
                  {formErrors.price && (
                    <span className="text-[11px] text-rose-500 font-semibold mt-1 block">
                      {formErrors.price}
                    </span>
                  )}
                  {isVariable && (
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Parent display price is synchronized with the lowest variant price.
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Compare-at / Regular MRP (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="compareAtPrice"
                    value={formData.compareAtPrice}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    className={`w-full px-3.5 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                      formErrors.compareAtPrice ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
                    }`}
                  />
                  {formErrors.compareAtPrice && (
                    <span className="text-[11px] text-rose-500 font-semibold mt-1 block">
                      {formErrors.compareAtPrice}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tax Category (GST)
                  </label>
                  <select
                    name="taxCategory"
                    value={formData.taxCategory}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="standard">Standard GST (18%)</option>
                    <option value="reduced">Reduced GST (12%)</option>
                    <option value="essential">Essential GST (5%)</option>
                    <option value="zero">Zero Rate (0%)</option>
                    <option value="exempt">Exempt</option>
                  </select>
                </div>

                <div className="sm:col-span-3 pt-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      name="isTaxable"
                      checked={formData.isTaxable}
                      onChange={handleInputChange}
                      className="size-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>This product is subject to applicable Indian Goods and Services Tax (GST)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: INVENTORY AND AUTHORITATIVE STOCK */}
          {activeTab === "inventory" && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5 animate-in fade-in duration-100">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Warehouse className="size-4 text-emerald-700" />
                    <span>Warehouse Inventory Control</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Physical stock quantities are authoritatively tracked per warehouse location.
                  </p>
                </div>

                {isEdit && canonicalVariant && !isVariable && (
                  <button
                    type="button"
                    onClick={() => setAdjustingVariant(canonicalVariant)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#007A55] hover:bg-[#006346] text-white text-xs font-bold shadow-xs"
                  >
                    <Warehouse className="size-3.5" />
                    <span>Adjust Physical Stock</span>
                  </button>
                )}
              </div>

              {!isEdit ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Initial Warehouse Location
                    </label>
                    <select
                      name="warehouseId"
                      value={formData.warehouseId}
                      onChange={handleInputChange}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    >
                      <option value="">Default Primary Warehouse</option>
                      {warehouses.map((w) => (
                        <option key={w._id} value={w._id}>
                          {w.name} ({w.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Initial On-Hand Physical Stock
                    </label>
                    <input
                      type="number"
                      name="stockQuantity"
                      min="0"
                      value={formData.stockQuantity}
                      onChange={handleInputChange}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 font-bold"
                    />
                  </div>
                </div>
              ) : isVariable ? (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
                  <span className="font-bold text-slate-900 block">
                    Variable Product Stock Notice:
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Because this is a variable product, physical warehouse inventory is maintained individually per variation on the <strong>Variations</strong> tab.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("variations")}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#007A55] text-white font-bold text-xs"
                  >
                    Go to Variations Matrix →
                  </button>
                </div>
              ) : (
                /* Simple Product Authoritative Inventory Display */
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="block text-[10px] uppercase font-bold text-slate-500">
                      Physical On-Hand
                    </span>
                    <span className="font-mono font-bold text-slate-900 text-lg">
                      {canonicalVariant?.onHand ?? canonicalVariant?.stockQuantity ?? 0}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200">
                    <span className="block text-[10px] uppercase font-bold text-amber-700">
                      Reserved Customer Stock
                    </span>
                    <span className="font-mono font-bold text-amber-800 text-lg">
                      {canonicalVariant?.reserved ?? 0}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200">
                    <span className="block text-[10px] uppercase font-bold text-emerald-700">
                      Available to Sell
                    </span>
                    <span className="font-mono font-bold text-emerald-800 text-lg">
                      {canonicalVariant?.availableQuantity ??
                        Math.max(
                          0,
                          (canonicalVariant?.onHand ?? canonicalVariant?.stockQuantity ?? 0) -
                            (canonicalVariant?.reserved ?? 0)
                        )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: SHIPPING AND DIMENSIONS */}
          {activeTab === "shipping" && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5 animate-in fade-in duration-100">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">
                  Shipping, Weight &amp; Package Dimensions
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Accurate package measurements ensure valid logistics quotes and courier manifest generation.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Weight */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Product Package Weight
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.weight.value}
                      onChange={(e) => handleWeightChange("value", e.target.value)}
                      placeholder="0.00"
                      className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 font-bold"
                    />
                    <select
                      value={formData.weight.unit}
                      onChange={(e) => handleWeightChange("unit", e.target.value)}
                      className="w-24 px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-bold"
                    >
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="lb">lb</option>
                      <option value="oz">oz</option>
                    </select>
                  </div>
                </div>

                {/* Shipping Class */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Shipping Class
                  </label>
                  <input
                    type="text"
                    name="shippingClass"
                    value={formData.shippingClass}
                    onChange={handleInputChange}
                    placeholder="e.g. Standard Freight, Fragile, Express"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                {/* Dimensions */}
                <div className="sm:col-span-2 space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Dimensions (L × W × H)
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.dimensions.length}
                      onChange={(e) => handleDimensionsChange("length", e.target.value)}
                      placeholder="Length"
                      className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.dimensions.width}
                      onChange={(e) => handleDimensionsChange("width", e.target.value)}
                      placeholder="Width"
                      className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.dimensions.height}
                      onChange={(e) => handleDimensionsChange("height", e.target.value)}
                      placeholder="Height"
                      className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                    <select
                      value={formData.dimensions.unit}
                      onChange={(e) => handleDimensionsChange("unit", e.target.value)}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-bold"
                    >
                      <option value="cm">cm</option>
                      <option value="in">in</option>
                      <option value="mm">mm</option>
                      <option value="m">m</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: VARIATIONS (FOR VARIABLE PRODUCTS) */}
          {activeTab === "variations" && isVariable && (
            <div className="space-y-6 animate-in fade-in duration-100">
              {/* 1. Attribute Builder */}
              <AttributeBuilder
                attributes={attributeDefinitions}
                onChange={(updated) => {
                  setAttributeDefinitions(updated);
                  setHasUnsavedChanges(true);
                }}
                onGenerateClick={handleGenerateCombinations}
                isGenerating={isCreatingBulk}
              />

              {/* 2. Variation Matrix Table */}
              <VariantTable
                productId={productId}
                variants={variants}
                onRefresh={refetchProductData}
                onOpenEdit={(v) => setEditingVariant(v)}
                onOpenStockAdjustment={(v) => setAdjustingVariant(v)}
                onOpenAddSingle={() => setAddSingleVariantOpen(true)}
                onOpenStorefrontPreview={() => setStorefrontPreviewOpen(true)}
                portal={portal}
                onUpdateVariants={handleUpdateStagedVariants}
                onDeleteVariant={handleDeleteStagedVariant}
              />
            </div>
          )}

          {/* TAB 8: SEARCH ENGINE OPTIMIZATION (SEO) */}
          {activeTab === "seo" && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5 animate-in fade-in duration-100">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">
                  Search Engine Optimization (SEO) &amp; Open Graph
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Optimize meta tags to maximize organic visibility on Google, Bing, and social sharing cards.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      SEO Meta Title
                    </label>
                    <span className="text-[10px] text-slate-400">
                      {formData.seo.title.length}/200 chars
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={200}
                    value={formData.seo.title}
                    onChange={(e) => handleSeoChange("title", e.target.value)}
                    placeholder="e.g. Buy Premium Ergonomic Wireless Keyboard Online | Buybox"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      SEO Meta Description
                    </label>
                    <span className="text-[10px] text-slate-400">
                      {formData.seo.description.length}/500 chars
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={formData.seo.description}
                    onChange={(e) => handleSeoChange("description", e.target.value)}
                    placeholder="Explore high-precision wireless typing with our ergonomic mechanical keyboard. Free shipping and 1-year warranty on Buybox."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    SEO Keywords
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddKeyword(e)}
                      placeholder="Add keyword and press Enter"
                      className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={handleAddKeyword}
                      className="px-4 py-2 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {formData.seo.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700"
                      >
                        {kw}
                        <button
                          type="button"
                          onClick={() => handleRemoveKeyword(kw)}
                          className="hover:text-rose-600"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Google Snippet Search Preview */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1 mt-4">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Google Search Result Preview
                  </span>
                  <div className="text-blue-700 text-sm font-semibold truncate hover:underline cursor-pointer">
                    {formData.seo.title || formData.name || "Product Name | Buybox"}
                  </div>
                  <div className="text-emerald-700 text-xs font-mono truncate">
                    https://buybox.market/product/{formData.slug || "product-url"}
                  </div>
                  <div className="text-slate-600 text-xs line-clamp-2">
                    {formData.seo.description ||
                      formData.shortDescription ||
                      "View product specifications, pricing, and availability on Buybox Marketplace."}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: DIGITAL & ADVANCED SETTINGS */}
          {activeTab === "digital" && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-6 animate-in fade-in duration-100">
              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Digital Product &amp; Secure Download Fulfillment
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure virtual goods, attach downloadable files, and establish authoritative download limits and access expiration.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <ShieldCheck className="size-3.5 text-emerald-600" />
                    <span>Protected Fulfillment</span>
                  </span>
                </div>
              </div>

              {/* Product Classification Toggles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Virtual Product Card */}
                <div
                  onClick={() => {
                    setFormData((prev) => ({ ...prev, isVirtual: !prev.isVirtual }));
                    setHasUnsavedChanges(true);
                  }}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
                    formData.isVirtual
                      ? "border-[#007A55] bg-emerald-50/30"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.isVirtual}
                    onChange={(e) => {
                      e.stopPropagation();
                      setFormData((prev) => ({ ...prev, isVirtual: e.target.checked }));
                      setHasUnsavedChanges(true);
                    }}
                    className="mt-0.5 size-4 rounded text-[#007A55] focus:ring-[#007A55] border-slate-300"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">Virtual Product</span>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600">
                        No Physical Shipping
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Virtual products do not require physical courier dispatch. Shipping fees and physical warehouse reservations are waived during customer checkout.
                    </p>
                  </div>
                </div>

                {/* 2. Downloadable Product Card */}
                <div
                  onClick={() => {
                    setFormData((prev) => ({ ...prev, isDownloadable: !prev.isDownloadable }));
                    setHasUnsavedChanges(true);
                  }}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
                    formData.isDownloadable
                      ? "border-[#007A55] bg-emerald-50/30"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.isDownloadable}
                    onChange={(e) => {
                      e.stopPropagation();
                      setFormData((prev) => ({ ...prev, isDownloadable: e.target.checked }));
                      setHasUnsavedChanges(true);
                    }}
                    className="mt-0.5 size-4 rounded text-[#007A55] focus:ring-[#007A55] border-slate-300"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">Downloadable Product</span>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">
                        Digital Files Attached
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Customers automatically receive verified download entitlements upon confirmed payment capture in their customer account.
                    </p>
                  </div>
                </div>
              </div>

              {/* Downloadable Assets & Management Section */}
              {formData.isDownloadable && (
                <div className="space-y-6 pt-2 border-t border-slate-100 animate-in fade-in duration-150">
                  {/* File Upload Box */}
                  <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                        <Upload className="size-4 text-[#007A55]" />
                        <span>Upload Digital Asset File</span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Max file size: 50MB (PDF, ZIP, Audio, Video, Software)
                      </span>
                    </div>

                    {digitalUploadError && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                        <AlertCircle className="size-4 shrink-0 text-rose-600" />
                        <span>{digitalUploadError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          File Display Label / Title (Optional)
                        </label>
                        <input
                          type="text"
                          value={digitalUploadName}
                          onChange={(e) => setDigitalUploadName(e.target.value)}
                          placeholder="e.g. Masterclass PDF Guide, High-Res Assets Bundle"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#007A55] bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Version Tag
                        </label>
                        <input
                          type="text"
                          value={digitalUploadVersion}
                          onChange={(e) => setDigitalUploadVersion(e.target.value)}
                          placeholder="1.0"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#007A55] bg-white font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="relative flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-2xl bg-white hover:border-[#007A55] hover:bg-emerald-50/10 transition-all cursor-pointer group">
                        <input
                          type="file"
                          onChange={handleDigitalFileUpload}
                          disabled={isUploadingDigitalFile}
                          className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                        />
                        {isUploadingDigitalFile ? (
                          <div className="flex flex-col items-center gap-2 text-xs font-semibold text-[#007A55]">
                            <Loader2 className="size-6 animate-spin" />
                            <span>Securing and encrypting digital asset into private storage...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 text-center">
                            <div className="p-2.5 rounded-full bg-slate-100 group-hover:bg-emerald-100 text-slate-600 group-hover:text-[#007A55] transition-colors">
                              <Upload className="size-5" />
                            </div>
                            <span className="text-xs font-bold text-slate-700">
                              Click to browse or drop digital file here
                            </span>
                            <span className="text-[11px] text-slate-400">
                              All uploaded files are stored in private isolated storage and streamed with authentication
                            </span>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Attached Files List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Attached Downloadable Files ({formData.downloadableFiles.length})
                      </h4>
                      {formData.downloadableFiles.length > 0 && (
                        <span className="text-[11px] text-slate-500">
                          Total files eligible for download upon purchase
                        </span>
                      )}
                    </div>

                    {formData.downloadableFiles.length === 0 ? (
                      <div className="p-8 rounded-2xl border border-dashed border-slate-200 text-center space-y-2 bg-slate-50/50">
                        <HardDrive className="size-8 text-slate-300 mx-auto" />
                        <p className="text-xs font-semibold text-slate-600">
                          No downloadable files attached yet
                        </p>
                        <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                          Upload at least one file above so customers receive download access after completing checkout.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 uppercase font-bold">
                              <th className="py-2.5 px-4">File Name / Label</th>
                              <th className="py-2.5 px-4">Version</th>
                              <th className="py-2.5 px-4">File Size</th>
                              <th className="py-2.5 px-4">MIME Type</th>
                              <th className="py-2.5 px-4 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {formData.downloadableFiles.map((f, idx) => (
                              <tr key={f.id || idx} className="hover:bg-slate-50/60 transition-colors">
                                <td className="py-3 px-4 font-bold text-slate-800">
                                  <div className="flex items-center gap-2">
                                    <FileCheck className="size-4 text-[#007A55] shrink-0" />
                                    <div>
                                      <span>{f.name}</span>
                                      {f.fileName && f.fileName !== f.name && (
                                        <div className="text-[10px] font-mono text-slate-400">
                                          {f.fileName}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                                    v{f.version || "1.0"}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-600 font-mono">
                                  {f.fileSize
                                    ? f.fileSize > 1024 * 1024
                                      ? `${(f.fileSize / (1024 * 1024)).toFixed(2)} MB`
                                      : `${Math.round(f.fileSize / 1024)} KB`
                                    : "—"}
                                </td>
                                <td className="py-3 px-4 text-slate-500 font-mono text-[11px] truncate max-w-[120px]">
                                  {f.mimeType || "application/octet-stream"}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveDigitalFile(f.id)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                    title="Remove digital file"
                                  >
                                    <Trash2 className="size-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Download Limits & Expiration Rules */}
                  <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Authoritative Fulfillment &amp; Download Restrictions
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Download Limit (per customer)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={formData.downloadLimit}
                          onChange={(e) => {
                            setFormData((prev) => ({ ...prev, downloadLimit: e.target.value }));
                            setHasUnsavedChanges(true);
                          }}
                          placeholder="Unlimited"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#007A55]"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">
                          Leave blank or 0 for unlimited downloads per verified purchase.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Download Expiration (Days)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={formData.downloadExpiryDays}
                          onChange={(e) => {
                            setFormData((prev) => ({ ...prev, downloadExpiryDays: e.target.value }));
                            setHasUnsavedChanges(true);
                          }}
                          placeholder="Never expires"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#007A55]"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">
                          Leave blank or 0 for lifetime customer access without expiration.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Information & Architecture Notice */}
              <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 text-xs text-emerald-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-800">
                  <Info className="size-4 shrink-0 text-[#007A55]" />
                  <span>Digital Fulfillment Architecture &amp; Lifecycle Policy</span>
                </div>
                <p className="text-[11px] text-emerald-800/90 leading-relaxed">
                  <strong>Entitlement Creation:</strong> Download entitlements are provisioned idempotently upon payment capture. Customer identity and ownership are verified on every single download request.
                </p>
                <p className="text-[11px] text-emerald-800/90 leading-relaxed">
                  <strong>Refund &amp; Cancellation Policy:</strong> Full order cancellations or full refunds immediately revoke future download access. Atomic counter updates protect against concurrent race condition exploits.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {/* 1. Combination Review Modal */}
      <CombinationReviewModal
        isOpen={combinationReviewOpen}
        onClose={() => setCombinationReviewOpen(false)}
        combinations={generatedCombinations}
        parentProduct={{ ...formData, _id: productId }}
        warehouses={warehouses}
        onSubmit={handleCommitBulkVariants}
        isSubmitting={isCreatingBulk}
        existingVariants={variants}
      />

      {/* 2. Full Variant Edit Modal */}
      <VariantEditModal
        isOpen={Boolean(editingVariant)}
        onClose={() => setEditingVariant(null)}
        variant={editingVariant}
        onSuccess={refetchProductData}
        onOpenStockAdjustment={(v) => setAdjustingVariant(v)}
        portal={portal}
        onUpdateStagedVariant={(id, fields) => {
          setVariants((prev) =>
            prev.map((v) => (v._id === id ? { ...v, ...fields } : v))
          );
          setHasUnsavedChanges(true);
        }}
      />

      {/* 3. Physical Warehouse Stock Adjustment Modal */}
      <StockAdjustmentModal
        isOpen={Boolean(adjustingVariant)}
        onClose={() => setAdjustingVariant(null)}
        variant={adjustingVariant}
        onSuccess={refetchProductData}
      />

      {/* 4. Add Single Variation Modal */}
      <AddVariantModal
        isOpen={addSingleVariantOpen}
        onClose={() => setAddSingleVariantOpen(false)}
        productId={productId}
        parentSku={formData.sku}
        attributes={attributeDefinitions}
        warehouses={warehouses}
        onSuccess={refetchProductData}
        portal={portal}
        onAddStagedVariant={handleAddStagedVariant}
      />

      {/* 5. Storefront Customer Simulation Preview Modal */}
      <StorefrontPreviewModal
        isOpen={storefrontPreviewOpen}
        onClose={() => setStorefrontPreviewOpen(false)}
        product={{ ...formData, _id: productId }}
        variants={variants}
      />
    </div>
  );
}
