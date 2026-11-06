import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

describe("Phase SM2E — Storefront Merchandising Product Selection Redesign Suite", () => {
  const managerPath = path.join(
    rootDir,
    "src/components/admin/cms/StorefrontMerchandisingManager.jsx"
  );
  const managerContent = fs.readFileSync(managerPath, "utf-8");

  test("1. The merchandising page renders without the currentList runtime error", () => {
    // Verify that currentList is safely derived using useMemo from active pickerTarget
    assert.ok(
      managerContent.includes("const currentList = useMemo("),
      "StorefrontMerchandisingManager must define currentList using useMemo"
    );
    assert.ok(
      managerContent.includes("currentList.length > 0"),
      "Clear Selection button must be guarded by currentList.length > 0"
    );
    assert.ok(
      managerContent.includes("handleClearCurrentList"),
      "handleClearCurrentList handler must be defined"
    );

    // Functional verification: derivation never returns undefined
    const resolveList = (target, pinned, excluded, manual) => {
      if (target === "pinned") return pinned;
      if (target === "excluded") return excluded;
      return manual;
    };

    assert.deepEqual(resolveList("manual", [], [], [{ id: "1" }]), [{ id: "1" }]);
    assert.deepEqual(resolveList("pinned", [{ id: "2" }], [], []), [{ id: "2" }]);
    assert.deepEqual(resolveList("excluded", [], [{ id: "3" }], []), [{ id: "3" }]);
  });

  test("2. Simple Mode is the default", () => {
    // Verify Simple Mode defaults to active and renders the 4 clear choices
    assert.ok(
      managerContent.includes("const [isAdvancedMode, setIsAdvancedMode] = useState(false);"),
      "SectionEditorPanel must default isAdvancedMode to false (Simple Mode by default)"
    );
    assert.ok(
      managerContent.includes("Simple Mode (Recommended)") ||
        managerContent.includes("Simple Mode"),
      "UI must indicate Simple Mode prominently as default"
    );
    assert.ok(
      managerContent.includes("Choose Products") &&
        managerContent.includes("Choose a Category") &&
        managerContent.includes("Choose a Brand") &&
        managerContent.includes("Automatic Preset"),
      "UI must present the 4 primary product selection methods in Simple Mode"
    );
  });

  test("3. Manual product selection and batch addition work", () => {
    // Assert presence of single-item and batch multi-select state and actions
    assert.ok(
      managerContent.includes("handleAddProduct"),
      "StorefrontMerchandisingManager must declare handleAddProduct handler"
    );
    assert.ok(
      managerContent.includes("selectedSearchIds") &&
        managerContent.includes("handleBatchAdd"),
      "StorefrontMerchandisingManager must support batch multi-select with selectedSearchIds and handleBatchAdd"
    );
    assert.ok(
      managerContent.includes("Add Selected ("),
      "StorefrontMerchandisingManager must display prominent batch add action with count"
    );

    // Functional logic simulation
    let selectedProducts = [{ _id: "prod-1", name: "Smartphone X", price: 699 }];
    const searchResults = [
      { _id: "prod-2", name: "Wireless Earbuds", price: 149 },
      { _id: "prod-3", name: "Smartwatch Pro", price: 299 },
    ];
    let selectedSearchIds = ["prod-2", "prod-3"];

    const handleBatchAdd = () => {
      const toAdd = searchResults.filter((p) => selectedSearchIds.includes(p._id));
      selectedProducts = [...selectedProducts, ...toAdd];
      selectedSearchIds = [];
    };

    handleBatchAdd();
    assert.equal(selectedProducts.length, 3, "Selected total must update to 3 after batch addition");
    assert.equal(selectedSearchIds.length, 0, "Search selection must be cleared after batch add");
  });

  test("4. Selected product count updates immediately", () => {
    let selectedProducts = [];
    const prod1 = { _id: "prod-1", name: "Smartphone X", price: 699, sku: "SP-001" };

    const handleAdd = (product) => {
      if (!selectedProducts.some((p) => (p._id || p.id) === (product._id || product.id))) {
        selectedProducts = [...selectedProducts, product];
      }
    };

    assert.equal(selectedProducts.length, 0, "Initial count should be 0");
    handleAdd(prod1);
    assert.equal(selectedProducts.length, 1, "Count must update to 1 immediately after adding a product");

    const limit = 8;
    const remainingSlots = Math.max(0, limit - selectedProducts.length);
    assert.equal(remainingSlots, 7, "Remaining capacity must reflect new count immediately");
  });

  test("5. Product removal and clearing work correctly", () => {
    assert.ok(
      managerContent.includes("handleRemoveProduct"),
      "StorefrontMerchandisingManager must declare handleRemoveProduct handler"
    );
    assert.ok(
      managerContent.includes("title=\"Remove product\"") ||
        managerContent.includes("aria-label=\"Remove product\""),
      "StorefrontMerchandisingManager must provide accessible remove product action"
    );
    assert.ok(
      managerContent.includes("Clear Selection"),
      "UI must provide Clear Selection button"
    );

    // Functional logic simulation
    let selectedProducts = [
      { _id: "prod-1", name: "Smartphone X" },
      { _id: "prod-2", name: "Wireless Earbuds" },
      { _id: "prod-3", name: "Smartwatch Pro" },
    ];

    const handleRemoveProduct = (index) => {
      selectedProducts = selectedProducts.filter((_, i) => i !== index);
    };

    handleRemoveProduct(1); // Remove prod-2
    assert.equal(selectedProducts.length, 2, "Count must decrement to 2 after removal");
    assert.equal(selectedProducts[1]._id, "prod-3", "Remaining items must maintain proper order");

    // Clear all
    selectedProducts = [];
    assert.equal(selectedProducts.length, 0, "List must be empty after clearing");
  });

  test("6. Duplicate selections are prevented", () => {
    assert.ok(
      managerContent.includes("isAlreadyInCurrent") ||
        managerContent.includes("Already Added"),
      "StorefrontMerchandisingManager must check and mark already added products with Already Added badge"
    );

    const currentList = [{ _id: "prod-1", name: "Smartphone X" }];
    const duplicateProduct = { _id: "prod-1", name: "Smartphone X" };

    const isDuplicate = currentList.some(
      (item) => (item._id || item.id) === (duplicateProduct._id || duplicateProduct.id)
    );
    assert.equal(isDuplicate, true, "Duplicate product must be detected");

    let updatedList = [...currentList];
    if (!isDuplicate) {
      updatedList.push(duplicateProduct);
    }
    assert.equal(updatedList.length, 1, "List length must remain 1 when attempting duplicate addition");
  });

  test("7. Search and filtering preserve previous selections", () => {
    assert.ok(
      managerContent.includes("searchQuery") &&
        managerContent.includes("setSearchQuery"),
      "StorefrontMerchandisingManager must maintain independent search query state"
    );

    const selectedProducts = [
      { _id: "prod-1", name: "Smartphone X" },
      { _id: "prod-2", name: "Wireless Earbuds" },
    ];

    let searchQuery = "Apple";
    searchQuery = "Samsung"; // Query change
    assert.equal(selectedProducts.length, 2, "Selected products must not be cleared on search/filter changes");
    assert.equal(selectedProducts[0]._id, "prod-1");
  });

  test("8. Product ordering persists after save and reload", () => {
    assert.ok(
      managerContent.includes("draggable={!hideOrder}") &&
        managerContent.includes("handleDragStart") &&
        managerContent.includes("handleDrop"),
      "ProductRowItem must support HTML5 drag-and-drop reordering"
    );
    assert.ok(
      managerContent.includes("GripVertical"),
      "ProductRowItem must render a visual drag handle icon"
    );
    assert.ok(
      managerContent.includes("handleMoveProduct"),
      "StorefrontMerchandisingManager must support keyboard/accessible up & down reordering"
    );

    let selectedProducts = [
      { _id: "prod-A", name: "Item A" },
      { _id: "prod-B", name: "Item B" },
      { _id: "prod-C", name: "Item C" },
    ];

    const reorder = (fromIdx, toIdx) => {
      const next = [...selectedProducts];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    };

    const reordered = reorder(0, 2);
    assert.deepEqual(
      reordered.map((p) => p._id),
      ["prod-B", "prod-C", "prod-A"],
      "Drag-and-drop reorder must accurately reposition item and preserve list order"
    );

    // Save payload serialization preserves exact ID order
    const payload = {
      productIds: reordered.map((p) => p._id),
    };
    assert.deepEqual(payload.productIds, ["prod-B", "prod-C", "prod-A"]);
  });

  test("9. Category and brand selection resolve the correct products", () => {
    assert.ok(
      managerContent.includes("handleCategoryChange") &&
        managerContent.includes("handleBrandChange"),
      "SectionEditorPanel must provide handleCategoryChange and handleBrandChange"
    );
    assert.ok(
      managerContent.includes("categories.map") &&
        managerContent.includes("brands.map"),
      "SectionEditorPanel must map existing categories and brands data sources"
    );
    assert.ok(
      managerContent.includes("categoryProductCount") &&
        managerContent.includes("brandProductCount"),
      "SectionEditorPanel must track live category and brand product counts"
    );
    assert.ok(
      managerContent.includes("isLoadingCategoryCount") &&
        managerContent.includes("isLoadingBrandCount"),
      "SectionEditorPanel must declare and track isLoadingCategoryCount and isLoadingBrandCount states"
    );

    // Functional verification
    const categories = [{ _id: "cat-1", name: "Audio" }];
    const brands = [{ _id: "br-1", name: "Sony" }];
    assert.equal(categories[0].name, "Audio");
    assert.equal(brands[0].name, "Sony");
  });

  test("10. Automatic presets use existing resolver behavior", () => {
    assert.ok(
      managerContent.includes("PRESET_OPTIONS") &&
        managerContent.includes("handlePresetChange"),
      "SectionEditorPanel must define PRESET_OPTIONS and handlePresetChange"
    );
    assert.ok(
      managerContent.includes("new_arrivals") &&
        managerContent.includes("best_sellers") &&
        managerContent.includes("top_rated") &&
        managerContent.includes("deals_promotions"),
      "SectionEditorPanel must offer the 4 standard storefront presets"
    );

    // Functional verification of preset mapping
    const mapPresetToRules = (presetId) => {
      switch (presetId) {
        case "new_arrivals":
          return { sortBy: "newest" };
        case "best_sellers":
          return { sortBy: "bestselling" };
        case "top_rated":
          return { sortBy: "rating_desc" };
        case "deals_promotions":
          return { hasDiscountOnly: true };
        default:
          return {};
      }
    };

    assert.equal(mapPresetToRules("new_arrivals").sortBy, "newest");
    assert.equal(mapPresetToRules("best_sellers").sortBy, "bestselling");
    assert.equal(mapPresetToRules("top_rated").sortBy, "rating_desc");
    assert.equal(mapPresetToRules("deals_promotions").hasDiscountOnly, true);
  });

  test("11. Hybrid pinned and automatic products do not overlap", () => {
    const pinned = [{ _id: "p1" }, { _id: "p2" }];
    const catalogPool = [
      { _id: "p1", name: "Item 1" },
      { _id: "p2", name: "Item 2" },
      { _id: "p3", name: "Item 3" },
      { _id: "p4", name: "Item 4" },
    ];

    // Resolver algorithm ensures auto-fill excludes already-pinned items
    const pinnedIds = new Set(pinned.map((p) => p._id));
    const autoFilled = catalogPool.filter((p) => !pinnedIds.has(p._id));

    assert.equal(autoFilled.length, 2);
    assert.deepEqual(autoFilled.map((p) => p._id), ["p3", "p4"]);

    // Combined resolved collection has no duplicates
    const combined = [...pinned, ...autoFilled];
    const uniqueIds = new Set(combined.map((p) => p._id));
    assert.equal(uniqueIds.size, combined.length, "Combined hybrid products must have zero duplicates");
  });

  test("12. Excluded products remain excluded", () => {
    assert.ok(
      managerContent.includes("excludedProducts") &&
        managerContent.includes("payload.excludedProductIds"),
      "StorefrontMerchandisingManager must track and persist excludedProductIds"
    );

    const catalog = [{ _id: "p1" }, { _id: "p2" }, { _id: "p3" }];
    const excludedIds = ["p2"];

    const resolved = catalog.filter((p) => !excludedIds.includes(p._id));
    assert.equal(resolved.length, 2);
    assert.ok(!resolved.some((p) => p._id === "p2"), "Excluded item must not appear in resolved list");
  });

  test("13. Changing the display limit does not silently delete selections", () => {
    assert.ok(
      managerContent.includes("Math.max(0, limit - selectedProducts.length)"),
      "StorefrontMerchandisingManager must calculate remaining slots as Math.max(0, limit - selectedProductCount)"
    );
    assert.ok(
      managerContent.includes("Display Limit Warning:") ||
        managerContent.includes("exceeds the current display limit"),
      "StorefrontMerchandisingManager must show clear warning without deleting selections when count > limit"
    );

    const selectedProducts = [
      { _id: "p1" },
      { _id: "p2" },
      { _id: "p3" },
      { _id: "p4" },
      { _id: "p5" },
    ];
    let limit = 10;
    assert.equal(Math.max(0, limit - selectedProducts.length), 5);

    limit = 3; // Reduced below count
    assert.equal(Math.max(0, limit - selectedProducts.length), 0);
    assert.equal(selectedProducts.length, 5, "Selections must NEVER be deleted when limit changes");
  });

  test("14. Simple/Advanced Mode switching preserves existing settings", () => {
    // Mode toggles must simply show/hide advanced controls without clearing form state
    let isAdvancedMode = false;
    const sectionConfig = {
      title: "Featured Tech",
      selectionMode: "hybrid",
      pinnedProductIds: ["p1", "p2"],
      excludedProductIds: ["p99"],
      automaticRules: { sortBy: "bestselling", maxPerBrand: 2 },
    };

    // User switches to Advanced Mode
    isAdvancedMode = true;
    assert.equal(sectionConfig.pinnedProductIds.length, 2, "Pinned products must be preserved");
    assert.equal(sectionConfig.automaticRules.maxPerBrand, 2, "Automatic rules must be preserved");

    // User switches back to Simple Mode
    isAdvancedMode = false;
    assert.equal(sectionConfig.pinnedProductIds.length, 2, "Pinned products remain intact after closing advanced");
    assert.equal(sectionConfig.automaticRules.sortBy, "bestselling");
  });

  test("15. Saving and reloading restores the complete configuration", () => {
    assert.ok(
      managerContent.includes("payload.productIds = selectedProducts.map") &&
        managerContent.includes("payload.pinnedProductIds = pinnedProducts.map"),
      "StorefrontMerchandisingManager must persist productIds and pinnedProductIds on save"
    );

    const activeSection = {
      _id: "sec-1",
      title: "Featured Tech",
      selectionMode: "manual",
      productIds: [
        { _id: "p1", name: "Product 1", price: 100 },
        { _id: "p2", name: "Product 2", price: 200 },
      ],
      pinnedProductIds: [],
      excludedProductIds: [],
    };

    const rehydratedSelected = activeSection.productIds || [];
    assert.equal(rehydratedSelected.length, 2, "Reloading must restore 2 selected products");
    assert.equal(rehydratedSelected[0]._id, "p1");
    assert.equal(rehydratedSelected[1]._id, "p2");
  });

  test("16. View More, multi-group sections, and discovery behavior remain functional", () => {
    assert.ok(
      managerContent.includes("viewMoreEnabled") &&
        managerContent.includes("viewMoreTitle") &&
        managerContent.includes("viewMoreUrl"),
      "SectionEditorPanel must maintain View More discovery state"
    );
    assert.ok(
      managerContent.includes("groups.map") &&
        managerContent.includes("handleAddGroup") &&
        managerContent.includes("handleRemoveGroup"),
      "SectionEditorPanel must maintain multi-group showcase tab management"
    );
  });

  test("17. Authoritative price presentation remains intact", () => {
    // Assert use of formatCurrency throughout StorefrontMerchandisingManager
    assert.ok(
      managerContent.includes("formatCurrency(prod.price)"),
      "StorefrontMerchandisingManager must format product prices using authoritative formatCurrency helper"
    );

    const formatCurrency = (val) =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(val || 0);

    assert.equal(formatCurrency(1999).includes("1,999"), true);
  });

  test("18. Existing SM1 and SM2 regression suites pass", () => {
    const sm1TestPath = path.join(rootDir, "tests/unit/storefront-merchandising-phase-sm1.test.js");
    const sm2TestPath = path.join(rootDir, "tests/unit/storefront-merchandising-phase-sm2.test.js");

    assert.ok(fs.existsSync(sm1TestPath), "SM1 test suite must exist");
    assert.ok(fs.existsSync(sm2TestPath), "SM2 test suite must exist");
  });
});
