"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Boxes,
  Warehouse,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ArrowUpRight,
  Package,
  Plus,
  Minus,
  X,
  Loader2,
  Sliders,
  ArrowRightLeft,
  Truck,
  FileText,
  History,
  ShieldCheck,
  Check,
  Clock,
  ExternalLink,
  ChevronRight,
  Info,
  Calendar,
  Layers,
  Sparkles,
  ClipboardList,
  ClipboardCheck,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  BarChart2,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";
import { getVendorProductUrl } from "@/utils/secure-id.util";
import VendorTablePagination from "@/components/vendor/VendorTablePagination";
import {
  VendorPageHeader,
  VendorKpiCard,
  VendorStatusBadge,
  VendorEmptyState,
  WarehouseAnalyticsTab,
} from "@/components/vendor";

const ADJUSTMENT_REASONS = [
  { value: "physical_count_correction", label: "Physical Count Correction / Audit" },
  { value: "damaged", label: "Damaged Stock (In-Facility / Handling)" },
  { value: "lost", label: "Lost / Missing Inventory" },
  { value: "found", label: "Found / Recovered Stock" },
  { value: "expired", label: "Expired Stock / Shelf-Life Reached" },
  { value: "data_correction", label: "Data Entry / Discrepancy Correction" },
  { value: "other", label: "Other Authorized Reason" },
];

export default function VendorInventoryPage() {
  const [activeTab, setActiveTab] = useState("inventory"); // "inventory" | "receiving" | "transfers" | "movements" | "counts" | "reconciliation" | "analytics"

  // URL Tab Synchronization
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get("tab");
      if (
        tabParam &&
        ["inventory", "receiving", "transfers", "movements", "counts", "reconciliation", "analytics"].includes(tabParam)
      ) {
        setActiveTab(tabParam);
      }
    }
  }, []);

  // ==========================================
  // SHARED & LIVE INVENTORY STATE
  // ==========================================
  const [inventory, setInventory] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("all");
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);

  // Stock Adjustment Modal State
  const [adjustModalItem, setAdjustModalItem] = useState(null);
  const [adjustDelta, setAdjustDelta] = useState(1);
  const [adjustType, setAdjustType] = useState("add"); // "add" | "remove"
  const [adjustReason, setAdjustReason] = useState("physical_count_correction");
  const [adjustCondition, setAdjustCondition] = useState("sellable");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Threshold Configuration Modal State
  const [thresholdModalItem, setThresholdModalItem] = useState(null);
  const [newThreshold, setNewThreshold] = useState(5);
  const [newReorderLevel, setNewReorderLevel] = useState(10);
  const [isUpdatingThreshold, setIsUpdatingThreshold] = useState(false);

  // ==========================================
  // GOODS RECEIVING STATE
  // ==========================================
  const [receivingList, setReceivingList] = useState([]);
  const [receivingMeta, setReceivingMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [receivingSearch, setReceivingSearch] = useState("");
  const [receivingStatus, setReceivingStatus] = useState("all");
  const [isReceivingLoading, setIsReceivingLoading] = useState(false);
  const [isNewReceivingModalOpen, setIsNewReceivingModalOpen] = useState(false);
  const [newReceivingWarehouse, setNewReceivingWarehouse] = useState("");
  const [newReceivingSupplier, setNewReceivingSupplier] = useState("");
  const [newReceivingRefDoc, setNewReceivingRefDoc] = useState("");
  const [newReceivingVariantId, setNewReceivingVariantId] = useState("");
  const [newReceivingQty, setNewReceivingQty] = useState(10);
  const [newReceivingNotes, setNewReceivingNotes] = useState("");
  const [newReceivingAutoConfirm, setNewReceivingAutoConfirm] = useState(false);
  const [isSubmittingReceiving, setIsSubmittingReceiving] = useState(false);

  // ==========================================
  // STOCK TRANSFERS STATE
  // ==========================================
  const [transfersList, setTransfersList] = useState([]);
  const [transfersMeta, setTransfersMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [transfersSearch, setTransfersSearch] = useState("");
  const [transfersStatus, setTransfersStatus] = useState("all");
  const [transfersWarehouse, setTransfersWarehouse] = useState("all");
  const [isTransfersLoading, setIsTransfersLoading] = useState(false);
  const [isNewTransferModalOpen, setIsNewTransferModalOpen] = useState(false);
  const [newTransferSourceWh, setNewTransferSourceWh] = useState("");
  const [newTransferDestWh, setNewTransferDestWh] = useState("");
  const [newTransferVariantId, setNewTransferVariantId] = useState("");
  const [newTransferQty, setNewTransferQty] = useState(5);
  const [newTransferNotes, setNewTransferNotes] = useState("");
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  // Dispatch & Receive Modals
  const [dispatchModalTransfer, setDispatchModalTransfer] = useState(null);
  const [dispatchCarrier, setDispatchCarrier] = useState("");
  const [dispatchTrackingRef, setDispatchTrackingRef] = useState("");
  const [isDispatching, setIsDispatching] = useState(false);

  const [receiveModalTransfer, setReceiveModalTransfer] = useState(null);
  const [receiveAcceptedQty, setReceiveAcceptedQty] = useState(0);
  const [receiveRejectedQty, setReceiveRejectedQty] = useState(0);
  const [receiveDiscrepancyReason, setReceiveDiscrepancyReason] = useState("");
  const [isReceivingAction, setIsReceivingAction] = useState(false);

  // ==========================================
  // STOCK MOVEMENT HISTORY STATE
  // ==========================================
  const [movementsList, setMovementsList] = useState([]);
  const [movementsMeta, setMovementsMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [movementsType, setMovementsType] = useState("all");
  const [movementsWarehouse, setMovementsWarehouse] = useState("all");
  const [movementsSearch, setMovementsSearch] = useState("");
  const [isMovementsLoading, setIsMovementsLoading] = useState(false);

  // ==========================================
  // STOCK COUNTING & CYCLE AUDITS STATE
  // ==========================================
  const [countsList, setCountsList] = useState([]);
  const [countsMeta, setCountsMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [countsSearch, setCountsSearch] = useState("");
  const [countsWarehouse, setCountsWarehouse] = useState("all");
  const [countsStatus, setCountsStatus] = useState("all");
  const [countsScope, setCountsScope] = useState("all");
  const [isCountsLoading, setIsCountsLoading] = useState(false);

  // New Stock Count Modal
  const [isNewCountModalOpen, setIsNewCountModalOpen] = useState(false);
  const [newCountWarehouse, setNewCountWarehouse] = useState("");
  const [newCountType, setNewCountType] = useState("physical");
  const [newCountScope, setNewCountScope] = useState("full");
  const [newCountMateriality, setNewCountMateriality] = useState(5);
  const [newCountNotes, setNewCountNotes] = useState("");
  const [isCreatingCount, setIsCreatingCount] = useState(false);

  // Active Count Entry / Inspection Drawer Modal
  const [activeCountSession, setActiveCountSession] = useState(null);
  const [countItemEntries, setCountItemEntries] = useState({});
  const [isSavingCounts, setIsSavingCounts] = useState(false);
  const [isSubmittingCount, setIsSubmittingCount] = useState(false);

  // Recount Modal
  const [recountModalSession, setRecountModalSession] = useState(null);
  const [recountNotes, setRecountNotes] = useState("");
  const [isRecounting, setIsRecounting] = useState(false);

  // Approval Modal
  const [approvalModalSession, setApprovalModalSession] = useState(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [isApproving, setIsApproving] = useState(false);

  // Rejection Modal
  const [rejectionModalSession, setRejectionModalSession] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  // Reconciliation Action
  const [isReconciling, setIsReconciling] = useState(false);

  // ==========================================
  // DATA FETCHING HOOKS
  // ==========================================
  const loadWarehouses = useCallback(async () => {
    try {
      const whRes = await vendorService.getMyWarehouses();
      const whData = whRes?.data?.data || whRes?.data?.warehouses || whRes?.data || [];
      setWarehouses(Array.isArray(whData) ? whData : []);
      if (whData.length > 0) {
        if (!newReceivingWarehouse) setNewReceivingWarehouse(whData[0]._id);
        if (!newTransferSourceWh) setNewTransferSourceWh(whData[0]._id);
        if (whData.length > 1 && !newTransferDestWh) setNewTransferDestWh(whData[1]._id);
        if (!newCountWarehouse) setNewCountWarehouse(whData[0]._id);
      }
    } catch {
      // Non-blocking
    }
  }, [newReceivingWarehouse, newTransferSourceWh, newTransferDestWh, newCountWarehouse]);

  const loadInventory = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = { page, limit };
      if (selectedWarehouse !== "all") params.warehouseId = selectedWarehouse;
      if (search.trim()) params.search = search.trim();

      const invRes = await vendorService.getMyInventory(params);
      const invData = invRes?.data?.data || invRes?.data?.inventory || invRes?.data || [];
      const items = Array.isArray(invData) ? invData : invData.items || [];
      const paginationMeta = invRes?.data?.meta || {
        page,
        limit,
        total: items.length,
        totalPages: Math.ceil(items.length / limit) || 1,
      };
      setInventory(items);
      setMeta(paginationMeta);
    } catch (err) {
      if (err.status === 403 || err.status === 404 || err.response?.status === 403 || err.response?.status === 404) {
        setInventory([]);
        setMeta({ page: 1, limit: 20, total: 0, totalPages: 1 });
        return;
      }
      toast.error("Failed to fetch inventory records");
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, selectedWarehouse, search]);

  const loadReceiving = useCallback(async () => {
    setIsReceivingLoading(true);
    try {
      const params = {
        page: receivingMeta.page,
        limit: receivingMeta.limit,
        search: receivingSearch.trim() || undefined,
        status: receivingStatus !== "all" ? receivingStatus : undefined,
      };
      const res = await vendorService.getStockReceivingRecords(params);
      const data = res?.data?.data || [];
      setReceivingList(Array.isArray(data) ? data : []);
      if (res?.data?.meta) {
        setReceivingMeta(res.data.meta);
      }
    } catch {
      toast.error("Failed to load inbound goods receiving shipments");
    } finally {
      setIsReceivingLoading(false);
    }
  }, [receivingMeta.page, receivingMeta.limit, receivingSearch, receivingStatus]);

  const loadTransfers = useCallback(async () => {
    setIsTransfersLoading(true);
    try {
      const params = {
        page: transfersMeta.page,
        limit: transfersMeta.limit,
        status: transfersStatus !== "all" ? transfersStatus : undefined,
        warehouseId: transfersWarehouse !== "all" ? transfersWarehouse : undefined,
        search: transfersSearch.trim() || undefined,
      };
      const res = await vendorService.getStockTransfers(params);
      const data = res?.data?.data || [];
      setTransfersList(Array.isArray(data) ? data : []);
      if (res?.data?.meta) {
        setTransfersMeta(res.data.meta);
      }
    } catch {
      toast.error("Failed to load warehouse stock transfers");
    } finally {
      setIsTransfersLoading(false);
    }
  }, [transfersMeta.page, transfersMeta.limit, transfersStatus, transfersWarehouse, transfersSearch]);

  const loadMovements = useCallback(async () => {
    setIsMovementsLoading(true);
    try {
      const params = {
        page: movementsMeta.page,
        limit: movementsMeta.limit,
        type: movementsType !== "all" ? movementsType : undefined,
        warehouseId: movementsWarehouse !== "all" ? movementsWarehouse : undefined,
        search: movementsSearch.trim() || undefined,
      };
      const res = await vendorService.getStockMovements(params);
      const data = res?.data?.data || [];
      setMovementsList(Array.isArray(data) ? data : []);
      if (res?.data?.meta) {
        setMovementsMeta(res.data.meta);
      }
    } catch {
      toast.error("Failed to load stock movements ledger");
    } finally {
      setIsMovementsLoading(false);
    }
  }, [movementsMeta.page, movementsMeta.limit, movementsType, movementsWarehouse, movementsSearch]);

  const loadCounts = useCallback(async () => {
    setIsCountsLoading(true);
    try {
      const params = {
        page: countsMeta.page,
        limit: countsMeta.limit,
      };
      if (countsWarehouse !== "all") params.warehouseId = countsWarehouse;
      if (countsStatus !== "all") params.status = countsStatus;
      if (countsScope !== "all") params.scope = countsScope;
      if (countsSearch.trim()) params.search = countsSearch.trim();

      const res = await vendorService.getStockCounts(params);
      const data = res?.data?.data || res?.data?.items || res?.data || [];
      setCountsList(Array.isArray(data) ? data : []);
      if (res?.data?.meta) {
        setCountsMeta(res.data.meta);
      }
    } catch {
      toast.error("Failed to load stock count sessions");
    } finally {
      setIsCountsLoading(false);
    }
  }, [countsMeta.page, countsMeta.limit, countsWarehouse, countsStatus, countsScope, countsSearch]);

  // Initial load
  useEffect(() => {
    loadWarehouses();
  }, [loadWarehouses]);

  useEffect(() => {
    if (activeTab === "inventory") {
      loadInventory();
    } else if (activeTab === "receiving") {
      loadReceiving();
    } else if (activeTab === "transfers") {
      loadTransfers();
    } else if (activeTab === "movements") {
      loadMovements();
    } else if (activeTab === "counts" || activeTab === "reconciliation") {
      loadCounts();
    }
  }, [activeTab, loadInventory, loadReceiving, loadTransfers, loadMovements, loadCounts]);

  // ==========================================
  // ACTION HANDLERS: ADJUSTMENT
  // ==========================================
  const handleOpenAdjustModal = (item) => {
    setAdjustModalItem(item);
    setAdjustDelta(1);
    setAdjustType("add");
    setAdjustReason("physical_count_correction");
    setAdjustCondition("sellable");
    setAdjustNotes("");
  };

  const handleCloseAdjustModal = () => {
    setAdjustModalItem(null);
    setAdjustDelta(1);
    setAdjustType("add");
    setAdjustNotes("");
    setIsAdjusting(false);
  };

  const handleExecuteAdjustment = async (e) => {
    e.preventDefault();
    if (!adjustModalItem) return;

    const deltaNum = parseInt(adjustDelta, 10);
    if (isNaN(deltaNum) || deltaNum <= 0) {
      toast.error("Adjustment quantity must be a positive integer.");
      return;
    }

    const netQuantity = adjustType === "add" ? deltaNum : -deltaNum;
    const currentOnHand = adjustModalItem.onHand || 0;
    const reserved = adjustModalItem.reserved || 0;
    const nonSellable = (adjustModalItem.damaged || 0) + (adjustModalItem.defective || 0) + (adjustModalItem.expired || 0);

    if (adjustCondition === "sellable" && adjustType === "remove") {
      if (currentOnHand + netQuantity < reserved + nonSellable) {
        toast.error(
          `Cannot reduce stock below reserved (${reserved}) and non-sellable (${nonSellable}) stock. Max allowed reduction: ${currentOnHand - reserved - nonSellable}`
        );
        return;
      }
    }

    setIsAdjusting(true);

    try {
      await vendorService.adjustInventory(adjustModalItem._id, {
        quantity: netQuantity,
        reason: adjustReason,
        condition: adjustCondition,
        notes: adjustNotes.trim() || undefined,
      });

      toast.success(
        `Stock adjustment logged to immutable audit ledger: ${netQuantity > 0 ? `+${netQuantity}` : netQuantity} for ${adjustModalItem.sku}`
      );

      handleCloseAdjustModal();
      await loadInventory();
    } catch (err) {
      toast.error("Failed to adjust inventory", {
        description: err?.response?.data?.message || err.message,
      });
      setIsAdjusting(false);
    }
  };

  // ==========================================
  // ACTION HANDLERS: REORDER THRESHOLD
  // ==========================================
  const handleOpenThresholdModal = (item) => {
    setThresholdModalItem(item);
    setNewThreshold(item.lowStockThreshold || 5);
    setNewReorderLevel(item.reorderLevel || (item.lowStockThreshold || 5) * 2);
  };

  const handleExecuteThresholdUpdate = async (e) => {
    e.preventDefault();
    if (!thresholdModalItem) return;

    setIsUpdatingThreshold(true);
    try {
      await vendorService.updateInventoryThreshold(thresholdModalItem._id, {
        lowStockThreshold: parseInt(newThreshold, 10),
        reorderLevel: parseInt(newReorderLevel, 10),
      });

      toast.success(`Reorder levels updated for SKU ${thresholdModalItem.sku}`);
      setThresholdModalItem(null);
      await loadInventory();
    } catch (err) {
      toast.error("Failed to update threshold", {
        description: err?.response?.data?.message || err.message,
      });
    } finally {
      setIsUpdatingThreshold(false);
    }
  };

  // ==========================================
  // ACTION HANDLERS: GOODS RECEIVING
  // ==========================================
  const handleCreateReceivingRecord = async (e) => {
    e.preventDefault();
    if (!newReceivingWarehouse || !newReceivingVariantId) {
      toast.error("Please select a warehouse and product variant");
      return;
    }

    setIsSubmittingReceiving(true);
    try {
      await vendorService.createStockReceiving({
        destinationWarehouseId: newReceivingWarehouse,
        supplierName: newReceivingSupplier.trim() || undefined,
        referenceDocNumber: newReceivingRefDoc.trim() || undefined,
        autoConfirm: newReceivingAutoConfirm,
        items: [
          {
            productVariantId: newReceivingVariantId,
            expectedQuantity: parseInt(newReceivingQty, 10),
            receivedQuantity: parseInt(newReceivingQty, 10),
          },
        ],
        notes: newReceivingNotes.trim() || undefined,
      });

      toast.success(
        newReceivingAutoConfirm
          ? "Inbound shipment received and stock incremented immediately!"
          : "Draft receiving record created! Ready for warehouse check-in."
      );

      setIsNewReceivingModalOpen(false);
      setNewReceivingSupplier("");
      setNewReceivingRefDoc("");
      setNewReceivingNotes("");
      await loadReceiving();
      if (newReceivingAutoConfirm) {
        await loadInventory();
      }
    } catch (err) {
      toast.error("Failed to create receiving record", {
        description: err?.response?.data?.message || err.message,
      });
    } finally {
      setIsSubmittingReceiving(false);
    }
  };

  const handleConfirmReceiving = async (id) => {
    try {
      await vendorService.confirmStockReceiving(id);
      toast.success("Shipment confirmed! Stock atomically added to warehouse inventory.");
      await loadReceiving();
      await loadInventory();
    } catch (err) {
      toast.error("Failed to confirm receiving shipment", {
        description: err?.response?.data?.message || err.message,
      });
    }
  };

  const handleCancelReceiving = async (id) => {
    if (!confirm("Are you sure you want to cancel this inbound receiving record?")) return;
    try {
      await vendorService.cancelStockReceiving(id, { reason: "Cancelled by merchant" });
      toast.success("Receiving record cancelled");
      await loadReceiving();
    } catch (err) {
      toast.error("Failed to cancel receiving record", {
        description: err?.response?.data?.message || err.message,
      });
    }
  };

  // ==========================================
  // ACTION HANDLERS: STOCK TRANSFERS
  // ==========================================
  const handleCreateTransfer = async (e) => {
    e.preventDefault();
    if (!newTransferSourceWh || !newTransferDestWh || !newTransferVariantId) {
      toast.error("Please fill all required transfer parameters");
      return;
    }
    if (newTransferSourceWh === newTransferDestWh) {
      toast.error("Source and destination fulfillment centers cannot be the same");
      return;
    }

    setIsSubmittingTransfer(true);
    try {
      await vendorService.createStockTransfer({
        sourceWarehouseId: newTransferSourceWh,
        destinationWarehouseId: newTransferDestWh,
        items: [
          {
            productVariantId: newTransferVariantId,
            requestedQuantity: parseInt(newTransferQty, 10),
          },
        ],
        notes: newTransferNotes.trim() || undefined,
      });

      toast.success("Inter-warehouse transfer created & approved!");
      setIsNewTransferModalOpen(false);
      setNewTransferNotes("");
      await loadTransfers();
    } catch (err) {
      toast.error("Failed to create stock transfer", {
        description: err?.response?.data?.message || err.message,
      });
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  const handleExecuteDispatch = async (e) => {
    e.preventDefault();
    if (!dispatchModalTransfer) return;

    setIsDispatching(true);
    try {
      await vendorService.dispatchStockTransfer(dispatchModalTransfer._id, {
        carrierName: dispatchCarrier.trim() || undefined,
        trackingReference: dispatchTrackingRef.trim() || undefined,
      });

      toast.success("Stock dispatched! In-transit status active, source stock reduced.");
      setDispatchModalTransfer(null);
      setDispatchCarrier("");
      setDispatchTrackingRef("");
      await loadTransfers();
      await loadInventory();
    } catch (err) {
      toast.error("Failed to dispatch transfer", {
        description: err?.response?.data?.message || err.message,
      });
    } finally {
      setIsDispatching(false);
    }
  };

  const handleOpenReceiveModal = (transfer) => {
    setReceiveModalTransfer(transfer);
    const item = transfer.items?.[0];
    const remaining = item ? item.dispatchedQuantity - (item.receivedQuantity + item.rejectedQuantity) : 0;
    setReceiveAcceptedQty(Math.max(0, remaining));
    setReceiveRejectedQty(0);
    setReceiveDiscrepancyReason("");
  };

  const handleExecuteReceive = async (e) => {
    e.preventDefault();
    if (!receiveModalTransfer) return;

    setIsReceivingAction(true);
    try {
      const item = receiveModalTransfer.items?.[0];
      await vendorService.receiveStockTransfer(receiveModalTransfer._id, {
        receivedItems: item
          ? [
              {
                productVariantId: item.productVariantId,
                receivedQuantity: parseInt(receiveAcceptedQty, 10),
                rejectedQuantity: parseInt(receiveRejectedQty, 10),
                discrepancyReason: receiveDiscrepancyReason.trim() || undefined,
              },
            ]
          : [],
      });

      toast.success("Transfer received at destination! Live stock increased.");
      setReceiveModalTransfer(null);
      await loadTransfers();
      await loadInventory();
    } catch (err) {
      toast.error("Failed to receive transfer", {
        description: err?.response?.data?.message || err.message,
      });
    } finally {
      setIsReceivingAction(false);
    }
  };

  // ==========================================
  // ACTION HANDLERS: STOCK COUNTS & RECONCILIATION
  // ==========================================
  const handleCreateCountSession = async (e) => {
    e.preventDefault();
    if (!newCountWarehouse) {
      toast.error("Please select a fulfillment center");
      return;
    }
    setIsCreatingCount(true);
    try {
      const res = await vendorService.createStockCount({
        warehouseId: newCountWarehouse,
        countType: newCountType,
        scope: newCountScope,
        materialityThresholdPercent: newCountMateriality,
        notes: newCountNotes.trim() || undefined,
      });

      toast.success("Stock count session initialized successfully!");
      setIsNewCountModalOpen(false);
      setNewCountNotes("");
      await loadCounts();

      const created = res?.data?.data;
      if (created?._id) {
        handleOpenCountEntry(created);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to initialize count session");
    } finally {
      setIsCreatingCount(false);
    }
  };

  const handleOpenCountEntry = (session) => {
    setActiveCountSession(session);
    const initialEntries = {};
    for (const item of session.items || []) {
      initialEntries[item._id] = {
        countedOnHand: item.countedOnHand !== null && item.countedOnHand !== undefined ? item.countedOnHand : item.snapshotOnHand,
        countedCondition: item.countedCondition || "sellable",
        inspectionNotes: item.inspectionNotes || "",
        reason: item.reason || "",
      };
    }
    setCountItemEntries(initialEntries);
  };

  const handleUpdateCountItem = (itemId, field, value) => {
    setCountItemEntries((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      },
    }));
  };

  const handleSaveCounts = async (shouldSubmit = false) => {
    if (!activeCountSession) return;
    if (shouldSubmit) {
      setIsSubmittingCount(true);
    } else {
      setIsSavingCounts(true);
    }

    try {
      const itemsPayload = Object.entries(countItemEntries).map(([itemId, entry]) => ({
        _id: itemId,
        countedOnHand: parseInt(entry.countedOnHand, 10) || 0,
        countedCondition: entry.countedCondition || "sellable",
        inspectionNotes: entry.inspectionNotes?.trim() || undefined,
        reason: entry.reason?.trim() || undefined,
      }));

      await vendorService.recordPhysicalCounts(activeCountSession._id, {
        items: itemsPayload,
      });

      if (shouldSubmit) {
        await vendorService.submitStockCount(activeCountSession._id);
        toast.success("Stock count submitted for review and approval!");
        setActiveCountSession(null);
      } else {
        toast.success("Physical counts saved in progress!");
      }

      await loadCounts();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save counts");
    } finally {
      setIsSavingCounts(false);
      setIsSubmittingCount(false);
    }
  };

  const handleOpenRecountModal = (session) => {
    setRecountModalSession(session);
    setRecountNotes("");
  };

  const handleExecuteRecount = async (e) => {
    e.preventDefault();
    if (!recountModalSession) return;
    setIsRecounting(true);
    try {
      await vendorService.requestRecount(recountModalSession._id, {
        recountNotes: recountNotes.trim() || undefined,
      });
      toast.success("Recount initiated! Session marked for re-verification.");
      setRecountModalSession(null);
      await loadCounts();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to initiate recount");
    } finally {
      setIsRecounting(false);
    }
  };

  const handleOpenApproveModal = (session) => {
    setApprovalModalSession(session);
    setApprovalNotes("");
  };

  const handleExecuteApprove = async (e) => {
    e.preventDefault();
    if (!approvalModalSession) return;
    setIsApproving(true);
    try {
      await vendorService.approveStockCount(approvalModalSession._id, {
        approvalNotes: approvalNotes.trim() || undefined,
      });
      toast.success("Stock count variances approved! Ready for reconciliation.");
      setApprovalModalSession(null);
      await loadCounts();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to approve stock count");
    } finally {
      setIsApproving(false);
    }
  };

  const handleOpenRejectModal = (session) => {
    setRejectionModalSession(session);
    setRejectionReason("");
  };

  const handleExecuteReject = async (e) => {
    e.preventDefault();
    if (!rejectionModalSession) return;
    setIsRejecting(true);
    try {
      await vendorService.rejectStockCount(rejectionModalSession._id, {
        rejectionReason: rejectionReason.trim() || undefined,
      });
      toast.success("Stock count rejected.");
      setRejectionModalSession(null);
      await loadCounts();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to reject stock count");
    } finally {
      setIsRejecting(false);
    }
  };

  const handleExecuteReconcile = async (sessionId) => {
    setIsReconciling(true);
    try {
      await vendorService.reconcileStockCount(sessionId);
      toast.success("Inventory reconciled atomically and ledger transactions generated successfully!");
      await loadCounts();
      await loadInventory();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to reconcile stock count");
    } finally {
      setIsReconciling(false);
    }
  };

  const handleCancelCount = async (sessionId) => {
    if (!confirm("Are you sure you want to cancel this count session?")) return;
    try {
      await vendorService.cancelStockCount(sessionId, { reason: "Cancelled by merchant" });
      toast.success("Stock count session cancelled");
      await loadCounts();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to cancel stock count");
    }
  };

  const handleExportCountSession = async (sessionId) => {
    try {
      toast.info("Generating stock count spreadsheet report...");
      const res = await vendorService.exportStockCount(sessionId);
      const blob = new Blob([res.data], { type: res.headers["content-type"] || "text/csv" });
      const disposition = res.headers["content-disposition"] || "";
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch ? filenameMatch[1] : `stock_count_${sessionId}.csv`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Report downloaded successfully");
    } catch {
      toast.error("Failed to export report");
    }
  };

  // Filter inventory items
  const filteredInventory = inventory.filter((item) => {
    if (selectedWarehouse !== "all") {
      const whId = item.warehouseId?._id || item.warehouseId;
      if (whId && whId.toString() !== selectedWarehouse) return false;
    }
    if (filterLowStock && !item.isLowStock) {
      return false;
    }
    return true;
  });

  const lowStockCount = inventory.filter((i) => i.isLowStock).length;
  const totalUnitsOnHand = inventory.reduce((sum, i) => sum + (i.onHand || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <VendorPageHeader
        title="Inventory &amp; Warehouse Operations"
        subtitle="Manage live stock, inbound goods receiving, inter-warehouse transfers, physical cycle counts, and audit reconciliation."
        breadcrumbs={[{ label: "Operations" }, { label: "Inventory" }]}
        actions={
          <button
            type="button"
            onClick={() => {
              if (activeTab === "inventory") loadInventory();
              if (activeTab === "receiving") loadReceiving();
              if (activeTab === "transfers") loadTransfers();
              if (activeTab === "movements") loadMovements();
              if (activeTab === "counts" || activeTab === "reconciliation") loadCounts();
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-colors"
          >
            <RefreshCw className="size-3.5" />
            <span>Refresh</span>
          </button>
        }
      />

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <VendorKpiCard
          title="Total Allocated SKUs"
          value={inventory.length}
          subtitle="Catalog variants stocked"
          icon={Boxes}
          variant="indigo"
        />

        <VendorKpiCard
          title="Total Units On Hand"
          value={totalUnitsOnHand.toLocaleString()}
          subtitle="Physical count across FCs"
          icon={Package}
          variant="emerald"
        />

        <VendorKpiCard
          title="Low Stock Alerts"
          value={lowStockCount}
          subtitle={lowStockCount > 0 ? "Requires restock replenishment" : "All inventories optimal"}
          icon={AlertTriangle}
          variant={lowStockCount > 0 ? "rose" : "slate"}
          alert={lowStockCount > 0}
        />

        <VendorKpiCard
          title="Fulfillment Centers"
          value={warehouses.length}
          subtitle="Regional distribution nodes"
          icon={Warehouse}
          variant="teal"
        />
      </div>

      {/* Operations Navigation Tabs */}
      <div className="flex border-b border-slate-200 space-x-1 sm:space-x-3 overflow-x-auto text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab("inventory")}
          className={`pb-3 px-3 transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === "inventory"
              ? "border-[#004D38] text-[#004D38]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Boxes className="size-3.5" />
          <span>Live Stock &amp; Reorder Levels</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("receiving")}
          className={`pb-3 px-3 transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === "receiving"
              ? "border-[#004D38] text-[#004D38]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Package className="size-3.5" />
          <span>Inbound Goods Receiving</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("transfers")}
          className={`pb-3 px-3 transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === "transfers"
              ? "border-[#004D38] text-[#004D38]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <ArrowRightLeft className="size-3.5" />
          <span>Inter-Warehouse Transfers</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("movements")}
          className={`pb-3 px-3 transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === "movements"
              ? "border-[#004D38] text-[#004D38]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <History className="size-3.5" />
          <span>Movement Ledger &amp; Audits</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("counts")}
          className={`pb-3 px-3 transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === "counts"
              ? "border-[#004D38] text-[#004D38]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <ClipboardList className="size-3.5" />
          <span>Stock &amp; Cycle Counts</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("reconciliation")}
          className={`pb-3 px-3 transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === "reconciliation"
              ? "border-[#004D38] text-[#004D38]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <ClipboardCheck className="size-3.5" />
          <span>Variance Reconciliation &amp; Approvals</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: LIVE INVENTORY & REORDER CONTROL                  */}
      {/* ======================================================== */}
      {activeTab === "inventory" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search SKU or product title..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <select
                value={selectedWarehouse}
                onChange={(e) => {
                  setSelectedWarehouse(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              >
                <option value="all">All Fulfillment Centers ({warehouses.length})</option>
                {warehouses.map((wh) => (
                  <option key={wh._id} value={wh._id}>
                    {wh.name || wh.code}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  setFilterLowStock(!filterLowStock);
                  setPage(1);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                  filterLowStock
                    ? "bg-rose-500 text-white border-rose-600 shadow-xs"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200"
                }`}
              >
                Low Stock Only
              </button>
            </div>
          </div>

          {/* Live Inventory Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {isLoading ? (
              <div className="py-24 flex flex-col items-center justify-center">
                <Loader2 className="size-8 text-[#004D38] animate-spin" />
                <p className="mt-2 text-xs font-medium text-slate-500">Loading live inventory...</p>
              </div>
            ) : filteredInventory.length === 0 ? (
              <VendorEmptyState
                icon={Boxes}
                title={search || selectedWarehouse !== "all" || filterLowStock ? "No Inventory Found" : "No Inventory Records"}
                description="No inventory items match your current filter parameters."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">SKU / Product Variant</th>
                      <th className="py-3 px-4">Fulfillment Center</th>
                      <th className="py-3 px-4 text-center">On Hand</th>
                      <th className="py-3 px-4 text-center">Reserved</th>
                      <th className="py-3 px-4 text-center">Available</th>
                      <th className="py-3 px-4 text-center">Low Stock Thresh</th>
                      <th className="py-3 px-4 text-center">Reorder Level</th>
                      <th className="py-3 px-4">Health Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredInventory.map((item) => {
                      const nonSellable = (item.damaged || 0) + (item.defective || 0) + (item.expired || 0);
                      const available = Math.max(0, (item.onHand || 0) - (item.reserved || 0) - nonSellable);
                      const threshold = item.lowStockThreshold || 5;
                      const reorderLvl = item.reorderLevel || threshold * 2;
                      const isLow = available <= threshold && available > 0;
                      const isOut = available <= 0;

                      return (
                        <tr key={item._id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-slate-900">{item.sku}</div>
                            <div className="text-[11px] text-slate-500 truncate max-w-xs">{item.productTitle}</div>
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            <div className="font-semibold text-slate-900">{item.warehouseName || "Regional Warehouse"}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{item.warehouseCode}</div>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">{item.onHand}</td>
                          <td className="py-3 px-4 text-center font-mono text-slate-500">{item.reserved || 0}</td>
                          <td className="py-3 px-4 text-center font-mono font-black text-slate-900">{available}</td>
                          <td className="py-3 px-4 text-center font-mono text-slate-600">{threshold}</td>
                          <td className="py-3 px-4 text-center font-mono text-slate-600 font-semibold">{reorderLvl}</td>
                          <td className="py-3 px-4">
                            <VendorStatusBadge
                              status={isOut ? "out_of_stock" : isLow ? "low_stock" : "healthy"}
                              entityType="inventory"
                            />
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenThresholdModal(item)}
                                title="Configure Reorder Threshold"
                                className="p-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                              >
                                <Sliders className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenAdjustModal(item)}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
                              >
                                Adjust Stock
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {meta.totalPages > 1 && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-mono">
                  Showing {filteredInventory.length} of {meta.total} records
                </span>
                <VendorTablePagination meta={meta} onPageChange={(p) => setPage(p)} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: INBOUND GOODS RECEIVING                          */}
      {/* ======================================================== */}
      {activeTab === "receiving" && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-2.5 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search receiving # or supplier..."
                  value={receivingSearch}
                  onChange={(e) => {
                    setReceivingSearch(e.target.value);
                    setReceivingMeta((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <select
                value={receivingStatus}
                onChange={(e) => {
                  setReceivingStatus(e.target.value);
                  setReceivingMeta((prev) => ({ ...prev, page: 1 }));
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft (Pending Check-in)</option>
                <option value="confirmed">Confirmed (Stock Added)</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setIsNewReceivingModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003829] text-white text-xs font-bold shadow-xs transition-colors shrink-0"
            >
              <Plus className="size-4" />
              <span>New Inbound Shipment</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {isReceivingLoading ? (
              <div className="py-24 flex flex-col items-center justify-center">
                <Loader2 className="size-8 text-[#004D38] animate-spin" />
                <p className="mt-2 text-xs font-medium text-slate-500">Loading receiving records...</p>
              </div>
            ) : receivingList.length === 0 ? (
              <VendorEmptyState
                icon={Package}
                title="No inbound receiving records"
                description="Record supplier shipments and stock replenishment batches into fulfillment centers."
                action={
                  <button
                    type="button"
                    onClick={() => setIsNewReceivingModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] text-white text-xs font-bold"
                  >
                    <Plus className="size-4" />
                    <span>Create Inbound Shipment</span>
                  </button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Receiving #</th>
                      <th className="py-3 px-4">Warehouse Destination</th>
                      <th className="py-3 px-4">Supplier / Reference Doc</th>
                      <th className="py-3 px-4 text-center">Items (Qty Expected / Received)</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {receivingList.map((rec) => {
                      const totalExpected = (rec.items || []).reduce((sum, it) => sum + (it.expectedQuantity || 0), 0);
                      const totalReceived = (rec.items || []).reduce((sum, it) => sum + (it.receivedQuantity || 0), 0);

                      return (
                        <tr key={rec._id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {rec.receivingNumber}
                            <span className="block text-[10px] text-slate-400 font-sans font-normal">
                              {new Date(rec.createdAt).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-slate-800">{rec.warehouseId?.name || "Warehouse"}</p>
                            <span className="text-[10px] font-mono text-slate-400">{rec.warehouseId?.code || "FC"}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            <p className="font-medium text-slate-800">{rec.supplierName || "Direct / Vendor"}</p>
                            <span className="text-[10px] text-slate-400 font-mono">Doc: {rec.referenceDocNumber || "N/A"}</span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono">
                            <span className="text-slate-500">{totalExpected} exp</span>
                            <span className="text-slate-300 mx-1">/</span>
                            <span className="font-bold text-slate-900">{totalReceived} rcv</span>
                          </td>
                          <td className="py-3 px-4">
                            <VendorStatusBadge status={rec.status} />
                          </td>
                          <td className="py-3 px-4 text-right">
                            {rec.status === "draft" && (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleConfirmReceiving(rec._id)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shadow-xs"
                                >
                                  Confirm Stock
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCancelReceiving(rec._id)}
                                  className="p-1 rounded-lg border border-slate-200 text-rose-500 hover:bg-rose-50"
                                >
                                  <X className="size-3.5" />
                                </button>
                              </div>
                            )}
                            {rec.status === "confirmed" && (
                              <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-bold">
                                Added to On Hand
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {receivingMeta.totalPages > 1 && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-mono">
                  Showing {receivingList.length} of {receivingMeta.total} shipments
                </span>
                <VendorTablePagination
                  meta={receivingMeta}
                  onPageChange={(p) => setReceivingMeta((prev) => ({ ...prev, page: p }))}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: INTER-WAREHOUSE TRANSFERS                         */}
      {/* ======================================================== */}
      {activeTab === "transfers" && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search transfer # or tracking..."
                  value={transfersSearch}
                  onChange={(e) => {
                    setTransfersSearch(e.target.value);
                    setTransfersMeta((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <select
                value={transfersStatus}
                onChange={(e) => {
                  setTransfersStatus(e.target.value);
                  setTransfersMeta((prev) => ({ ...prev, page: 1 }));
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              >
                <option value="all">All Transfer Statuses</option>
                <option value="approved">Approved (Pending Dispatch)</option>
                <option value="dispatched">In Transit</option>
                <option value="partially_received">Partially Received</option>
                <option value="received">Fully Received</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setIsNewTransferModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003829] text-white text-xs font-bold shadow-xs transition-colors shrink-0"
            >
              <Plus className="size-4" />
              <span>New Stock Transfer</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {isTransfersLoading ? (
              <div className="py-24 flex flex-col items-center justify-center">
                <Loader2 className="size-8 text-[#004D38] animate-spin" />
                <p className="mt-2 text-xs font-medium text-slate-500">Loading stock transfers...</p>
              </div>
            ) : transfersList.length === 0 ? (
              <VendorEmptyState
                icon={ArrowRightLeft}
                title="No stock transfers found"
                description="Rebalance stock across your fulfillment centers with controlled dispatch and receiving."
                action={
                  <button
                    type="button"
                    onClick={() => setIsNewTransferModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] text-white text-xs font-bold"
                  >
                    <Plus className="size-4" />
                    <span>Initiate First Transfer</span>
                  </button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Transfer Number</th>
                      <th className="py-3 px-4">Route (Origin → Destination)</th>
                      <th className="py-3 px-4">Transit / Carrier Tracking</th>
                      <th className="py-3 px-4 text-center">Quantities (Req / Dispatched / Rcv)</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {transfersList.map((tr) => {
                      const totalReq = (tr.items || []).reduce((sum, it) => sum + (it.requestedQuantity || 0), 0);
                      const totalDisp = (tr.items || []).reduce((sum, it) => sum + (it.dispatchedQuantity || 0), 0);
                      const totalRcv = (tr.items || []).reduce((sum, it) => sum + (it.receivedQuantity || 0), 0);

                      return (
                        <tr key={tr._id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {tr.transferNumber}
                            <span className="block text-[10px] text-slate-400 font-sans font-normal">
                              {new Date(tr.createdAt).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1 text-slate-800 font-semibold">
                              <span>{tr.sourceWarehouseId?.code || "SRC"}</span>
                              <ChevronRight className="size-3 text-slate-400" />
                              <span className="text-emerald-700 font-bold">{tr.destinationWarehouseId?.code || "DST"}</span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {tr.sourceWarehouseId?.city} → {tr.destinationWarehouseId?.city}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {tr.carrierName ? (
                              <div className="font-medium text-slate-800">
                                <p>{tr.carrierName}</p>
                                <span className="text-[10px] font-mono text-slate-500">{tr.trackingReference || "No Tracking Ref"}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 font-mono text-[11px]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-mono">
                            <span className="text-slate-500">{totalReq} req</span>
                            <span className="text-slate-300 mx-1">/</span>
                            <span className="text-amber-600 font-semibold">{totalDisp} disp</span>
                            <span className="text-slate-300 mx-1">/</span>
                            <span className="text-emerald-700 font-bold">{totalRcv} rcv</span>
                          </td>
                          <td className="py-3 px-4">
                            <VendorStatusBadge status={tr.status} />
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {tr.status === "approved" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDispatchModalTransfer(tr);
                                    setDispatchCarrier("");
                                    setDispatchTrackingRef("");
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-xs"
                                >
                                  Dispatch
                                </button>
                              )}

                              {(tr.status === "dispatched" || tr.status === "partially_received") && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenReceiveModal(tr)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shadow-xs"
                                >
                                  Receive
                                </button>
                              )}

                              {tr.status === "received" && (
                                <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-bold">
                                  Completed
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {transfersMeta.totalPages > 1 && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-mono">
                  Showing {transfersList.length} of {transfersMeta.total} transfers
                </span>
                <VendorTablePagination
                  meta={transfersMeta}
                  onPageChange={(p) => setTransfersMeta((prev) => ({ ...prev, page: p }))}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: IMMUTABLE STOCK MOVEMENT HISTORY                  */}
      {/* ======================================================== */}
      {activeTab === "movements" && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search SKU or ref #..."
                  value={movementsSearch}
                  onChange={(e) => {
                    setMovementsSearch(e.target.value);
                    setMovementsMeta((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <select
                value={movementsType}
                onChange={(e) => {
                  setMovementsType(e.target.value);
                  setMovementsMeta((prev) => ({ ...prev, page: 1 }));
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              >
                <option value="all">All Movement Types</option>
                <option value="receive">Goods Receiving</option>
                <option value="adjustment">Manual Adjustment</option>
                <option value="transfer">Warehouse Transfer</option>
                <option value="count_reconciliation">Cycle Count Reconciliation</option>
                <option value="condition_change">Condition Segregation</option>
                <option value="sale">Customer Sale Deduction</option>
                <option value="return">Customer Return Restock</option>
              </select>

              <select
                value={movementsWarehouse}
                onChange={(e) => {
                  setMovementsWarehouse(e.target.value);
                  setMovementsMeta((prev) => ({ ...prev, page: 1 }));
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              >
                <option value="all">All Fulfillment Centers</option>
                {warehouses.map((wh) => (
                  <option key={wh._id} value={wh._id}>
                    {wh.name} ({wh.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {isMovementsLoading ? (
              <div className="py-24 flex flex-col items-center justify-center">
                <Loader2 className="size-8 text-[#004D38] animate-spin" />
                <p className="mt-2 text-xs font-medium text-slate-500">Loading audit movement ledger...</p>
              </div>
            ) : movementsList.length === 0 ? (
              <VendorEmptyState
                icon={History}
                title="No movement history found"
                description="Stock movements across all receiving, transfer, sales, and adjustment events are permanently recorded here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Date / Timestamp</th>
                      <th className="py-3 px-4">Event Type</th>
                      <th className="py-3 px-4">SKU / Variant</th>
                      <th className="py-3 px-4">Warehouse</th>
                      <th className="py-3 px-4 text-center">Delta Quantity</th>
                      <th className="py-3 px-4 text-center">On-Hand Progression</th>
                      <th className="py-3 px-4">Reference &amp; Initiator</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {movementsList.map((tx) => {
                      const isPositive = (tx.quantity || 0) > 0;
                      const isNegative = (tx.quantity || 0) < 0;

                      return (
                        <tr key={tx._id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                            {new Date(tx.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3 px-4">
                            <span className="capitalize font-bold text-slate-800 text-[11px] px-2 py-0.5 rounded-md bg-slate-100">
                              {tx.type?.replace("_", " ")}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-slate-900">{tx.sku}</div>
                            <span className="text-[10px] text-slate-400 truncate max-w-xs block">{tx.productName}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            <div className="font-medium text-slate-800">{tx.warehouseName}</div>
                            <span className="text-[10px] font-mono text-slate-400">{tx.warehouseCode}</span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-sm">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-lg ${
                                isPositive
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : isNegative
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : "bg-slate-50 text-slate-700 border border-slate-200"
                              }`}
                            >
                              {isPositive ? `+${tx.quantity}` : tx.quantity}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-xs">
                            <span className="text-slate-400">{tx.onHandBefore}</span>
                            <span className="text-slate-300 mx-1.5">→</span>
                            <span className="font-bold text-slate-900">{tx.onHandAfter}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-slate-700 font-mono text-[11px] truncate max-w-xs font-semibold">
                              {tx.referenceId || "Direct Operation"}
                            </div>
                            <span className="text-[10px] text-slate-400 block">By: {tx.initiatedBy || "System Actor"}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {movementsMeta.totalPages > 1 && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-mono">
                  Showing {movementsList.length} of {movementsMeta.total} records
                </span>
                <VendorTablePagination
                  meta={movementsMeta}
                  onPageChange={(p) => setMovementsMeta((prev) => ({ ...prev, page: p }))}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: PHYSICAL STOCK COUNTING & CYCLE AUDITS            */}
      {/* ======================================================== */}
      {activeTab === "counts" && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search session # or SKU..."
                  value={countsSearch}
                  onChange={(e) => {
                    setCountsSearch(e.target.value);
                    setCountsMeta((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <select
                value={countsWarehouse}
                onChange={(e) => {
                  setCountsWarehouse(e.target.value);
                  setCountsMeta((prev) => ({ ...prev, page: 1 }));
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
              >
                <option value="all">All Fulfillment Centers</option>
                {warehouses.map((wh) => (
                  <option key={wh._id} value={wh._id}>
                    {wh.name} ({wh.code})
                  </option>
                ))}
              </select>

              <select
                value={countsStatus}
                onChange={(e) => {
                  setCountsStatus(e.target.value);
                  setCountsMeta((prev) => ({ ...prev, page: 1 }));
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
              >
                <option value="all">All Statuses</option>
                <option value="counting">Counting / In Progress</option>
                <option value="submitted">Submitted for Review</option>
                <option value="recount_required">Recount Required</option>
                <option value="approved">Approved</option>
                <option value="reconciled">Reconciled</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <select
                value={countsScope}
                onChange={(e) => {
                  setCountsScope(e.target.value);
                  setCountsMeta((prev) => ({ ...prev, page: 1 }));
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
              >
                <option value="all">All Scopes</option>
                <option value="full">Full Warehouse Count</option>
                <option value="partial">Selected SKUs</option>
                <option value="low_stock">Low Stock Cycle Count</option>
                <option value="high_value">High Value Cycle Count</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setIsNewCountModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003829] text-white text-xs font-bold shadow-xs transition-colors shrink-0"
            >
              <Plus className="size-4" />
              <span>New Stock Count Session</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {isCountsLoading ? (
              <div className="py-24 flex flex-col items-center justify-center">
                <Loader2 className="size-8 text-[#004D38] animate-spin" />
                <p className="mt-2 text-xs font-medium text-slate-500">Loading stock count sessions...</p>
              </div>
            ) : countsList.length === 0 ? (
              <VendorEmptyState
                icon={ClipboardList}
                title="No stock count sessions found"
                description="Initialize a physical or cycle count session to audit inventory at your fulfillment centers."
                action={
                  <button
                    type="button"
                    onClick={() => setIsNewCountModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] text-white text-xs font-bold"
                  >
                    <Plus className="size-4" />
                    <span>Start First Count</span>
                  </button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Session Number</th>
                      <th className="py-3 px-4">Fulfillment Center</th>
                      <th className="py-3 px-4">Type &amp; Scope</th>
                      <th className="py-3 px-4 text-center">Items Counted</th>
                      <th className="py-3 px-4 text-center">SKU Accuracy</th>
                      <th className="py-3 px-4 text-center">Qty Accuracy</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {countsList.map((session) => {
                      const countedItems = (session.items || []).filter((it) => it.countedOnHand !== null).length;
                      const totalItems = (session.items || []).length;
                      const isComplete = countedItems === totalItems && totalItems > 0;

                      return (
                        <tr key={session._id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <ClipboardList className="size-3.5 text-slate-400" />
                              <span>{session.countNumber}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-sans font-normal">
                              {new Date(session.createdAt).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-slate-800">{session.warehouseId?.name || "Warehouse"}</p>
                            <span className="text-[10px] font-mono text-slate-400">{session.warehouseId?.code || "FC"}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1">
                              <span className="capitalize font-semibold text-slate-700">{session.countType || "Physical"}</span>
                              <span className="text-slate-300">•</span>
                              <span className="text-[11px] text-slate-500 uppercase">{session.scope?.replace("_", " ")}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="font-mono font-bold text-slate-800">
                              {countedItems} / {totalItems}
                            </span>
                            <div className="w-16 bg-slate-100 h-1.5 rounded-full mx-auto mt-1 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${isComplete ? "bg-emerald-500" : "bg-amber-500"}`}
                                style={{ width: `${totalItems > 0 ? (countedItems / totalItems) * 100 : 0}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-block font-mono font-bold px-2 py-0.5 rounded-lg text-[11px] ${
                              session.skuAccuracyRate >= 95
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : session.skuAccuracyRate >= 80
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}>
                              {session.skuAccuracyRate ?? 100}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-block font-mono font-bold px-2 py-0.5 rounded-lg text-[11px] ${
                              session.quantityAccuracyRate >= 95
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : session.quantityAccuracyRate >= 80
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}>
                              {session.quantityAccuracyRate ?? 100}%
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <VendorStatusBadge status={session.status} />
                            {session.recountCount > 0 && (
                              <span className="ml-1 text-[10px] text-amber-600 font-bold">
                                (Recount #{session.recountCount})
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenCountEntry(session)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
                              >
                                <ClipboardList className="size-3" />
                                <span>{session.status === "counting" ? "Enter Counts" : "Inspect"}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleExportCountSession(session._id)}
                                title="Export CSV Report"
                                className="p-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                              >
                                <Download className="size-3.5" />
                              </button>

                              {session.status !== "reconciled" && session.status !== "cancelled" && (
                                <button
                                  type="button"
                                  onClick={() => handleCancelCount(session._id)}
                                  title="Cancel Count Session"
                                  className="p-1 rounded-lg border border-slate-200 text-rose-500 hover:bg-rose-50"
                                >
                                  <X className="size-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {countsMeta.totalPages > 1 && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-mono">
                  Showing {countsList.length} of {countsMeta.total} sessions
                </span>
                <VendorTablePagination
                  meta={countsMeta}
                  onPageChange={(p) => setCountsMeta((prev) => ({ ...prev, page: p }))}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 6: VARIANCE RECONCILIATION & APPROVALS               */}
      {/* ======================================================== */}
      {activeTab === "reconciliation" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <VendorKpiCard
              title="Awaiting Review"
              value={countsList.filter((s) => s.status === "submitted" || s.status === "under_review").length}
              subtitle="Sessions pending sign-off"
              icon={Clock}
              variant="amber"
            />
            <VendorKpiCard
              title="Approved for Recon"
              value={countsList.filter((s) => s.status === "approved").length}
              subtitle="Ready for atomic ledger write"
              icon={CheckCircle2}
              variant="indigo"
            />
            <VendorKpiCard
              title="Recounts Required"
              value={countsList.filter((s) => s.status === "recount_required").length}
              subtitle="Material variance re-check"
              icon={AlertTriangle}
              variant="rose"
            />
            <VendorKpiCard
              title="Fully Reconciled"
              value={countsList.filter((s) => s.status === "reconciled").length}
              subtitle="Ledger balanced &amp; updated"
              icon={ShieldCheck}
              variant="emerald"
            />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Variance Reconciliation Governance</h3>
                <p className="text-xs text-slate-500">
                  Review physical count discrepancies against live stock and authorize movement-aware ledger updates.
                </p>
              </div>
            </div>

            {isCountsLoading ? (
              <div className="py-24 flex flex-col items-center justify-center">
                <Loader2 className="size-8 text-[#004D38] animate-spin" />
                <p className="mt-2 text-xs font-medium text-slate-500">Loading audit reconciliation sessions...</p>
              </div>
            ) : countsList.length === 0 ? (
              <VendorEmptyState
                icon={ClipboardCheck}
                title="No reconciliation sessions active"
                description="Submitted stock counts will appear here for review, recount dispatch, and atomic ledger reconciliation."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Session Number</th>
                      <th className="py-3 px-4">Warehouse</th>
                      <th className="py-3 px-4 text-center">Expected / Counted</th>
                      <th className="py-3 px-4 text-center">Net Variance</th>
                      <th className="py-3 px-4 text-center">Accuracy Rates</th>
                      <th className="py-3 px-4">Lifecycle Status</th>
                      <th className="py-3 px-4 text-right">Governance Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {countsList.map((session) => {
                      const netVariance = session.totalVarianceQty || 0;
                      return (
                        <tr key={session._id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {session.countNumber}
                            <span className="block text-[10px] text-slate-400 font-sans font-normal">
                              Submitted: {session.submittedAt ? new Date(session.submittedAt).toLocaleDateString() : "Pending"}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-slate-800">{session.warehouseId?.name || "Warehouse"}</p>
                            <span className="text-[10px] font-mono text-slate-400">{session.warehouseId?.code || "FC"}</span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold">
                            <span className="text-slate-500">{session.totalExpectedQty || 0}</span>
                            <span className="text-slate-300 mx-1">/</span>
                            <span className="text-slate-900">{session.totalCountedQty || 0}</span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold">
                            <span className={`inline-block px-2 py-0.5 rounded-lg text-xs ${
                              netVariance > 0
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : netVariance < 0
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-slate-50 text-slate-600 border border-slate-200"
                            }`}>
                              {netVariance > 0 ? `+${netVariance} Excess` : netVariance < 0 ? `${netVariance} Shortage` : "0 Net Balance"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="text-[11px] font-mono">
                              <span className="text-slate-600">SKU: {session.skuAccuracyRate ?? 100}%</span>
                              <span className="text-slate-300 mx-1">•</span>
                              <span className="text-slate-600">Qty: {session.quantityAccuracyRate ?? 100}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <VendorStatusBadge status={session.status} />
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenCountEntry(session)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
                              >
                                <Search className="size-3" />
                                <span>Inspect Variances</span>
                              </button>

                              {(session.status === "submitted" || session.status === "under_review") && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenApproveModal(session)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenRecountModal(session)}
                                    className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs"
                                  >
                                    Recount
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenRejectModal(session)}
                                    className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 font-semibold text-xs"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}

                              {session.status === "approved" && (
                                <button
                                  type="button"
                                  disabled={isReconciling}
                                  onClick={() => handleExecuteReconcile(session._id)}
                                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#004D38] hover:bg-[#003829] text-white font-bold text-xs shadow-xs"
                                >
                                  {isReconciling ? <Loader2 className="size-3 animate-spin" /> : <ShieldCheck className="size-3" />}
                                  <span>Reconcile Now</span>
                                </button>
                              )}

                              {session.status === "reconciled" && (
                                <button
                                  type="button"
                                  onClick={() => handleExportCountSession(session._id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs"
                                >
                                  <FileSpreadsheet className="size-3" />
                                  <span>Audit CSV</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 7: WAREHOUSE ANALYTICS & INVENTORY INTELLIGENCE     */}
      {/* ======================================================== */}
      {activeTab === "analytics" && (
        <WarehouseAnalyticsTab warehouses={warehouses} />
      )}

      {/* ======================================================== */}
      {/* MODAL: STRUCTURED INVENTORY ADJUSTMENT                   */}
      {/* ======================================================== */}
      {adjustModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Adjust Inventory Stock</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  SKU: {adjustModalItem.sku} • {adjustModalItem.warehouseId?.name || "FC"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseAdjustModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteAdjustment} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Adjustment Action</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType("add")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                      adjustType === "add"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    + Add Units
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType("remove")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                      adjustType === "remove"
                        ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    - Deduct Units
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Reason Code</label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800"
                >
                  {ADJUSTMENT_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Stock Condition</label>
                <select
                  value={adjustCondition}
                  onChange={(e) => setAdjustCondition(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800"
                >
                  <option value="sellable">Sellable (Available for Fulfillment)</option>
                  <option value="damaged">Damaged (Non-Sellable)</option>
                  <option value="defective">Defective (Non-Sellable)</option>
                  <option value="expired">Expired (Non-Sellable)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Quantity</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Audit Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Physical inventory cycle count correction"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleCloseAdjustModal}
                  disabled={isAdjusting}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdjusting}
                  className="px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003829] text-white font-semibold text-xs"
                >
                  {isAdjusting ? "Updating..." : "Commit Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: REORDER THRESHOLD CONFIGURATION                   */}
      {/* ======================================================== */}
      {thresholdModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Configure Reorder Levels</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">SKU: {thresholdModalItem.sku}</p>
              </div>
              <button
                type="button"
                onClick={() => setThresholdModalItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteThresholdUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Low Stock Threshold</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={newThreshold}
                  onChange={(e) => setNewThreshold(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Reorder Level (Target Stock)</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={newReorderLevel}
                  onChange={(e) => setNewReorderLevel(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setThresholdModalItem(null)}
                  disabled={isUpdatingThreshold}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingThreshold}
                  className="px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003829] text-white font-semibold text-xs"
                >
                  {isUpdatingThreshold ? "Saving..." : "Save Reorder Thresholds"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: NEW INBOUND GOODS SHIPMENT                        */}
      {/* ======================================================== */}
      {isNewReceivingModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">New Inbound Stock Shipment</h3>
                <p className="text-xs text-slate-500 mt-0.5">Log supplier shipment arrival at fulfillment center</p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewReceivingModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateReceivingRecord} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Destination Fulfillment Center</label>
                <select
                  value={newReceivingWarehouse}
                  onChange={(e) => setNewReceivingWarehouse(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800"
                >
                  {warehouses.map((wh) => (
                    <option key={wh._id} value={wh._id}>
                      {wh.name} ({wh.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Product SKU / Variant</label>
                <select
                  value={newReceivingVariantId}
                  onChange={(e) => setNewReceivingVariantId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800"
                >
                  <option value="">Select product variant to receive...</option>
                  {inventory.map((inv) => (
                    <option key={inv.productVariantId || inv._id} value={inv.productVariantId || inv._id}>
                      {inv.sku} • {inv.productTitle}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Supplier Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Apex Manufacturing"
                    value={newReceivingSupplier}
                    onChange={(e) => setNewReceivingSupplier(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Reference Document #</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-9901"
                    value={newReceivingRefDoc}
                    onChange={(e) => setNewReceivingRefDoc(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Quantity Expected / Arrived</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={newReceivingQty}
                  onChange={(e) => setNewReceivingQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="autoConfirmCheck"
                  checked={newReceivingAutoConfirm}
                  onChange={(e) => setNewReceivingAutoConfirm(e.target.checked)}
                  className="rounded text-[#004D38] focus:ring-[#004D38]"
                />
                <label htmlFor="autoConfirmCheck" className="text-xs text-slate-700 font-semibold cursor-pointer">
                  Auto-confirm shipment immediately (Add to live stock now)
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsNewReceivingModalOpen(false)}
                  disabled={isSubmittingReceiving}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReceiving}
                  className="px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003829] text-white font-semibold text-xs"
                >
                  {isSubmittingReceiving ? "Creating..." : "Save Receiving Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: NEW INTER-WAREHOUSE STOCK TRANSFER                */}
      {/* ======================================================== */}
      {isNewTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Initiate Stock Transfer</h3>
                <p className="text-xs text-slate-500 mt-0.5">Move inventory between regional fulfillment centers</p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewTransferModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTransfer} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Source Warehouse</label>
                  <select
                    value={newTransferSourceWh}
                    onChange={(e) => setNewTransferSourceWh(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800"
                  >
                    {warehouses.map((wh) => (
                      <option key={wh._id} value={wh._id}>
                        {wh.name} ({wh.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Destination Warehouse</label>
                  <select
                    value={newTransferDestWh}
                    onChange={(e) => setNewTransferDestWh(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800"
                  >
                    {warehouses.map((wh) => (
                      <option key={wh._id} value={wh._id}>
                        {wh.name} ({wh.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Product SKU to Transfer</label>
                <select
                  value={newTransferVariantId}
                  onChange={(e) => setNewTransferVariantId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800"
                >
                  <option value="">Select product variant...</option>
                  {inventory.map((inv) => (
                    <option key={inv.productVariantId || inv._id} value={inv.productVariantId || inv._id}>
                      {inv.sku} • On Hand: {inv.onHand}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Transfer Quantity</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={newTransferQty}
                  onChange={(e) => setNewTransferQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsNewTransferModalOpen(false)}
                  disabled={isSubmittingTransfer}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTransfer}
                  className="px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003829] text-white font-semibold text-xs"
                >
                  {isSubmittingTransfer ? "Creating..." : "Create & Approve Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: DISPATCH TRANSFER                                 */}
      {/* ======================================================== */}
      {dispatchModalTransfer && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Dispatch Stock Transfer</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{dispatchModalTransfer.transferNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setDispatchModalTransfer(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteDispatch} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Logistics Carrier Name</label>
                <input
                  type="text"
                  placeholder="e.g. BlueDart, Delhivery Surface"
                  value={dispatchCarrier}
                  onChange={(e) => setDispatchCarrier(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Carrier Tracking Reference #</label>
                <input
                  type="text"
                  placeholder="e.g. BD-EXP-99001122"
                  value={dispatchTrackingRef}
                  onChange={(e) => setDispatchTrackingRef(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-800 border border-amber-200">
                <p className="font-semibold">Transit Stock Invariant:</p>
                <p className="text-[11px] mt-0.5">
                  Confirming dispatch will deduct units from the source warehouse on-hand stock and mark the shipment in transit.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setDispatchModalTransfer(null)}
                  disabled={isDispatching}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDispatching}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs"
                >
                  {isDispatching ? "Dispatching..." : "Confirm & Dispatch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: RECEIVE TRANSFER AT DESTINATION                   */}
      {/* ======================================================== */}
      {receiveModalTransfer && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Receive Stock Transfer</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{receiveModalTransfer.transferNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setReceiveModalTransfer(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteReceive} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Accepted Quantity</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={receiveAcceptedQty}
                  onChange={(e) => setReceiveAcceptedQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Rejected / Damaged in Transit</label>
                <input
                  type="number"
                  min={0}
                  value={receiveRejectedQty}
                  onChange={(e) => setReceiveRejectedQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                />
              </div>

              {receiveRejectedQty > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Discrepancy Reason</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Damaged carton during transit"
                    value={receiveDiscrepancyReason}
                    onChange={(e) => setReceiveDiscrepancyReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setReceiveModalTransfer(null)}
                  disabled={isReceivingAction}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReceivingAction}
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs"
                >
                  {isReceivingAction ? "Receiving..." : "Confirm Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: NEW STOCK COUNT SESSION                           */}
      {/* ======================================================== */}
      {isNewCountModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">New Stock Count Session</h3>
                <p className="text-xs text-slate-500 mt-0.5">Initialize a physical stock or cycle count audit</p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewCountModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCountSession} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Fulfillment Center</label>
                <select
                  value={newCountWarehouse}
                  onChange={(e) => setNewCountWarehouse(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800"
                >
                  {warehouses.map((wh) => (
                    <option key={wh._id} value={wh._id}>
                      {wh.name} ({wh.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Count Type</label>
                  <select
                    value={newCountType}
                    onChange={(e) => setNewCountType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800"
                  >
                    <option value="physical">Physical Wall-to-Wall</option>
                    <option value="cycle">Perpetual Cycle Count</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Count Scope</label>
                  <select
                    value={newCountScope}
                    onChange={(e) => setNewCountScope(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800"
                  >
                    <option value="full">Full Warehouse Stock</option>
                    <option value="low_stock">Low-Stock SKUs Only</option>
                    <option value="high_value">High-Value Inventory</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Materiality Variance Threshold (%)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={newCountMateriality}
                  onChange={(e) => setNewCountMateriality(Math.max(1, parseInt(e.target.value, 10) || 5))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Discrepancies exceeding this percentage will be flagged for mandatory recount or supervisory review.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Audit Notes / Scope Justification</label>
                <input
                  type="text"
                  placeholder="e.g. Q4 end-of-year physical cycle audit"
                  value={newCountNotes}
                  onChange={(e) => setNewCountNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsNewCountModalOpen(false)}
                  disabled={isCreatingCount}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingCount}
                  className="px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003829] text-white font-semibold text-xs"
                >
                  {isCreatingCount ? "Initializing..." : "Start Counting Session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DRAWER / MODAL: COUNT ENTRY & INSPECTION                */}
      {/* ======================================================== */}
      {activeCountSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">Count Entry &amp; Physical Inspection</h3>
                  <VendorStatusBadge status={activeCountSession.status} />
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Session: {activeCountSession.countNumber} • {activeCountSession.warehouseId?.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveCountSession(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                      <th className="py-2.5 px-3">SKU &amp; Variant</th>
                      <th className="py-2.5 px-3 text-center">Snapshot Qty</th>
                      <th className="py-2.5 px-3 text-center">Physical Count</th>
                      <th className="py-2.5 px-3 text-center">Variance</th>
                      <th className="py-2.5 px-3">Condition Classification</th>
                      <th className="py-2.5 px-3">Discrepancy Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(activeCountSession.items || []).map((item) => {
                      const entry = countItemEntries[item._id] || {
                        countedOnHand: item.countedOnHand ?? item.snapshotOnHand,
                        countedCondition: item.countedCondition || "sellable",
                        inspectionNotes: item.inspectionNotes || "",
                        reason: item.reason || "",
                      };

                      const currentCount = parseInt(entry.countedOnHand, 10) || 0;
                      const variance = currentCount - item.snapshotOnHand;

                      return (
                        <tr key={item._id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3">
                            <span className="font-mono font-bold text-slate-900">{item.sku}</span>
                            <span className="text-[10px] text-slate-400 block truncate max-w-xs">{item.productName}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-600">
                            {item.snapshotOnHand}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              min={0}
                              value={entry.countedOnHand}
                              disabled={activeCountSession.status === "reconciled" || activeCountSession.status === "cancelled"}
                              onChange={(e) => handleUpdateCountItem(item._id, "countedOnHand", e.target.value)}
                              className="w-20 px-2 py-1 text-center font-mono font-bold border border-slate-300 rounded-lg text-xs"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md text-[11px] ${
                                variance > 0
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : variance < 0
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : "bg-slate-50 text-slate-600 border border-slate-200"
                              }`}
                            >
                              {variance > 0 ? `+${variance}` : variance}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={entry.countedCondition}
                              disabled={activeCountSession.status === "reconciled" || activeCountSession.status === "cancelled"}
                              onChange={(e) => handleUpdateCountItem(item._id, "countedCondition", e.target.value)}
                              className="px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-medium"
                            >
                              <option value="sellable">Sellable (Good Condition)</option>
                              <option value="damaged">Damaged (Packaging/Physical)</option>
                              <option value="defective">Defective / Non-Functional</option>
                              <option value="expired">Expired / Shelf-Life Breached</option>
                              <option value="missing">Missing / Unaccounted Loss</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              placeholder="Notes or reason..."
                              value={entry.reason || entry.inspectionNotes}
                              disabled={activeCountSession.status === "reconciled" || activeCountSession.status === "cancelled"}
                              onChange={(e) => handleUpdateCountItem(item._id, "reason", e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <span className="text-xs text-slate-500 font-mono">
                {activeCountSession.items?.length || 0} variants audited in session
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveCountSession(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs bg-white"
                >
                  Close
                </button>

                {activeCountSession.status !== "reconciled" && activeCountSession.status !== "cancelled" && (
                  <>
                    <button
                      type="button"
                      disabled={isSavingCounts || isSubmittingCount}
                      onClick={() => handleSaveCounts(false)}
                      className="px-4 py-2 rounded-xl border border-slate-300 text-slate-800 hover:bg-slate-100 font-semibold text-xs bg-white"
                    >
                      {isSavingCounts ? "Saving..." : "Save Progress"}
                    </button>

                    <button
                      type="button"
                      disabled={isSavingCounts || isSubmittingCount}
                      onClick={() => handleSaveCounts(true)}
                      className="px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003829] text-white font-bold text-xs shadow-xs"
                    >
                      {isSubmittingCount ? "Submitting..." : "Submit for Variance Review"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: RECOUNT REQUEST                                   */}
      {/* ======================================================== */}
      {recountModalSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Request Physical Recount</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{recountModalSession.countNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setRecountModalSession(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteRecount} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Recount Reason &amp; Specific SKUs</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Discrepancy exceeds 5% threshold on SKUs CHAIR-01 and DESK-02. Recount mandatory."
                  value={recountNotes}
                  onChange={(e) => setRecountNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setRecountModalSession(null)}
                  disabled={isRecounting}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRecounting}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs"
                >
                  {isRecounting ? "Submitting..." : "Initiate Recount"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: APPROVE VARIANCES                                 */}
      {/* ======================================================== */}
      {approvalModalSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Approve Variances for Reconciliation</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{approvalModalSession.countNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setApprovalModalSession(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteApprove} className="p-6 space-y-4">
              <div className="p-3 bg-emerald-50 rounded-xl text-xs text-emerald-800 border border-emerald-200">
                <p className="font-semibold">Authorization Summary:</p>
                <p className="text-[11px] mt-0.5">
                  Approving this count confirms the physical variance. Once approved, the atomic reconciliation can be committed to the inventory ledger.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Approval Sign-off Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Variances verified against warehouse CCTV and bin audits"
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setApprovalModalSession(null)}
                  disabled={isApproving}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isApproving}
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs"
                >
                  {isApproving ? "Approving..." : "Authorize Variances"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: REJECT COUNT                                      */}
      {/* ======================================================== */}
      {rejectionModalSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Reject Stock Count</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{rejectionModalSession.countNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setRejectionModalSession(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteReject} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Rejection Reason</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Unexplained inventory loss without physical evidence. Session voided."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setRejectionModalSession(null)}
                  disabled={isRejecting}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRejecting}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs"
                >
                  {isRejecting ? "Rejecting..." : "Confirm Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
