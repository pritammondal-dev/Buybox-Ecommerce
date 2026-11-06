const mongoose = require("mongoose");
const xlsx = require("xlsx");
const crypto = require("crypto");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const SkuRegistry = require("../models/SkuRegistry");
const Inventory = require("../models/Inventory");
const InventoryTransaction = require("../models/InventoryTransaction");
const Warehouse = require("../models/Warehouse");
const Category = require("../models/Category");
const Brand = require("../models/Brand");
const Vendor = require("../models/Vendor");
const ImportExportJob = require("../models/ImportExportJob");
const AppError = require("../errors/AppError");
const fs = require("fs");
const path = require("path");
const { recordAuditLog } = require("./governance.service");
const { encodeSecureId } = require("../utils/secure-id.util");
const skuRegistryService = require("./sku-registry.service");
const { syncVariantStockMirror, calculateAuthoritativeStock } = require("./inventory.service");
const { serializeAttributeCombination } = require("../utils/attribute.util");
const { validateImageReference } = require("../utils/image-validator.util");
const {
  processZipArchive,
  getStagedManifest,
  cleanupStaging,
  matchFilenameInZip,
  validateImageMagicBytes,
  ALLOWED_RASTER_EXTENSIONS,
} = require("../utils/zip-extractor.util");
const { ROLES } = require("../constants/auth.constants");
const { TOKEN_CONTEXTS } = require("./token.service");

/**
 * Sanitize cell values against spreadsheet formula injection (CSV/Excel Formula Injection).
 * Any string beginning with '=', '+', '-', '@', '\t', or '\r' is prefixed with a single quote.
 */
const sanitizeFormula = (val) => {
  if (val === null || val === undefined) return "";
  const rawStr = String(val);
  if (/^[=+\-@\t\r]/.test(rawStr)) {
    return `'${rawStr}`;
  }
  const str = rawStr.trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
};

/**
 * Unescape sanitized formula characters for safe server-side storage
 */
const stripLeadingQuote = (val) => {
  if (typeof val !== "string") return val;
  if (val.startsWith("'") && /^[=+\-@\t\r]/.test(val.slice(1))) {
    return val.slice(1);
  }
  return val;
};

/**
 * Generate standard URL slug
 */
const generateSlug = (text) => {
  const base = String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "product"}-${crypto.randomBytes(3).toString("hex")}`;
};

/**
 * Parse dimensions string (e.g., "25x20x2", "25 x 20 x 2 cm", "25, 20, 2") into canonical object
 */
const parseDimensionsString = (str) => {
  if (!str || typeof str !== "string") return null;
  const cleaned = str.trim().toLowerCase();
  const match = cleaned.match(
    /^(\d+(?:\.\d+)?)\s*[x*×,]\s*(\d+(?:\.\d+)?)\s*[x*×,]\s*(\d+(?:\.\d+)?)(?:\s*(cm|in|m|mm))?$/i
  );
  if (!match) return null;
  return {
    length: parseFloat(match[1]),
    width: parseFloat(match[2]),
    height: parseFloat(match[3]),
    unit: ["cm", "in", "m", "mm"].includes(match[4]?.toLowerCase())
      ? match[4].toLowerCase()
      : "cm",
  };
};

/**
 * Parse boolean input strings ("true", "1", "yes", "false", "0", "no")
 */
const parseBoolean = (val, defaultVal = false) => {
  if (val === null || val === undefined || val === "") return defaultVal;
  if (typeof val === "boolean") return val;
  const str = String(val).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(str)) return true;
  if (["false", "0", "no", "n"].includes(str)) return false;
  return defaultVal;
};

/**
 * Valid Product status mappings for import normalization
 */
const VALID_STATUS_MAP = {
  draft: "draft",
  pending_review: "pending_approval",
  pending_approval: "pending_approval",
  approved: "active",
  active: "active",
  rejected: "rejected",
  inactive: "inactive",
  archived: "archived",
};

/**
 * Canonical 38-Column Multi-Row & Variant CSV & XLSX Import Template Headers
 */
const TEMPLATE_HEADERS = [
  "Product Name",
  "Parent SKU",
  "Variant SKU",
  "Product Type",
  "Category",
  "Brand",
  "Price",
  "Compare At Price",
  "Cost Price",
  "Stock Quantity",
  "Warehouse Code",
  "Low Stock Threshold",
  "Color",
  "Size",
  "Material",
  "Barcode",
  "Attribute 1 Name",
  "Attribute 1 Value",
  "Attribute 2 Name",
  "Attribute 2 Value",
  "Tax Category",
  "Is Taxable",
  "Weight (kg)",
  "Dimensions (LxWxH cm)",
  "Shipping Class",
  "Short Description",
  "Description",
  "Image 1",
  "Image 2",
  "Image 3",
  "Image 4",
  "Tags",
  "SEO Title",
  "SEO Description",
  "SEO Keywords",
  "Is Virtual",
  "Is Downloadable",
  "Status",
];

const SAMPLE_ROWS = [
  // --- Example 1: Multi-Variant Apparel (T-Shirt with Size & Color Matrix) ---
  // Brand and Warehouse Code are left blank by default so the template validates out-of-the-box
  // using platform default warehouse allocation (BB-MAIN-01) and unbranded/merchant catalog status.
  [
    "Classic Combed Cotton Crewneck T-Shirt",
    "TS-CREW-100",
    "TS-BLK-S",
    "variable",
    "Fashion",
    "", // Brand: leave blank for unbranded/merchant product or replace with active platform brand
    499.0,
    799.0,
    250.0,
    25,
    "", // Warehouse Code: leave blank for default primary warehouse (e.g., BB-MAIN-01)
    5,
    "Black",
    "S",
    "100% Combed Cotton",
    "890123456001",
    "",
    "",
    "",
    "",
    "standard",
    "true",
    0.2,
    "25x20x2",
    "standard",
    "Ultra-soft combed cotton crewneck t-shirt.",
    "Ultra-soft breathable combed cotton crewneck t-shirt with reinforced stitching.",
    "https://images.unsplash.com/photo-1521572267360-ee0c2909d518",
    "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c",
    "",
    "",
    "fashion,tshirt,cotton,casual,men",
    "Classic Cotton Crewneck T-Shirt",
    "Premium combed cotton crewneck t-shirt.",
    "tshirt,cotton,crewneck",
    "false",
    "false",
    "draft",
  ],
  [
    "Classic Combed Cotton Crewneck T-Shirt",
    "TS-CREW-100",
    "TS-BLK-M",
    "variable",
    "Fashion",
    "", // Brand: blank
    499.0,
    799.0,
    250.0,
    30,
    "", // Warehouse Code: blank
    5,
    "Black",
    "M",
    "100% Combed Cotton",
    "890123456002",
    "",
    "",
    "",
    "",
    "standard",
    "true",
    0.22,
    "25x20x2",
    "standard",
    "Ultra-soft combed cotton crewneck t-shirt.",
    "Ultra-soft breathable combed cotton crewneck t-shirt with reinforced stitching.",
    "https://images.unsplash.com/photo-1521572267360-ee0c2909d518",
    "",
    "",
    "",
    "fashion,tshirt,cotton,casual,men",
    "",
    "",
    "",
    "false",
    "false",
    "draft",
  ],
  [
    "Classic Combed Cotton Crewneck T-Shirt",
    "TS-CREW-100",
    "TS-WHT-L",
    "variable",
    "Fashion",
    "", // Brand: blank
    499.0,
    799.0,
    250.0,
    15,
    "", // Warehouse Code: blank
    5,
    "White",
    "L",
    "100% Combed Cotton",
    "890123456003",
    "",
    "",
    "",
    "",
    "standard",
    "true",
    0.24,
    "25x20x2",
    "standard",
    "Ultra-soft combed cotton crewneck t-shirt.",
    "Ultra-soft breathable combed cotton crewneck t-shirt with reinforced stitching.",
    "https://images.unsplash.com/photo-1521572267360-ee0c2909d518",
    "",
    "",
    "",
    "fashion,tshirt,cotton,casual,men",
    "",
    "",
    "",
    "false",
    "false",
    "draft",
  ],

  // --- Example 2: Multi-Variant Electronics (Flagship Smartphone with Dynamic Attributes) ---
  [
    "AuraPro 5G Flagship Smartphone",
    "PHONE-AP-5G",
    "PHONE-AP-BLK-128",
    "variable",
    "Mobiles",
    "", // Brand: blank
    49999.0,
    59999.0,
    38000.0,
    50,
    "", // Warehouse Code: blank
    10,
    "Obsidian Black",
    "",
    "Corning Gorilla Glass & Titanium",
    "890123456004",
    "Storage",
    "128GB",
    "RAM",
    "8GB",
    "standard",
    "true",
    0.19,
    "16x7.5x0.8",
    "fragile",
    "Flagship 5G smartphone with 120Hz AMOLED.",
    "Flagship 5G smartphone featuring 120Hz AMOLED HDR10+ display and 108MP AI triple camera.",
    "https://images.unsplash.com/photo-1511707171634-5f897ff02560",
    "https://images.unsplash.com/photo-1580910051074-3eb694886505",
    "",
    "",
    "smartphone,5g,mobile,flagship,android",
    "AuraPro 5G Flagship Phone",
    "Buy AuraPro 5G with AMOLED display.",
    "smartphone,5g,aurapro",
    "false",
    "false",
    "draft",
  ],
  [
    "AuraPro 5G Flagship Smartphone",
    "PHONE-AP-5G",
    "PHONE-AP-BLU-256",
    "variable",
    "Mobiles",
    "", // Brand: blank
    54999.0,
    64999.0,
    42000.0,
    40,
    "", // Warehouse Code: blank
    10,
    "Pacific Blue",
    "",
    "Corning Gorilla Glass & Titanium",
    "890123456005",
    "Storage",
    "256GB",
    "RAM",
    "12GB",
    "standard",
    "true",
    0.19,
    "16x7.5x0.8",
    "fragile",
    "Flagship 5G smartphone with 120Hz AMOLED.",
    "Flagship 5G smartphone featuring 120Hz AMOLED HDR10+ display and 108MP AI triple camera.",
    "https://images.unsplash.com/photo-1511707171634-5f897ff02560",
    "",
    "",
    "",
    "smartphone,5g,mobile,flagship,android",
    "",
    "",
    "",
    "false",
    "false",
    "draft",
  ],

  // --- Example 3: Standalone Single Product (Wireless ANC Headphones) ---
  [
    "Acoustic Pro Wireless Noise-Cancelling Headphones",
    "AUDIO-ANC-700",
    "AUDIO-ANC-700-SLV",
    "simple",
    "Audio",
    "", // Brand: blank
    12999.0,
    16999.0,
    9000.0,
    80,
    "", // Warehouse Code: blank
    5,
    "Silver Matte",
    "Over-Ear",
    "Memory Foam & Aluminum",
    "890123456006",
    "",
    "",
    "",
    "",
    "standard",
    "true",
    0.25,
    "20x18x8",
    "standard",
    "Industry-leading ANC wireless headphones.",
    "Industry-leading active noise cancellation with 40-hour battery life and Hi-Res Audio certification.",
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
    "",
    "",
    "",
    "audio,headphones,bluetooth,anc,wireless",
    "Acoustic Pro ANC Wireless Headphones",
    "Wireless headphones with ANC and 40h battery.",
    "headphones,bluetooth,noise-cancelling",
    "false",
    "false",
    "draft",
  ],

  // --- Example 4: Standalone Digital / Virtual Product ---
  [
    "AuraVue 1-Year Cloud Storage License",
    "CLOUD-1YR-001",
    "CLOUD-1YR-001",
    "simple",
    "Electronics",
    "", // Brand: blank
    1999.0,
    2499.0,
    1200.0,
    1000,
    "", // Warehouse Code: blank
    0,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "standard",
    "true",
    0,
    "",
    "standard",
    "1-Year high-speed encrypted cloud storage.",
    "1-Year high-speed encrypted cloud storage with automatic backup and cross-device sync.",
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe",
    "",
    "",
    "",
    "cloud,software,subscription,digital",
    "AuraVue 1-Year Cloud License",
    "Get 1TB secure cloud storage for 1 year.",
    "cloud,storage,software",
    "true",
    "true",
    "draft",
  ],
];

/**
 * Detailed column-by-column instructions for Excel template
 */
const INSTRUCTION_HEADERS = [
  "Column Name",
  "Required?",
  "Data Type",
  "Description & Marketplace Validation Rules",
  "Accepted Values / Example",
];

const INSTRUCTION_ROWS = [
  [
    "Product Name",
    "REQUIRED",
    "Text (String)",
    "Name of the product. Max 200 characters. For products with multiple variants, repeat the exact same Product Name across variant rows.",
    "Classic Combed Cotton Crewneck T-Shirt",
  ],
  [
    "Parent SKU",
    "OPTIONAL (Recommended for Variants)",
    "Text (Alphanumeric)",
    "Identifier that groups multiple variant rows into a single parent product. If omitted, matching Product Name groups variants.",
    "TS-CREW-100",
  ],
  [
    "Variant SKU",
    "REQUIRED",
    "Text (Alphanumeric)",
    "Unique merchant stock keeping unit for this specific variant. Must be unique across all your products. Cannot collide with other vendors.",
    "TS-BLK-S",
  ],
  [
    "Product Type",
    "OPTIONAL (Default 'simple' for single row, 'variable' for multiple rows)",
    "Text (Enum)",
    "Specifies whether the product is standalone ('simple') or has options/variations ('variable').",
    "simple, variable",
  ],
  [
    "Category",
    "REQUIRED",
    "Text (Platform Taxonomy)",
    "Name or URL slug of an approved, active platform category. Categories are platform-managed; vendors cannot create new categories. Must match an existing category in the catalog (e.g., 'Fashion', 'Mobiles', 'Audio', 'Electronics').",
    "Fashion, Mobiles, Audio, Electronics",
  ],
  [
    "Brand",
    "OPTIONAL",
    "Text (Platform Brand)",
    "Name or URL slug of an active platform brand. Must match an existing brand in the catalog (e.g., 'Sony', 'Samsung', 'Buybox'). Sample rows leave Brand blank for unbranded items to avoid reference collision. If you specify a brand, it must match an active platform brand from the Reference_Guide sheet or the import will report a row-level error.",
    "Sony, Samsung, Buybox, or leave blank",
  ],
  [
    "Price",
    "REQUIRED",
    "Number (Decimal > 0)",
    "Customer selling price. Must be a positive numerical value greater than 0.",
    "499.00",
  ],
  [
    "Compare At Price",
    "OPTIONAL",
    "Number (Decimal >= Price)",
    "Original MSRP or strikethrough price for discount display. Must be greater than or equal to Price.",
    "799.00",
  ],
  [
    "Cost Price",
    "OPTIONAL",
    "Number (Decimal >= 0)",
    "Merchant wholesale or cost of goods. Used for internal profit margin reporting.",
    "250.00",
  ],
  [
    "Stock Quantity",
    "OPTIONAL (Default 0)",
    "Whole Integer (>= 0)",
    "Initial available inventory quantity. Allocated to the specified warehouse or primary active warehouse.",
    "25",
  ],
  [
    "Warehouse Code",
    "OPTIONAL (Default primary warehouse)",
    "Text (Warehouse Code)",
    "Warehouse identifier code where this inventory is stocked. Must match an active warehouse code (e.g., 'BB-MAIN-01'). Sample rows leave Warehouse Code blank to automatically allocate to the primary active warehouse. If specified, it must match an active warehouse code from the Reference_Guide sheet or the import will report a row-level error.",
    "BB-MAIN-01 or leave blank for primary warehouse",
  ],
  [
    "Low Stock Threshold",
    "OPTIONAL (Default 5)",
    "Whole Integer (>= 0)",
    "Alert threshold level below which this item is flagged as low inventory.",
    "5",
  ],
  [
    "Color",
    "OPTIONAL",
    "Text",
    "Variant color descriptor. Used for storefront color swatches.",
    "Black, Obsidian Black, White",
  ],
  [
    "Size",
    "OPTIONAL",
    "Text",
    "Variant size or configuration descriptor.",
    "S, M, L, XL, 8GB + 128GB",
  ],
  [
    "Material",
    "OPTIONAL",
    "Text",
    "Primary construction material or fabric.",
    "100% Combed Cotton, Titanium",
  ],
  [
    "Barcode",
    "OPTIONAL",
    "Text (UPC / EAN / GTIN)",
    "Standardized 12 or 13-digit product barcode. Must be unique if provided.",
    "890123456001",
  ],
  [
    "Attribute 1 Name",
    "OPTIONAL",
    "Text",
    "Custom variant attribute key (e.g., Storage, RAM, Style, Flavor).",
    "Storage",
  ],
  [
    "Attribute 1 Value",
    "OPTIONAL",
    "Text",
    "Value for Custom Attribute 1.",
    "128GB",
  ],
  [
    "Attribute 2 Name",
    "OPTIONAL",
    "Text",
    "Second custom variant attribute key.",
    "RAM",
  ],
  [
    "Attribute 2 Value",
    "OPTIONAL",
    "Text",
    "Value for Custom Attribute 2.",
    "8GB",
  ],
  [
    "Tax Category",
    "OPTIONAL (Default 'standard')",
    "Text (Enum)",
    "Tax rate classification code.",
    "standard (18%), reduced (5%), zero (0%), exempt",
  ],
  [
    "Is Taxable",
    "OPTIONAL (Default 'true')",
    "Boolean",
    "Indicates if product is subject to applicable sales tax / GST.",
    "true, false",
  ],
  [
    "Weight (kg)",
    "OPTIONAL",
    "Number (Decimal >= 0)",
    "Product or package weight in kilograms. Used for courier shipping rate calculations.",
    "0.25",
  ],
  [
    "Dimensions (LxWxH cm)",
    "OPTIONAL",
    "Text",
    "Package physical dimensions in length x width x height (centimeters).",
    "25x20x2 or 25, 20, 2",
  ],
  [
    "Shipping Class",
    "OPTIONAL (Default 'standard')",
    "Text (Enum)",
    "Shipping handling classification.",
    "standard, fragile, heavy, perishable",
  ],
  [
    "Short Description",
    "OPTIONAL",
    "Text (Max 500 chars)",
    "Brief synopsis for product cards and search results.",
    "Ultra-soft combed cotton crewneck t-shirt.",
  ],
  [
    "Description",
    "OPTIONAL",
    "Text (HTML or Plaintext)",
    "Rich product description and bullet points explaining key features and specifications.",
    "Ultra-soft breathable combed cotton crewneck t-shirt.",
  ],
  [
    "Image 1",
    "OPTIONAL",
    "URL (HTTPS)",
    "Direct HTTPS link to the primary high-resolution product image.",
    "https://images.unsplash.com/photo-1521572267360-ee0c2909d518",
  ],
  [
    "Image 2",
    "OPTIONAL",
    "URL (HTTPS)",
    "Secondary gallery product image link.",
    "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c",
  ],
  [
    "Image 3",
    "OPTIONAL",
    "URL (HTTPS)",
    "Third gallery product image link.",
    "",
  ],
  [
    "Image 4",
    "OPTIONAL",
    "URL (HTTPS)",
    "Fourth gallery product image link.",
    "",
  ],
  [
    "Tags",
    "OPTIONAL",
    "Text (Comma-separated)",
    "Search keywords and categorization tags separated by commas.",
    "fashion,tshirt,cotton,casual",
  ],
  [
    "SEO Title",
    "OPTIONAL",
    "Text",
    "Page title for search engines. Defaults to product name if empty.",
    "Classic Cotton Crewneck T-Shirt",
  ],
  [
    "SEO Description",
    "OPTIONAL",
    "Text",
    "Meta description for search engine snippets.",
    "Premium combed cotton crewneck t-shirt.",
  ],
  [
    "SEO Keywords",
    "OPTIONAL",
    "Text (Comma-separated)",
    "Meta search keywords.",
    "tshirt,cotton,crewneck",
  ],
  [
    "Is Virtual",
    "OPTIONAL (Default 'false')",
    "Boolean",
    "True if product does not require physical shipping (services, licenses).",
    "true, false",
  ],
  [
    "Is Downloadable",
    "OPTIONAL (Default 'false')",
    "Boolean",
    "True if product provides downloadable digital files.",
    "true, false",
  ],
  [
    "Status",
    "OPTIONAL (Default 'draft')",
    "Text (Enum)",
    "Initial catalog submission status.",
    "draft, pending_review, approved",
  ],
];

/**
 * Reference taxonomy worksheet for Excel template
 */
const REFERENCE_HEADERS = [
  "Taxonomy Type",
  "Value / Code",
  "Display Name",
  "Notes & Usage",
];

const REFERENCE_ROWS = [
  ["Category", "Fashion", "Fashion & Apparel", "Platform category for clothing, footwear, and accessories"],
  ["Category", "Mobiles", "Mobiles & Tablets", "Platform category for smartphones, tablets, and mobile gadgets"],
  ["Category", "Laptops", "Laptops & Computers", "Platform category for notebooks, ultrabooks, and workstations"],
  ["Category", "Audio", "Audio & Headphones", "Platform category for earbuds, speakers, and sound systems"],
  ["Category", "Electronics", "Consumer Electronics", "Platform category for general electronics, smart devices, and digital licenses"],
  ["Warehouse", "BB-MAIN-01", "Buybox Main Warehouse", "Authoritative primary platform fulfillment center. Leaving Warehouse Code blank in import defaults to this warehouse."],
  ["Warehouse", "SAMPLE_WH_NOTE", "Warehouse Code Guidance", "Sample rows leave Warehouse Code blank to automatically allocate to the primary warehouse (e.g., BB-MAIN-01). If specified, code must match an active warehouse."],
  ["Brand", "Buybox", "Buybox", "Official Buybox platform brand"],
  ["Brand", "Sony", "Sony", "Official consumer electronics and audio brand"],
  ["Brand", "Apple", "Apple", "Official brand"],
  ["Brand", "Samsung", "Samsung", "Official brand"],
  ["Brand", "Unbranded / Blank", "Unbranded (Leave blank)", "Leave the Brand column blank for generic, white-label, or unbranded products. Default behavior in template sample rows."],
  ["Template Guidance", "SAMPLE_ROWS_GUIDE", "Sample Rows Guidance", "The 7 sample rows in the Products sheet illustrate simple, variable, and digital products. Brand and Warehouse Code are left blank by default so the template passes validation out of the box. You may replace them with active catalog entities."],
  ["Tax Category", "standard", "Standard GST (18%)", "Standard rate for electronics, apparel, and general goods"],
  ["Tax Category", "reduced", "Reduced GST (5% - 12%)", "Essential goods, select apparel, and packaged items"],
  ["Tax Category", "zero", "Zero Rated (0%)", "Zero-rated agricultural and educational supplies"],
  ["Tax Category", "exempt", "Tax Exempt", "Exempt items not subject to sales tax"],
  ["Product Type", "simple", "Simple Product", "Single standalone product with canonical default variant"],
  ["Product Type", "variable", "Variable Product", "Product with multiple variants (color, size, storage)"],
  ["Shipping Class", "standard", "Standard Shipping", "Regular domestic parcel handling"],
  ["Shipping Class", "fragile", "Fragile Goods", "Requires delicate handling and bubble-wrap packaging"],
  ["Shipping Class", "heavy", "Heavy Freight", "Requires freight handling and pallet delivery"],
  ["Shipping Class", "perishable", "Perishable / Cold Chain", "Temperature sensitive rapid fulfillment"],
  ["Status", "draft", "Draft", "Default safe status; editable by merchant before submitting for review"],
  ["Status", "pending_review", "Pending Review", "Submitted for marketplace catalog moderation"],
  ["Status", "approved", "Approved", "Active in merchant catalog ready for publishing"],
  ["Boolean Values", "true / false", "True or False", "Accepts: true, false, 1, 0, yes, no"],
  ["Import Mode", "CREATE_AND_UPDATE", "Create & Update", "Default mode: inserts new products and updates existing matching SKUs"],
  ["Import Mode", "CREATE_ONLY", "Create Only", "Strict mode: skips or errors on already existing SKUs"],
  ["Import Mode", "UPDATE_ONLY", "Update Only", "Update mode: only modifies existing SKUs owned by the merchant"],
];

/**
 * 1. Generate Downloadable Import Template in CSV or XLSX
 */
const generateImportTemplate = (format = "csv") => {
  const isXlsx = ["xlsx", "excel"].includes(String(format || "").toLowerCase().trim());
  const wsData = [TEMPLATE_HEADERS, ...SAMPLE_ROWS];
  const ws = xlsx.utils.aoa_to_sheet(wsData);

  ws["!cols"] = [
    { wch: 38 }, // Product Name
    { wch: 18 }, // Parent SKU
    { wch: 22 }, // Variant SKU
    { wch: 16 }, // Product Type
    { wch: 18 }, // Category
    { wch: 16 }, // Brand
    { wch: 12 }, // Price
    { wch: 18 }, // Compare At Price
    { wch: 14 }, // Cost Price
    { wch: 16 }, // Stock Quantity
    { wch: 18 }, // Warehouse Code
    { wch: 18 }, // Low Stock Threshold
    { wch: 16 }, // Color
    { wch: 16 }, // Size
    { wch: 24 }, // Material
    { wch: 18 }, // Barcode
    { wch: 18 }, // Attribute 1 Name
    { wch: 18 }, // Attribute 1 Value
    { wch: 18 }, // Attribute 2 Name
    { wch: 18 }, // Attribute 2 Value
    { wch: 14 }, // Tax Category
    { wch: 12 }, // Is Taxable
    { wch: 14 }, // Weight (kg)
    { wch: 22 }, // Dimensions (LxWxH cm)
    { wch: 16 }, // Shipping Class
    { wch: 35 }, // Short Description
    { wch: 60 }, // Description
    { wch: 45 }, // Image 1
    { wch: 45 }, // Image 2
    { wch: 45 }, // Image 3
    { wch: 45 }, // Image 4
    { wch: 30 }, // Tags
    { wch: 25 }, // SEO Title
    { wch: 35 }, // SEO Description
    { wch: 25 }, // SEO Keywords
    { wch: 12 }, // Is Virtual
    { wch: 16 }, // Is Downloadable
    { wch: 14 }, // Status
  ];

  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "Products");

  if (isXlsx) {
    // Worksheet 2: Instructions & Guidelines
    const wsInstructions = xlsx.utils.aoa_to_sheet([
      INSTRUCTION_HEADERS,
      ...INSTRUCTION_ROWS,
    ]);
    wsInstructions["!cols"] = [
      { wch: 24 }, // Column Name
      { wch: 32 }, // Required?
      { wch: 24 }, // Data Type
      { wch: 70 }, // Description & Rules
      { wch: 45 }, // Example
    ];
    xlsx.utils.book_append_sheet(wb, wsInstructions, "Column_Instructions");

    // Worksheet 3: Reference Taxonomy
    const wsRef = xlsx.utils.aoa_to_sheet([
      REFERENCE_HEADERS,
      ...REFERENCE_ROWS,
    ]);
    wsRef["!cols"] = [
      { wch: 18 }, // Taxonomy Type
      { wch: 24 }, // Value / Code
      { wch: 28 }, // Display Name
      { wch: 65 }, // Notes & Usage
    ];
    xlsx.utils.book_append_sheet(wb, wsRef, "Reference_Guide");

    const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
    return {
      buffer,
      filename: "buybox_product_import_template.xlsx",
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  const buffer = xlsx.write(wb, { type: "buffer", bookType: "csv" });
  return {
    buffer,
    filename: "buybox_product_import_template.csv",
    contentType: "text/csv; charset=utf-8",
  };
};

/**
 * 2. Validate Bulk Product Import File (Preview Mode)
 *
 * Supports Multi-Row Variant imports, mode constraints (CREATE_ONLY, UPDATE_ONLY, CREATE_AND_UPDATE),
 * vendor isolation verification, and returns detailed error reports.
 */
const validateBulkImport = async ({
  buffer,
  filename,
  vendorId = null,
  actor = null,
  imagesZipBuffer = null,
  imagesZipFilename = null,
  mode = "CREATE_AND_UPDATE",
}) => {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new AppError("No file buffer provided", 400, "MISSING_FILE");
  }

  let zipArchiveContext = null;
  let archiveSummary = null;

  if (imagesZipBuffer) {
    zipArchiveContext = processZipArchive(imagesZipBuffer, {
      vendorId,
      actorId: actor?.id || actor?._id,
    });
    archiveSummary = {
      stagingId: zipArchiveContext.stagingId,
      totalFiles: zipArchiveContext.totalFiles,
      stagedFiles: zipArchiveContext.manifest.validFiles.map((f) => ({
        originalName: f.originalName,
        normalizedPath: f.normalizedPath,
        size: f.size,
      })),
    };
  }

  let wb;
  try {
    wb = xlsx.read(buffer, { type: "buffer", raw: false });
  } catch {
    throw new AppError(
      "Unable to parse spreadsheet. Please upload a valid CSV or XLSX file.",
      400,
      "INVALID_FILE_FORMAT"
    );
  }

  const targetSheetName =
    (wb.Sheets["Products"] && "Products") ||
    (wb.Sheets["Product_Template"] && "Product_Template") ||
    wb.SheetNames[0];
  if (!targetSheetName) {
    throw new AppError("Spreadsheet contains no worksheets", 400, "EMPTY_FILE");
  }

  const ws = wb.Sheets[targetSheetName];
  const rawRows = xlsx.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  if (rawRows.length < 2) {
    throw new AppError(
      "The uploaded file is empty or missing data rows. Must include header and at least 1 product row.",
      400,
      "EMPTY_IMPORT_DATA"
    );
  }

  if (rawRows.length > 5001) {
    throw new AppError(
      "Upload exceeds maximum allowable batch size of 5,000 rows.",
      400,
      "IMPORT_BATCH_SIZE_EXCEEDED"
    );
  }

  // Normalize header mapping
  const headers = rawRows[0].map((h) => String(h || "").trim().toLowerCase());
  const findHeaderIndex = (aliases) => {
    const exact = headers.findIndex((h) => aliases.some((a) => h === a));
    if (exact !== -1) return exact;
    return headers.findIndex((h) => aliases.some((a) => h.includes(a)));
  };

  const idxName = findHeaderIndex(["product name", "name", "title"]);
  const idxParentSku = findHeaderIndex(["parent sku", "parent_sku"]);
  const idxSku = findHeaderIndex(["variant sku", "variant_sku", "sku"]);
  const idxProductType = findHeaderIndex(["product type", "product_type", "type"]);
  const idxCat = findHeaderIndex(["category"]);
  const idxBrand = findHeaderIndex(["brand"]);
  const idxPrice = findHeaderIndex(["price", "unit price"]);
  const idxComparePrice = findHeaderIndex(["compare at price", "compare price", "mrp"]);
  const idxCostPrice = findHeaderIndex(["cost price", "cost_price"]);
  const idxStock = findHeaderIndex(["stock quantity", "stock", "quantity", "qty"]);
  const idxWarehouse = findHeaderIndex(["warehouse code", "warehouse", "warehouse_code"]);
  const idxLowStock = findHeaderIndex(["low stock threshold", "low stock", "threshold"]);
  const idxColor = findHeaderIndex(["color"]);
  const idxSize = findHeaderIndex(["size"]);
  const idxMaterial = findHeaderIndex(["material"]);
  const idxBarcode = findHeaderIndex(["barcode", "ean", "upc"]);
  const idxAttr1Name = findHeaderIndex(["attribute 1 name", "attr 1 name", "attr1 name", "attr1_name"]);
  const idxAttr1Val = findHeaderIndex(["attribute 1 value", "attr 1 value", "attr1 value", "attr1_value"]);
  const idxAttr2Name = findHeaderIndex(["attribute 2 name", "attr 2 name", "attr2 name", "attr2_name"]);
  const idxAttr2Val = findHeaderIndex(["attribute 2 value", "attr 2 value", "attr2 value", "attr2_value"]);
  const idxTaxCat = findHeaderIndex(["tax category", "tax"]);
  const idxIsTaxable = findHeaderIndex(["is taxable", "taxable"]);
  const idxWeight = findHeaderIndex(["weight", "weight (kg)", "weight_kg"]);
  const idxDimensions = findHeaderIndex(["dimensions (lxwxh cm)", "dimensions", "dimension"]);
  const idxShippingClass = findHeaderIndex(["shipping class", "shipping_class", "shipping"]);
  const idxShortDesc = findHeaderIndex(["short description", "short_description", "summary"]);
  const idxDesc = findHeaderIndex(["description", "desc"]);
  const idxImage1 = findHeaderIndex(["image 1", "image_1", "image", "media"]);
  const idxImage2 = findHeaderIndex(["image 2", "image_2"]);
  const idxImage3 = findHeaderIndex(["image 3", "image_3"]);
  const idxImage4 = findHeaderIndex(["image 4", "image_4"]);
  const idxTags = findHeaderIndex(["tags", "tag"]);
  const idxSeoTitle = findHeaderIndex(["seo title", "meta title"]);
  const idxSeoDesc = findHeaderIndex(["seo description", "meta description"]);
  const idxSeoKeywords = findHeaderIndex(["seo keywords", "meta keywords"]);
  const idxIsVirtual = findHeaderIndex(["is virtual", "virtual"]);
  const idxIsDownloadable = findHeaderIndex(["is downloadable", "downloadable"]);
  const idxStatus = findHeaderIndex(["status", "catalog status", "publication status"]);

  const hasImageColumns =
    idxImage1 !== -1 || idxImage2 !== -1 || idxImage3 !== -1 || idxImage4 !== -1;

  // Detect dynamic attribute headers like attr:Storage or attribute:RAM
  const dynamicAttrColIndices = [];
  headers.forEach((h, colIdx) => {
    const match = h.match(/^(?:attr|attribute)[:_-](.+)$/i);
    if (match) {
      dynamicAttrColIndices.push({ colIdx, attrName: match[1].trim() });
    }
  });

  if (idxName === -1 || idxSku === -1 || idxPrice === -1 || idxCat === -1) {
    throw new AppError(
      "Missing required column headers. Required columns: 'Product Name', 'Variant SKU', 'Price', and 'Category'.",
      400,
      "MISSING_REQUIRED_COLUMNS"
    );
  }

  // Pre-load reference collections
  const [categories, brands, warehouses, vendors] = await Promise.all([
    Category.find({ isActive: true, deletedAt: null }).lean(),
    Brand.find({ isActive: true, deletedAt: null }).lean(),
    Warehouse.find({ isActive: true, deletedAt: null }).lean(),
    Vendor.find({ isActive: true, deletedAt: null }).lean(),
  ]);

  const categoryMap = new Map();
  for (const cat of categories) {
    categoryMap.set(cat.name.toLowerCase().trim(), cat);
    if (cat.slug) categoryMap.set(cat.slug.toLowerCase().trim(), cat);
  }

  const brandMap = new Map();
  for (const b of brands) {
    brandMap.set(b.name.toLowerCase().trim(), b);
    if (b.slug) brandMap.set(b.slug.toLowerCase().trim(), b);
  }

  const warehouseMap = new Map();
  for (const wh of warehouses) {
    if (wh.code) warehouseMap.set(wh.code.toLowerCase().trim(), wh);
    if (wh.name) warehouseMap.set(wh.name.toLowerCase().trim(), wh);
    warehouseMap.set(wh._id.toString(), wh);
  }

  const vendorMap = new Map();
  for (const v of vendors) {
    vendorMap.set(v._id.toString(), v);
    if (v.businessSlug) vendorMap.set(v.businessSlug.toLowerCase().trim(), v);
    if (v.businessName) vendorMap.set(v.businessName.toLowerCase().trim(), v);
  }

  // Pre-load existing SKUs to detect conflict vs self-update across Product, ProductVariant, and SkuRegistry
  const rawSkus = rawRows
    .slice(1)
    .map((r) => String(r[idxSku] || "").trim().toUpperCase())
    .filter(Boolean);

  const rawParentSkus = idxParentSku !== -1
    ? rawRows.slice(1).map((r) => String(r[idxParentSku] || "").trim().toUpperCase()).filter(Boolean)
    : [];

  const allQuerySkus = Array.from(new Set([...rawSkus, ...rawParentSkus]));

  const [existingProducts, existingVariants, existingRegistries] = await Promise.all([
    Product.find({ sku: { $in: allQuerySkus }, deletedAt: null })
      .select("_id sku name vendorId status price")
      .lean(),
    ProductVariant.find({ sku: { $in: allQuerySkus }, deletedAt: null })
      .populate("productId", "_id sku name vendorId status price")
      .lean(),
    SkuRegistry.find({ sku: { $in: allQuerySkus }, deletedAt: null })
      .populate("productId", "_id sku name vendorId status price")
      .populate("variantId", "_id sku name")
      .lean(),
  ]);

  const existingProductMap = new Map();
  for (const p of existingProducts) {
    if (p.sku) existingProductMap.set(p.sku.toUpperCase(), p);
  }
  for (const v of existingVariants) {
    if (v.sku && v.productId) {
      existingProductMap.set(v.sku.toUpperCase(), {
        _id: v.productId._id,
        sku: v.sku,
        name: v.productId.name,
        vendorId: v.productId.vendorId,
        status: v.productId.status,
        variantId: v._id,
      });
    }
  }
  for (const reg of existingRegistries) {
    if (reg.sku && !existingProductMap.has(reg.sku.toUpperCase())) {
      existingProductMap.set(reg.sku.toUpperCase(), {
        _id: reg.productId?._id,
        sku: reg.sku,
        name: reg.productId?.name,
        vendorId: reg.productId?.vendorId,
        status: reg.productId?.status,
        variantId: reg.variantId?._id || reg.variantId,
      });
    }
  }

  const seenSkusInFile = new Set();
  const parentVariantAttributeMap = new Map();
  const parsedRows = [];
  const errorDetails = [];
  let validRowsCount = 0;
  let errorRowsCount = 0;
  let newProductsCount = 0;
  let newVariantsCount = 0;
  let updateCount = 0;

  const parentProductTracker = new Map();
  const seenParentKeys = new Set();

  for (let i = 1; i < rawRows.length; i++) {
    const r = rawRows[i];
    const rowNum = i + 1; // 1-indexed spreadsheet row

    const name = stripLeadingQuote(String(r[idxName] || "").trim());
    const parentSku = stripLeadingQuote(idxParentSku !== -1 ? String(r[idxParentSku] || "").trim().toUpperCase() : "");
    const sku = stripLeadingQuote(String(r[idxSku] || "").trim().toUpperCase());
    const productType = idxProductType !== -1 ? stripLeadingQuote(String(r[idxProductType] || "").trim().toLowerCase()) : "";
    const shortDesc = stripLeadingQuote(idxShortDesc !== -1 ? String(r[idxShortDesc] || "").trim() : "");
    const desc = stripLeadingQuote(idxDesc !== -1 ? String(r[idxDesc] || "").trim() : "");
    const catInput = stripLeadingQuote(String(r[idxCat] || "").trim());
    const brandInput = stripLeadingQuote(idxBrand !== -1 ? String(r[idxBrand] || "").trim() : "");
    const priceStr = String(r[idxPrice] || "").trim().replace(/[$,₹]/g, "");
    const comparePriceStr = idxComparePrice !== -1 ? String(r[idxComparePrice] || "").trim().replace(/[$,₹]/g, "") : "";
    const costPriceStr = idxCostPrice !== -1 ? String(r[idxCostPrice] || "").trim().replace(/[$,₹]/g, "") : "";
    const stockStr = idxStock !== -1 ? String(r[idxStock] || "0").trim() : "0";
    const warehouseCode = idxWarehouse !== -1 ? stripLeadingQuote(String(r[idxWarehouse] || "").trim().toUpperCase()) : "";
    const lowStockStr = idxLowStock !== -1 ? String(r[idxLowStock] || "").trim() : "";
    const color = idxColor !== -1 ? stripLeadingQuote(String(r[idxColor] || "").trim()) : "";
    const size = idxSize !== -1 ? stripLeadingQuote(String(r[idxSize] || "").trim()) : "";
    const material = idxMaterial !== -1 ? stripLeadingQuote(String(r[idxMaterial] || "").trim()) : "";
    const barcode = idxBarcode !== -1 ? stripLeadingQuote(String(r[idxBarcode] || "").trim()) : "";
    const attr1Name = idxAttr1Name !== -1 ? stripLeadingQuote(String(r[idxAttr1Name] || "").trim()) : "";
    const attr1Val = idxAttr1Val !== -1 ? stripLeadingQuote(String(r[idxAttr1Val] || "").trim()) : "";
    const attr2Name = idxAttr2Name !== -1 ? stripLeadingQuote(String(r[idxAttr2Name] || "").trim()) : "";
    const attr2Val = idxAttr2Val !== -1 ? stripLeadingQuote(String(r[idxAttr2Val] || "").trim()) : "";
    const taxCat = idxTaxCat !== -1 ? String(r[idxTaxCat] || "standard").trim().toLowerCase() : "standard";
    const isTaxableStr = idxIsTaxable !== -1 ? String(r[idxIsTaxable] || "").trim() : "";
    const isTaxable = idxIsTaxable !== -1 ? parseBoolean(isTaxableStr, true) : true;
    const weightStr = idxWeight !== -1 ? String(r[idxWeight] || "0").trim() : "0";
    const dimensions = idxDimensions !== -1 ? String(r[idxDimensions] || "").trim() : "";
    const shippingClass = idxShippingClass !== -1 ? stripLeadingQuote(String(r[idxShippingClass] || "").trim().toLowerCase()) : "";
    const image1 = idxImage1 !== -1 ? stripLeadingQuote(String(r[idxImage1] || "").trim()) : "";
    const image2 = idxImage2 !== -1 ? stripLeadingQuote(String(r[idxImage2] || "").trim()) : "";
    const image3 = idxImage3 !== -1 ? stripLeadingQuote(String(r[idxImage3] || "").trim()) : "";
    const image4 = idxImage4 !== -1 ? stripLeadingQuote(String(r[idxImage4] || "").trim()) : "";
    const tagsStr = idxTags !== -1 ? stripLeadingQuote(String(r[idxTags] || "").trim()) : "";
    const seoTitle = idxSeoTitle !== -1 ? stripLeadingQuote(String(r[idxSeoTitle] || "").trim()) : "";
    const seoDesc = idxSeoDesc !== -1 ? stripLeadingQuote(String(r[idxSeoDesc] || "").trim()) : "";
    const seoKeywordsStr = idxSeoKeywords !== -1 ? stripLeadingQuote(String(r[idxSeoKeywords] || "").trim()) : "";
    const isVirtualStr = idxIsVirtual !== -1 ? String(r[idxIsVirtual] || "").trim() : "";
    const isVirtual = parseBoolean(isVirtualStr, false);
    const isDownloadableStr = idxIsDownloadable !== -1 ? String(r[idxIsDownloadable] || "").trim() : "";
    const isDownloadable = parseBoolean(isDownloadableStr, false);
    const statusInput = idxStatus !== -1 ? stripLeadingQuote(String(r[idxStatus] || "").trim().toLowerCase()) : "";

    const errors = [];

    // 1. Name validation
    if (!name) {
      errors.push("Product Name is required.");
      errorDetails.push({
        rowNumber: rowNum,
        sku,
        product: name,
        field: "Product Name",
        error: "Product Name is required",
        suggestedAction: "Enter a descriptive product name",
      });
    } else if (name.length > 200) {
      errors.push("Product Name must be under 200 characters.");
      errorDetails.push({
        rowNumber: rowNum,
        sku,
        product: name,
        field: "Product Name",
        error: "Product Name exceeds 200 characters",
        suggestedAction: "Shorten product name to under 200 characters",
      });
    }

    // 2. Short description validation (max 500 chars)
    if (shortDesc && shortDesc.length > 500) {
      errors.push("Short Description must be 500 characters or fewer.");
      errorDetails.push({
        rowNumber: rowNum,
        sku,
        product: name,
        field: "Short Description",
        error: "Short Description exceeds 500 characters",
        suggestedAction: "Shorten short description to 500 characters or fewer",
      });
    }

    // 3. SKU validation
    if (!sku) {
      errors.push("SKU is required.");
      errorDetails.push({
        rowNumber: rowNum,
        sku,
        product: name,
        field: "SKU",
        error: "Variant SKU is required",
        suggestedAction: "Provide a unique SKU code",
      });
    } else if (seenSkusInFile.has(sku)) {
      errors.push(`Duplicate SKU '${sku}' found in the same file.`);
      errorDetails.push({
        rowNumber: rowNum,
        sku,
        product: name,
        field: "SKU",
        error: `Duplicate SKU '${sku}' in upload`,
        suggestedAction: "Ensure each row has a unique variant SKU",
      });
    } else {
      seenSkusInFile.add(sku);

      // Check cross-vendor isolation for variant SKU
      if (existingProductMap.has(sku)) {
        const existing = existingProductMap.get(sku);
        if (
          vendorId &&
          existing.vendorId &&
          existing.vendorId.toString() !== vendorId.toString()
        ) {
          errors.push(
            `SKU '${sku}' is already registered by another merchant on the marketplace.`
          );
          errorDetails.push({
            rowNumber: rowNum,
            sku,
            product: name,
            field: "SKU",
            error: "Cross-vendor SKU collision",
            suggestedAction: "Use a unique vendor prefix for your SKUs",
          });
        }
      }

      // Check cross-vendor isolation for parent SKU if provided
      if (parentSku && existingProductMap.has(parentSku)) {
        const existingParent = existingProductMap.get(parentSku);
        if (
          vendorId &&
          existingParent.vendorId &&
          existingParent.vendorId.toString() !== vendorId.toString()
        ) {
          errors.push(
            `Parent SKU '${parentSku}' is already registered by another merchant on the marketplace.`
          );
          errorDetails.push({
            rowNumber: rowNum,
            sku,
            product: name,
            field: "Parent SKU",
            error: "Cross-vendor parent SKU collision",
            suggestedAction: "Use a unique vendor prefix for your Parent SKU",
          });
        }
      }
    }

    // Assemble dynamic attributes and check duplicate combinations
    const attributes = {};
    if (color) attributes.color = color;
    if (size) attributes.size = size;
    if (material) attributes.material = material;
    if (attr1Name && attr1Val) attributes[attr1Name.toLowerCase()] = attr1Val;
    if (attr2Name && attr2Val) attributes[attr2Name.toLowerCase()] = attr2Val;
    for (const dCol of dynamicAttrColIndices) {
      const val = stripLeadingQuote(String(r[dCol.colIdx] || "").trim());
      if (val) attributes[dCol.attrName.toLowerCase()] = val;
    }

    const parentKey = parentSku || name.toLowerCase().trim();
    const isSubsequentVariantRow = seenParentKeys.has(parentKey);
    seenParentKeys.add(parentKey);

    const attrCombo = serializeAttributeCombination(attributes);
    if (attrCombo) {
      const existingCombos = parentVariantAttributeMap.get(parentKey) || new Set();
      if (existingCombos.has(attrCombo)) {
        errors.push(`Duplicate variant attribute combination '${attrCombo}' found for parent product.`);
        errorDetails.push({
          rowNumber: rowNum,
          sku,
          product: name,
          field: "Attributes",
          error: `Duplicate variant attribute combination '${attrCombo}'`,
          suggestedAction: "Each variant of a product must have a unique combination of attributes",
        });
      } else {
        existingCombos.add(attrCombo);
        parentVariantAttributeMap.set(parentKey, existingCombos);
      }
    }

    // 4. Price validation
    const price = Number(priceStr);
    if (isNaN(price) || priceStr === "" || price <= 0) {
      errors.push("Price must be a positive number greater than 0.");
      errorDetails.push({
        rowNumber: rowNum,
        sku,
        product: name,
        field: "Price",
        error: "Invalid price value",
        suggestedAction: "Enter a positive numerical price",
      });
    }

    let compareAtPrice = null;
    if (comparePriceStr) {
      const cmp = Number(comparePriceStr);
      if (isNaN(cmp) || cmp < 0) {
        errors.push("Compare At Price must be a valid non-negative number.");
        errorDetails.push({
          rowNumber: rowNum,
          sku,
          product: name,
          field: "Compare At Price",
          error: "Invalid compare at price",
          suggestedAction: "Enter a valid decimal number >= 0",
        });
      } else if (!isNaN(price) && cmp < price) {
        errors.push(`Compare At Price (${cmp}) must be greater than or equal to Price (${price}).`);
        errorDetails.push({
          rowNumber: rowNum,
          sku,
          product: name,
          field: "Compare At Price",
          error: `Compare At Price (${cmp}) is less than selling Price (${price})`,
          suggestedAction: "Set Compare At Price greater than or equal to Price, or leave blank",
        });
      } else {
        compareAtPrice = cmp;
      }
    }

    let costPrice = null;
    if (costPriceStr) {
      const cp = Number(costPriceStr);
      if (!isNaN(cp) && cp >= 0) {
        costPrice = cp;
      }
    }

    // 5. Stock & Warehouse validation
    const stockQuantity = Math.floor(Number(stockStr));
    if (isNaN(stockQuantity) || stockQuantity < 0) {
      errors.push("Stock quantity must be a non-negative whole integer.");
      errorDetails.push({
        rowNumber: rowNum,
        sku,
        product: name,
        field: "Stock",
        error: "Invalid stock quantity",
        suggestedAction: "Enter an integer >= 0",
      });
    }

    let resolvedWarehouse = null;
    if (warehouseCode) {
      resolvedWarehouse = warehouseMap.get(warehouseCode.toLowerCase());
      if (!resolvedWarehouse) {
        errors.push(`Warehouse '${warehouseCode}' not found or is currently inactive.`);
        errorDetails.push({
          rowNumber: rowNum,
          sku,
          product: name,
          field: "Warehouse Code",
          error: `Warehouse '${warehouseCode}' does not exist or is inactive`,
          suggestedAction: "Verify warehouse code against active warehouses or leave blank",
        });
      }
    }

    let lowStockThreshold = 5;
    if (lowStockStr !== "") {
      const lst = Math.floor(Number(lowStockStr));
      if (isNaN(lst) || lst < 0) {
        errors.push("Low Stock Threshold must be a non-negative whole integer.");
        errorDetails.push({
          rowNumber: rowNum,
          sku,
          product: name,
          field: "Low Stock Threshold",
          error: "Invalid low stock threshold",
          suggestedAction: "Enter an integer >= 0",
        });
      } else {
        lowStockThreshold = lst;
      }
    }

    // 6. Category resolution (Platform-owned taxonomy)
    let resolvedCategory = null;
    if (!catInput) {
      errors.push("Category is required.");
      errorDetails.push({
        rowNumber: rowNum,
        sku,
        product: name,
        field: "Category",
        error: "Missing category",
        suggestedAction: "Select an existing marketplace category",
      });
    } else {
      resolvedCategory = categoryMap.get(catInput.toLowerCase());
      if (!resolvedCategory) {
        errors.push(`Category '${catInput}' not found or is currently inactive.`);
        errorDetails.push({
          rowNumber: rowNum,
          sku,
          product: name,
          field: "Category",
          error: `Category '${catInput}' does not exist`,
          suggestedAction: "Verify category name against active marketplace categories",
        });
      }
    }

    // 7. Brand resolution (optional)
    let resolvedBrand = null;
    if (brandInput) {
      resolvedBrand = brandMap.get(brandInput.toLowerCase());
      if (!resolvedBrand) {
        errors.push(`Brand '${brandInput}' not found or is currently inactive.`);
        errorDetails.push({
          rowNumber: rowNum,
          sku,
          product: name,
          field: "Brand",
          error: `Brand '${brandInput}' does not exist or is inactive`,
          suggestedAction: "Select an existing marketplace brand or leave blank",
        });
      }
    }

    // 8. Shipping class validation
    if (shippingClass && shippingClass.length > 100) {
      errors.push("Shipping Class cannot exceed 100 characters.");
      errorDetails.push({
        rowNumber: rowNum,
        sku,
        product: name,
        field: "Shipping Class",
        error: "Shipping Class exceeds 100 characters",
        suggestedAction: "Shorten shipping class name to under 100 characters",
      });
    }

    // 9. Product type validation
    if (productType && !["simple", "variable"].includes(productType)) {
      errors.push(`Invalid Product Type '${productType}'. Accepted values: simple, variable.`);
      errorDetails.push({
        rowNumber: rowNum,
        sku,
        product: name,
        field: "Product Type",
        error: `Invalid product type '${productType}'`,
        suggestedAction: "Choose 'simple' or 'variable'",
      });
    }

    // 10. Status validation
    const normStatus = statusInput?.toLowerCase()?.trim();
    if (normStatus && !VALID_STATUS_MAP[normStatus]) {
      errors.push(`Invalid Status '${statusInput}'. Accepted values: draft, pending_approval, active, approved, rejected, inactive.`);
      errorDetails.push({
        rowNumber: rowNum,
        sku,
        product: name,
        field: "Status",
        error: `Invalid status '${statusInput}'`,
        suggestedAction: "Choose draft, pending_approval, active, or approved",
      });
    }

    // 11. Dimensions format validation (optional)
    if (dimensions && !parseDimensionsString(dimensions)) {
      errors.push(`Invalid Dimensions format '${dimensions}'. Format as '25x20x2' or '25, 20, 2'.`);
      errorDetails.push({
        rowNumber: rowNum,
        sku,
        product: name,
        field: "Dimensions",
        error: `Invalid dimensions format '${dimensions}'`,
        suggestedAction: "Format as Length x Width x Height, e.g., '25x20x2'",
      });
    }

    // 12. Image reference validation & variable-product separation (Fix A & D)
    if (hasImageColumns) {
      if (!isSubsequentVariantRow) {
        // Parent product row: Validate Image 1 through Image 4
        const parentImageCols = [
          { val: image1, colName: "Image 1" },
          { val: image2, colName: "Image 2" },
          { val: image3, colName: "Image 3" },
          { val: image4, colName: "Image 4" },
        ];
        for (const col of parentImageCols) {
          if (col.val) {
            const valRes = validateImageReference(col.val, { zipArchiveContext });
            if (!valRes.isValid) {
              errors.push(`Invalid ${col.colName} reference: ${valRes.reason}`);
              errorDetails.push({
                rowNumber: rowNum,
                sku,
                product: name,
                field: col.colName,
                error: valRes.reason,
                suggestedAction: "Provide a valid HTTPS URL, approved local upload path (/uploads/...), or a matching file in the uploaded ZIP archive",
              });
            }
          }
        }
      } else {
        // Subsequent variant row: Validate Image 1 (singular variant image); reject Image 2 - 4
        if (image1) {
          const valRes = validateImageReference(image1, { zipArchiveContext });
          if (!valRes.isValid) {
            errors.push(`Invalid Image 1 reference: ${valRes.reason}`);
            errorDetails.push({
              rowNumber: rowNum,
              sku,
              product: name,
              field: "Image 1",
              error: valRes.reason,
              suggestedAction: "Provide a valid HTTPS URL, approved local upload path (/uploads/...), or a matching file in the uploaded ZIP archive",
            });
          }
        }
        const extraVariantCols = [
          { val: image2, colName: "Image 2" },
          { val: image3, colName: "Image 3" },
          { val: image4, colName: "Image 4" },
        ];
        for (const col of extraVariantCols) {
          if (col.val) {
            errors.push(`${col.colName} is not supported on subsequent variant rows. Only the parent product row accepts secondary gallery images.`);
            errorDetails.push({
              rowNumber: rowNum,
              sku,
              product: name,
              field: col.colName,
              error: "Variant rows do not accept secondary gallery images",
              suggestedAction: "Move secondary gallery images to the parent product row (first row of product) or leave blank",
            });
          }
        }
      }
    }

    // 13. Mode constraints
    const existingPrd = existingProductMap.get(sku);
    const isSelfExisting = Boolean(
      existingPrd &&
        (!vendorId || existingPrd.vendorId?.toString() === vendorId.toString())
    );

    if (mode === "CREATE_ONLY" && isSelfExisting) {
      const msg = `SKU '${sku}' already exists (CREATE_ONLY mode active).`;
      errors.push(msg);
      errorDetails.push({
        rowNumber: rowNum,
        sku,
        product: name,
        field: "SKU",
        error: msg,
        suggestedAction: "Use CREATE_AND_UPDATE or UPDATE_ONLY mode to update existing SKUs",
      });
    } else if (mode === "UPDATE_ONLY" && !isSelfExisting) {
      const msg = `SKU '${sku}' not found for update (UPDATE_ONLY mode active).`;
      errors.push(msg);
      errorDetails.push({
        rowNumber: rowNum,
        sku,
        product: name,
        field: "SKU",
        error: msg,
        suggestedAction: "Use CREATE_AND_UPDATE or CREATE_ONLY mode to create new SKUs",
      });
    }

    const isValid = errors.length === 0;
    const action = isSelfExisting ? "update" : "create";

    if (isValid) {
      validRowsCount++;
      if (action === "update") {
        updateCount++;
      } else {
        newVariantsCount++;
      }

      // Track distinct parent products
      const pKey = parentSku || name.toLowerCase().trim();
      if (!parentProductTracker.has(pKey)) {
        parentProductTracker.set(pKey, true);
        if (action === "create") {
          newProductsCount++;
        }
      }
    } else {
      errorRowsCount++;
    }

    const tags = tagsStr
      ? tagsStr
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      : [];

    parsedRows.push({
      rowNumber: rowNum,
      name,
      parentSku: parentSku || sku,
      sku,
      productType: productType || null,
      shortDescription: shortDesc,
      description: desc,
      categoryName: resolvedCategory?.name || catInput,
      categoryId: resolvedCategory?._id || null,
      brandName: resolvedBrand?.name || brandInput || "Unbranded",
      brandId: resolvedBrand?._id || null,
      price: isNaN(price) ? 0 : price,
      compareAtPrice,
      costPrice,
      stockQuantity: isNaN(stockQuantity) ? 0 : stockQuantity,
      warehouseCode: resolvedWarehouse?.code || warehouseCode || null,
      warehouseId: resolvedWarehouse?._id || null,
      lowStockThreshold,
      color,
      size,
      material,
      barcode,
      attributes,
      taxCategory: ["standard", "reduced", "zero", "exempt"].includes(taxCat)
        ? taxCat
        : "standard",
      isTaxable,
      weight: Number(weightStr) || 0,
      dimensions,
      shippingClass: shippingClass || null,
      imageUrl: image1,
      image2,
      image3,
      image4,
      hasImageColumns,
      isSubsequentVariantRow,
      tags,
      seoTitle,
      seoDescription: seoDesc,
      seoKeywords: seoKeywordsStr
        ? seoKeywordsStr.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
        : [],
      isVirtual,
      isDownloadable,
      catalogStatus: (normStatus && VALID_STATUS_MAP[normStatus]) || "draft",
      status: isValid ? "VALID" : "ERROR",
      action,
      existingProductId: existingPrd?._id || null,
      existingVariantId: existingPrd?.variantId || null,
      errors,
    });
  }

  const results = parsedRows.map((r) => ({
    rowIndex: r.rowNumber,
    isValid: r.status === "VALID",
    status: r.status,
    action: r.action,
    row: {
      ...r,
      title: r.name,
      stock: r.stockQuantity,
      category: r.categoryName,
      brand: r.brandName,
    },
    errors: r.errors,
  }));

  return {
    totalRows: parsedRows.length,
    validRowsCount,
    validCount: validRowsCount,
    errorRowsCount,
    errorCount: errorRowsCount,
    newProductsCount,
    newVariantsCount,
    updateCount,
    rows: parsedRows,
    results,
    errorDetails,
    stagingId: zipArchiveContext?.stagingId || null,
    archiveSummary,
  };
};

/**
 * 3. Commit Validated Bulk Product Import (Multi-Row Parent & Variant Batch Mode)
 */
const commitBulkImport = async ({
  rows,
  stagingId = null,
  vendorId = null,
  actor,
  req = null,
  jobId = null,
}) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new AppError("No product rows provided for import", 400, "EMPTY_PAYLOAD");
  }

  // Filter valid rows
  const validRows = rows
    .filter((r) => {
      const isVal =
        r.status === "VALID" ||
        r.isValid === true ||
        (r.status !== "ERROR" && (!r.errors || r.errors.length === 0));
      const catId = r.categoryId || r.row?.categoryId;
      return isVal && catId;
    })
    .map((r) => {
      const src = r.row ? { ...r, ...r.row } : r;
      return {
        ...src,
        name: src.name || src.title,
        price: Number(src.price) || 0,
        compareAtPrice: src.compareAtPrice ? Number(src.compareAtPrice) : null,
        costPrice: src.costPrice ? Number(src.costPrice) : null,
        stockQuantity:
          src.stockQuantity !== undefined
            ? Number(src.stockQuantity)
            : Number(src.stock) || 0,
        warehouseCode: src.warehouseCode || null,
        warehouseId: src.warehouseId || null,
        lowStockThreshold: src.lowStockThreshold != null ? Number(src.lowStockThreshold) : 5,
        categoryId: src.categoryId,
        brandId: src.brandId || null,
        productType: src.productType || null,
        shortDescription: src.shortDescription || "",
        description: src.description || "",
        taxCategory: src.taxCategory || "standard",
        isTaxable: src.isTaxable !== false,
        weight: Number(src.weight) || 0,
        dimensions: src.dimensions || "",
        shippingClass: src.shippingClass || "standard",
        sku: String(src.sku).trim().toUpperCase(),
        parentSku: src.parentSku ? String(src.parentSku).trim().toUpperCase() : "",
        color: src.color || "",
        size: src.size || "",
        material: src.material || "",
        barcode: src.barcode || "",
        attributes: src.attributes || {},
        imageUrl: src.imageUrl || "",
        image2: src.image2 || "",
        image3: src.image3 || "",
        image4: src.image4 || "",
        hasImageColumns: src.hasImageColumns !== undefined ? Boolean(src.hasImageColumns) : true,
        isSubsequentVariantRow: Boolean(src.isSubsequentVariantRow),
        tags: Array.isArray(src.tags) ? src.tags : [],
        seoTitle: src.seoTitle || "",
        seoDescription: src.seoDescription || "",
        seoKeywords: Array.isArray(src.seoKeywords) ? src.seoKeywords : [],
        isVirtual: Boolean(src.isVirtual),
        isDownloadable: Boolean(src.isDownloadable),
        catalogStatus: src.catalogStatus || "draft",
        action: src.action || "create",
        existingProductId: src.existingProductId || null,
        existingVariantId: src.existingVariantId || null,
      };
    });

  if (validRows.length === 0) {
    throw new AppError(
      "Cannot commit import: no rows passed server validation.",
      400,
      "NO_VALID_ROWS_TO_IMPORT"
    );
  }

  // P2-A: Revalidate all submitted image references at commit time against security policy
  for (const row of validRows) {
    const refs = [row.imageUrl, row.image2, row.image3, row.image4].filter(Boolean);
    for (const ref of refs) {
      const str = String(ref).trim();
      if (!str) continue;

      // 1. Path traversal & illegal characters
      if (str.includes("..") || str.includes("\\") || str.includes("\0") || /[\r\n\t]/.test(str)) {
        throw new AppError(
          `Invalid image reference '${str}': Local upload path contains invalid path traversal segments, backslashes, or control characters.`,
          400,
          "INVALID_IMAGE_REFERENCE"
        );
      }

      // 2. Protocol and scheme validation
      const schemeMatch = str.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
      if (schemeMatch && schemeMatch[1].toLowerCase() !== "https") {
        throw new AppError(
          `Invalid image reference '${str}': Unsupported image URL scheme '${schemeMatch[1]}'. Only secure 'https://' URLs, approved local '/uploads/' paths, and ZIP archive image filenames are accepted.`,
          400,
          "INVALID_IMAGE_REFERENCE"
        );
      }

      // 3. Reject protocol-relative URLs
      if (str.startsWith("//")) {
        throw new AppError(
          `Invalid image reference '${str}': Protocol-relative URLs starting with '//' are not allowed.`,
          400,
          "INVALID_IMAGE_REFERENCE"
        );
      }

      // 4. Reject local paths outside /uploads/
      if (str.startsWith("/") && !str.startsWith("/uploads/")) {
        throw new AppError(
          `Invalid image reference '${str}': Local paths outside the approved '/uploads/' namespace are not permitted.`,
          400,
          "INVALID_IMAGE_REFERENCE"
        );
      }

      // 5. SVG and extension validation
      const cleanPath = str.split("?")[0].split("#")[0];
      const lastDot = cleanPath.lastIndexOf(".");
      const ext = lastDot !== -1 ? cleanPath.slice(lastDot).toLowerCase() : "";
      if (ext === ".svg") {
        throw new AppError(
          `Invalid image reference '${str}': SVG image format is not permitted for product images due to security policy.`,
          400,
          "INVALID_IMAGE_REFERENCE"
        );
      }

      if (str.toLowerCase().startsWith("https://") || str.startsWith("/uploads/")) {
        const valRes = validateImageReference(str);
        if (!valRes.isValid) {
          throw new AppError(
            `Invalid image reference '${str}': ${valRes.reason}`,
            400,
            "INVALID_IMAGE_REFERENCE"
          );
        }
      } else {
        if (!ALLOWED_RASTER_EXTENSIONS.includes(ext)) {
          throw new AppError(
            `Invalid image reference '${str}': Unsupported file extension '${ext}'. Allowed formats: ${ALLOWED_RASTER_EXTENSIONS.join(", ")}.`,
            400,
            "INVALID_IMAGE_REFERENCE"
          );
        }
      }
    }
  }

  // Safe vendor resolution (DEF-BULK-01): resolve legitimate Vendor document ID
  let vendorObjId = null;
  if (vendorId && mongoose.isValidObjectId(vendorId)) {
    vendorObjId = new mongoose.Types.ObjectId(vendorId);
  } else if (actor?.id) {
    const userVendor = await Vendor.findOne({ userId: actor.id, deletedAt: null }).lean();
    if (userVendor) {
      vendorObjId = userVendor._id;
    }
  }
  if (!vendorObjId) {
    const defaultVendor = await Vendor.findOne({ isActive: true, deletedAt: null }).lean();
    if (defaultVendor) {
      vendorObjId = defaultVendor._id;
    }
  }

  // Resolve fulfillment warehouses (DEF-BULK-03)
  const allWarehouses = await Warehouse.find({ isActive: true, deletedAt: null }).lean();
  const primaryWarehouse = allWarehouses.find((w) => w.isDefault) || allWarehouses[0];
  if (!primaryWarehouse) {
    throw new AppError(
      "No active warehouse configured for product import inventory allocation",
      400,
      "WAREHOUSE_NOT_CONFIGURED"
    );
  }
  const warehouseMap = new Map();
  for (const wh of allWarehouses) {
    if (wh.code) warehouseMap.set(wh.code.toLowerCase().trim(), wh);
    if (wh.name) warehouseMap.set(wh.name.toLowerCase().trim(), wh);
    warehouseMap.set(wh._id.toString(), wh);
  }

  // Group rows by parent product (by parentSku or by product name)
  const productGroups = new Map();
  for (const row of validRows) {
    const parentKey = row.parentSku || row.name.toLowerCase().trim();
    const group = productGroups.get(parentKey) || [];
    group.push(row);
    productGroups.set(parentKey, group);
  }

  const isAdmin = Boolean(
    actor?.roles?.includes(ROLES.ADMIN) ||
    actor?.roles?.includes(ROLES.SUPER_ADMIN) ||
    actor?.role === ROLES.ADMIN ||
    actor?.role === ROLES.SUPER_ADMIN ||
    actor?.context === TOKEN_CONTEXTS.ADMINISTRATOR
  );

  let stagedManifest = null;
  if (stagingId) {
    stagedManifest = getStagedManifest(stagingId, {
      vendorId,
      actor,
      isAdmin,
    });
  }

  const backendUploadsDir = path.resolve(__dirname, "../../public/uploads");
  const frontendUploadsDir = path.resolve(__dirname, "../../../frontend/public/uploads");

  if (!fs.existsSync(backendUploadsDir)) {
    fs.mkdirSync(backendUploadsDir, { recursive: true });
  }
  if (!fs.existsSync(frontendUploadsDir)) {
    try {
      fs.mkdirSync(frontendUploadsDir, { recursive: true });
    } catch {
      // Ignored
    }
  }

  const stagedFilesCopiedMap = new Map();
  const newlyCreatedPermanentFiles = [];
  const successfullyCommittedFiles = new Set();

  const cleanupOperationFiles = (fileList) => {
    if (!Array.isArray(fileList) || fileList.length === 0) return;
    for (const filePath of fileList) {
      if (!successfullyCommittedFiles.has(filePath)) {
        try {
          if (fs.existsSync(filePath)) {
            fs.rmSync(filePath, { force: true });
          }
        } catch (unlinkErr) {
          console.warn(`[BulkImport] Failed to cleanup orphaned file ${filePath}:`, unlinkErr.message);
        }
        for (const [normPath, url] of stagedFilesCopiedMap.entries()) {
          if (filePath.endsWith(path.basename(url))) {
            stagedFilesCopiedMap.delete(normPath);
          }
        }
        const idx = newlyCreatedPermanentFiles.indexOf(filePath);
        if (idx !== -1) newlyCreatedPermanentFiles.splice(idx, 1);
      }
    }
  };

  const resolveAndPersistImage = (rawRef, fallbackAlt = "", operationCreatedFiles = null) => {
    if (!rawRef || typeof rawRef !== "string") return null;
    const str = rawRef.trim();
    if (!str) return null;

    // P2-A: Revalidate every image reference at commit time against security policy
    // 1. Path traversal & illegal characters
    if (str.includes("..") || str.includes("\\") || str.includes("\0") || /[\r\n\t]/.test(str)) {
      throw new AppError(
        `Invalid image reference '${str}': Local upload path contains invalid path traversal segments, backslashes, or control characters.`,
        400,
        "INVALID_IMAGE_REFERENCE"
      );
    }

    // 2. Protocol and scheme validation
    const schemeMatch = str.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
    if (schemeMatch && schemeMatch[1].toLowerCase() !== "https") {
      throw new AppError(
        `Invalid image reference '${str}': Unsupported image URL scheme '${schemeMatch[1]}'. Only secure 'https://' URLs, approved local '/uploads/' paths, and ZIP archive image filenames are accepted.`,
        400,
        "INVALID_IMAGE_REFERENCE"
      );
    }

    // 3. Reject protocol-relative URLs
    if (str.startsWith("//")) {
      throw new AppError(
        `Invalid image reference '${str}': Protocol-relative URLs starting with '//' are not allowed.`,
        400,
        "INVALID_IMAGE_REFERENCE"
      );
    }

    // 4. Reject local paths outside /uploads/
    if (str.startsWith("/") && !str.startsWith("/uploads/")) {
      throw new AppError(
        `Invalid image reference '${str}': Local paths outside the approved '/uploads/' namespace are not permitted.`,
        400,
        "INVALID_IMAGE_REFERENCE"
      );
    }

    // 5. SVG and extension validation
    const cleanPath = str.split("?")[0].split("#")[0];
    const lastDot = cleanPath.lastIndexOf(".");
    const ext = lastDot !== -1 ? cleanPath.slice(lastDot).toLowerCase() : "";
    if (ext === ".svg") {
      throw new AppError(
        `Invalid image reference '${str}': SVG image format is not permitted for product images due to security policy.`,
        400,
        "INVALID_IMAGE_REFERENCE"
      );
    }

    if (str.toLowerCase().startsWith("https://") || str.startsWith("/uploads/")) {
      const valRes = validateImageReference(str);
      if (!valRes.isValid) {
        throw new AppError(
          `Invalid image reference '${str}': ${valRes.reason}`,
          400,
          "INVALID_IMAGE_REFERENCE"
        );
      }
      return {
        url: valRes.sanitizedUrl || str,
        altText: fallbackAlt,
      };
    }

    if (!ALLOWED_RASTER_EXTENSIONS.includes(ext)) {
      throw new AppError(
        `Invalid image reference '${str}': Unsupported file extension '${ext}'. Allowed formats: ${ALLOWED_RASTER_EXTENSIONS.join(", ")}.`,
        400,
        "INVALID_IMAGE_REFERENCE"
      );
    }

    if (!stagedManifest) {
      throw new AppError(
        `Relative image reference '${str}' cannot be resolved without a staged image archive session.`,
        400,
        "STAGING_NOT_FOUND"
      );
    }

    const clean = str.replace(/\\/g, "/").toLowerCase();
    const baseName = path.basename(clean);

    let matchedFile = stagedManifest.validFiles.find(
      (f) => f.normalizedPath === clean
    );

    if (!matchedFile) {
      const baseMatches = stagedManifest.validFiles.filter(
        (f) => f.baseName === baseName
      );
      if (baseMatches.length === 1) {
        matchedFile = baseMatches[0];
      } else if (baseMatches.length > 1) {
        throw new AppError(
          `Ambiguous image reference '${str}' matched multiple files in staged archive.`,
          400,
          "AMBIGUOUS_IMAGE_MATCH"
        );
      }
    }

    if (!matchedFile) {
      throw new AppError(
        `Staged image file for reference '${str}' was not found.`,
        404,
        "IMAGE_NOT_FOUND_IN_ARCHIVE"
      );
    }

    if (stagedFilesCopiedMap.has(matchedFile.normalizedPath)) {
      return {
        url: stagedFilesCopiedMap.get(matchedFile.normalizedPath),
        altText: fallbackAlt,
      };
    }

    if (!fs.existsSync(matchedFile.stagedFilePath)) {
      throw new AppError(
        `Staged file '${matchedFile.stagedFilename}' is missing from staging directory.`,
        410,
        "STAGED_FILE_MISSING"
      );
    }

    const buffer = fs.readFileSync(matchedFile.stagedFilePath);

    if (!validateImageMagicBytes(buffer, matchedFile.ext)) {
      throw new AppError(
        `File '${matchedFile.originalName}' failed magic-byte revalidation during commit.`,
        400,
        "INVALID_IMAGE_CONTENT"
      );
    }

    const safeFilename = `product_${Date.now()}_${crypto.randomBytes(4).toString("hex")}${matchedFile.ext}`;
    const backendDest = path.join(backendUploadsDir, safeFilename);
    const frontendDest = path.join(frontendUploadsDir, safeFilename);

    fs.writeFileSync(backendDest, buffer);
    newlyCreatedPermanentFiles.push(backendDest);
    if (operationCreatedFiles) {
      operationCreatedFiles.push(backendDest);
    }

    try {
      fs.writeFileSync(frontendDest, buffer);
      newlyCreatedPermanentFiles.push(frontendDest);
      if (operationCreatedFiles) {
        operationCreatedFiles.push(frontendDest);
      }
    } catch {
      // Ignored
    }

    const fileUrl = `/uploads/${safeFilename}`;
    stagedFilesCopiedMap.set(matchedFile.normalizedPath, fileUrl);

    return {
      url: fileUrl,
      altText: fallbackAlt || matchedFile.baseName.replace(matchedFile.ext, "").replace(/[-_]+/g, " "),
    };
  };

  let createdProductsCount = 0;
  let createdVariantsCount = 0;
  let updatedCount = 0;
  let failedCount = 0;
  const failedDetails = [];

  try {
    for (const [parentKey, variantRows] of productGroups.entries()) {
      const groupCreatedFiles = [];
      const parentCreatedFiles = [];
      try {
      const firstRow = variantRows[0];
      const minPrice = Math.min(...variantRows.map((v) => v.price));
      const totalStock = variantRows.reduce((sum, v) => sum + v.stockQuantity, 0);

      // Check if parent product already exists
      let parentProduct = null;
      if (firstRow.existingProductId) {
        const query = { _id: firstRow.existingProductId, deletedAt: null };
        if (vendorObjId) query.vendorId = vendorObjId;
        parentProduct = await Product.findOne(query);
      }

      if (!parentProduct) {
        // Try finding by parentSku or unique slug
        const query = {
          $or: [{ sku: firstRow.parentSku || firstRow.sku }],
          deletedAt: null,
        };
        if (vendorObjId) query.vendorId = vendorObjId;
        parentProduct = await Product.findOne(query);
      }

      if (parentProduct) {
        // Update existing parent product
        if (firstRow.name) parentProduct.name = firstRow.name;
        parentProduct.price = mongoose.Types.Decimal128.fromString(minPrice.toFixed(2));
        if (firstRow.compareAtPrice != null) {
          parentProduct.compareAtPrice = mongoose.Types.Decimal128.fromString(
            firstRow.compareAtPrice.toFixed(2)
          );
        }
        if (firstRow.shortDescription) parentProduct.shortDescription = firstRow.shortDescription;
        if (firstRow.description) parentProduct.description = firstRow.description;
        if (firstRow.categoryId) parentProduct.categoryId = firstRow.categoryId;
        if (firstRow.brandId) parentProduct.brandId = firstRow.brandId;
        if (firstRow.dimensions) {
          const parsedDims = parseDimensionsString(firstRow.dimensions);
          if (parsedDims) parentProduct.dimensions = parsedDims;
        }
        if (firstRow.shippingClass) parentProduct.shippingClass = firstRow.shippingClass;
        if (firstRow.catalogStatus && VALID_STATUS_MAP[firstRow.catalogStatus.toLowerCase().trim()]) {
          parentProduct.status = VALID_STATUS_MAP[firstRow.catalogStatus.toLowerCase().trim()];
        }
        if (firstRow.isTaxable !== undefined) parentProduct.isTaxable = Boolean(firstRow.isTaxable);
        if (firstRow.taxCategory) parentProduct.taxCategory = firstRow.taxCategory;
        if (firstRow.isVirtual !== undefined) parentProduct.isVirtual = Boolean(firstRow.isVirtual);
        if (firstRow.isDownloadable !== undefined) parentProduct.isDownloadable = Boolean(firstRow.isDownloadable);
        if (firstRow.seoTitle || firstRow.seoDescription || (firstRow.seoKeywords && firstRow.seoKeywords.length)) {
          parentProduct.seo = {
            title: firstRow.seoTitle || parentProduct.seo?.title || "",
            description: firstRow.seoDescription || parentProduct.seo?.description || "",
            keywords: firstRow.seoKeywords?.length ? firstRow.seoKeywords : parentProduct.seo?.keywords || [],
          };
        }
        parentProduct.stockStatus = totalStock > 0 ? "in_stock" : "out_of_stock";

        // Fix B & C: Update parent gallery if image columns exist and at least one image cell is populated
        // Fix D: Do not overwrite parent gallery when processing single-variant rows of a variable product
        const isVariantOnlyUpdate =
          parentProduct.productType === "variable" &&
          variantRows.length === 1 &&
          firstRow.sku !== parentProduct.sku &&
          !firstRow.image2 &&
          !firstRow.image3 &&
          !firstRow.image4;

        if (firstRow.hasImageColumns && !isVariantOnlyUpdate) {
          const rawGalleryRefs = [firstRow.imageUrl, firstRow.image2, firstRow.image3, firstRow.image4].filter(Boolean);
          if (rawGalleryRefs.length > 0) {
            const existingImages = Array.isArray(parentProduct.images) ? parentProduct.images : [];
            parentProduct.images = rawGalleryRefs.map((rawRef, idx) => {
              const fallbackAlt = `${parentProduct.name || firstRow.name} - Image ${idx + 1}`;
              const resolved = resolveAndPersistImage(rawRef, fallbackAlt, parentCreatedFiles);
              const matchedExisting = existingImages.find((img) => img.url === resolved.url);
              return {
                url: resolved.url,
                publicId: matchedExisting?.publicId || null,
                altText: matchedExisting?.altText || resolved.altText || fallbackAlt,
                sortOrder: idx,
              };
            });
          }
          // If all image cells are blank, preserve existing parentProduct.images (Fix C.B)
        }

        await parentProduct.save();
        for (const f of parentCreatedFiles) {
          groupCreatedFiles.push(f);
          successfullyCommittedFiles.add(f);
        }
        updatedCount++;
      } else {
        // Create new parent product (strictly DRAFT for moderation workflow)
        const slug = generateSlug(firstRow.name);
        const rawGalleryRefs = [firstRow.imageUrl, firstRow.image2, firstRow.image3, firstRow.image4].filter(Boolean);
        const images = rawGalleryRefs.map((rawRef, idx) => {
          const fallbackAlt = `${firstRow.name} - Image ${idx + 1}`;
          const resolved = resolveAndPersistImage(rawRef, fallbackAlt, parentCreatedFiles);
          return {
            url: resolved.url,
            publicId: null,
            altText: resolved.altText || fallbackAlt,
            sortOrder: idx,
          };
        });
        const parsedParentDims = parseDimensionsString(firstRow.dimensions);
        const isSingleDefault = variantRows.length === 1;
        const effectiveProductType = firstRow.productType
          ? firstRow.productType.toLowerCase()
          : isSingleDefault ? "simple" : "variable";
        const parentSku = isSingleDefault ? firstRow.sku : (firstRow.parentSku || firstRow.sku);
        const finalStatus = (firstRow.catalogStatus && VALID_STATUS_MAP[firstRow.catalogStatus.toLowerCase().trim()]) || "draft";

        parentProduct = await Product.create({
          name: firstRow.name,
          productType: effectiveProductType,
          slug,
          sku: parentSku,
          shortDescription: firstRow.shortDescription || "",
          description: firstRow.description || "",
          categoryId: firstRow.categoryId,
          brandId: firstRow.brandId || null,
          vendorId: vendorObjId || firstRow.vendorId || actor.id,
          price: mongoose.Types.Decimal128.fromString(minPrice.toFixed(2)),
          compareAtPrice: firstRow.compareAtPrice
            ? mongoose.Types.Decimal128.fromString(firstRow.compareAtPrice.toFixed(2))
            : null,
          currency: "INR",
          isTaxable: firstRow.isTaxable !== false,
          taxCategory: firstRow.taxCategory || "standard",
          stockStatus: totalStock > 0 ? "in_stock" : "out_of_stock",
          status: finalStatus,
          images,
          tags: firstRow.tags,
          dimensions: parsedParentDims || undefined,
          weight: firstRow.weight ? { value: firstRow.weight, unit: "kg" } : undefined,
          shippingClass: firstRow.shippingClass || "standard",
          isVirtual: Boolean(firstRow.isVirtual),
          isDownloadable: Boolean(firstRow.isDownloadable),
          seo: {
            title: firstRow.seoTitle || "",
            description: firstRow.seoDescription || "",
            keywords: firstRow.seoKeywords || [],
          },
          submittedAt: null,
          approvedAt: null,
          rejectedAt: null,
          moderatedBy: null,
        });

        // Reserve parent product SKU in SkuRegistry
        await skuRegistryService.reserveSku({
          sku: parentProduct.sku,
          productId: parentProduct._id,
          entityType: "product",
          isDefault: isSingleDefault,
        });

        for (const f of parentCreatedFiles) {
          groupCreatedFiles.push(f);
          successfullyCommittedFiles.add(f);
        }
        createdProductsCount++;
      }

      // Process each variant in the product group
      for (const vRow of variantRows) {
        const variantCreatedFiles = [];
        try {
          const attributes = { ...(vRow.attributes || {}) };
          if (vRow.color) attributes.color = vRow.color;
          if (vRow.size) attributes.size = vRow.size;
          if (vRow.material) attributes.material = vRow.material;

          let variant = await ProductVariant.findOne({
            productId: parentProduct._id,
            sku: vRow.sku,
            deletedAt: null,
          });

          if (variant) {
            // Update variant
            variant.price = mongoose.Types.Decimal128.fromString(vRow.price.toFixed(2));
            variant.compareAtPrice = vRow.compareAtPrice
              ? mongoose.Types.Decimal128.fromString(vRow.compareAtPrice.toFixed(2))
              : null;
            if (vRow.costPrice) {
              variant.costPrice = mongoose.Types.Decimal128.fromString(vRow.costPrice.toFixed(2));
            }
            if (vRow.barcode) {
              variant.barcode = vRow.barcode;
            }
            variant.stockStatus = vRow.stockQuantity > 0 ? "in_stock" : "out_of_stock";
            if (vRow.dimensions) {
              const parsedVDims = parseDimensionsString(vRow.dimensions);
              if (parsedVDims) variant.dimensions = parsedVDims;
            }
            if (vRow.shippingClass) {
              variant.shippingClass = vRow.shippingClass;
            }
            if (Object.keys(attributes).length > 0) {
              variant.attributes = attributes;
            }

            // Fix C, D, E: Update variant image if provided; preserve if blank; sync simple product default variant
            const isSingleDefault = variantRows.length === 1;
            if (vRow.hasImageColumns && vRow.imageUrl) {
              const attrParts = Object.values(attributes).filter(Boolean);
              const variantName = attrParts.length > 0 ? attrParts.join(" / ") : "Standard";
              const resolved = resolveAndPersistImage(vRow.imageUrl, variantName, variantCreatedFiles);
              const matchedPublicId =
                variant.image && variant.image.url === resolved.url
                  ? variant.image.publicId
                  : null;
              variant.image = {
                url: resolved.url,
                publicId: matchedPublicId,
                altText:
                  variant.image && variant.image.url === resolved.url && variant.image.altText
                    ? variant.image.altText
                    : resolved.altText || variantName,
              };
            } else if (
              isSingleDefault &&
              (parentProduct.productType === "simple" || !parentProduct.productType) &&
              parentProduct.images &&
              parentProduct.images.length > 0
            ) {
              const primaryImg = parentProduct.images[0];
              if (primaryImg && (!variant.image || variant.image.url !== primaryImg.url)) {
                variant.image = {
                  url: primaryImg.url,
                  publicId: primaryImg.publicId || null,
                  altText: primaryImg.altText || variant.name || "Standard",
                };
              }
            }

            await variant.save();
          } else {
            // Create variant
            const attrParts = Object.values(attributes).filter(Boolean);
            const variantName = attrParts.length > 0 ? attrParts.join(" / ") : "Standard";
            const isSingleDefault = variantRows.length === 1;
            let image = undefined;
            if (vRow.imageUrl) {
              const resolved = resolveAndPersistImage(vRow.imageUrl, variantName, variantCreatedFiles);
              image = {
                url: resolved.url,
                publicId: null,
                altText: resolved.altText || variantName,
              };
            } else if (
              isSingleDefault &&
              parentProduct.images &&
              parentProduct.images.length > 0
            ) {
              image = {
                url: parentProduct.images[0].url,
                publicId: parentProduct.images[0].publicId || null,
                altText: parentProduct.images[0].altText || variantName,
              };
            }

            const parsedVDims = parseDimensionsString(vRow.dimensions) || parentProduct.dimensions;

            variant = await ProductVariant.create({
              productId: parentProduct._id,
              sku: vRow.sku,
              name: variantName,
              attributes,
              price: mongoose.Types.Decimal128.fromString(vRow.price.toFixed(2)),
              compareAtPrice: vRow.compareAtPrice
                ? mongoose.Types.Decimal128.fromString(vRow.compareAtPrice.toFixed(2))
                : null,
              costPrice: vRow.costPrice
                ? mongoose.Types.Decimal128.fromString(vRow.costPrice.toFixed(2))
                : null,
              currency: "INR",
              barcode: vRow.barcode || null,
              stockQuantity: 0,
              stockStatus: vRow.stockQuantity > 0 ? "in_stock" : "out_of_stock",
              image,
              weight: vRow.weight ? { value: vRow.weight, unit: "kg" } : parentProduct.weight,
              dimensions: parsedVDims || undefined,
              shippingClass: vRow.shippingClass || parentProduct.shippingClass || "standard",
              isVirtual: Boolean(vRow.isVirtual || parentProduct.isVirtual),
              isDownloadable: Boolean(vRow.isDownloadable || parentProduct.isDownloadable),
              isDefault: isSingleDefault,
              isActive: true,
            });

            // Canonical default variant pointer on parent product for simple products (DEF-01)
            if (isSingleDefault) {
              parentProduct.defaultVariantId = variant._id;
              await parentProduct.save();
            }

            // Reserve variant SKU in SkuRegistry
            await skuRegistryService.reserveSku({
              sku: variant.sku,
              productId: parentProduct._id,
              variantId: variant._id,
              entityType: "variant",
              isDefault: isSingleDefault,
            });

            createdVariantsCount++;
          }

          // Allocate warehouse inventory and record transaction (DEF-BULK-03)
          const targetWarehouse =
            (vRow.warehouseCode && warehouseMap.get(vRow.warehouseCode.toLowerCase())) ||
            (vRow.warehouseId && warehouseMap.get(vRow.warehouseId.toString())) ||
            primaryWarehouse;

          let inv = await Inventory.findOne({
            productVariantId: variant._id,
            warehouseId: targetWarehouse._id,
          });

          const onHandBefore = inv ? inv.onHand : 0;
          const reservedBefore = inv ? inv.reserved : 0;
          // Authoritative inventory safety: on-hand stock cannot be set lower than active reserved stock
          const onHandAfter = Math.max(vRow.stockQuantity, reservedBefore);
          const lowStockThreshold = vRow.lowStockThreshold != null ? vRow.lowStockThreshold : (inv?.lowStockThreshold ?? 5);

          if (inv) {
            inv.onHand = onHandAfter;
            inv.lowStockThreshold = lowStockThreshold;
            inv.lastStockUpdateAt = new Date();
            await inv.save();
          } else {
            inv = await Inventory.create({
              productVariantId: variant._id,
              warehouseId: targetWarehouse._id,
              onHand: onHandAfter,
              reserved: 0,
              lowStockThreshold,
              lastStockUpdateAt: new Date(),
            });
          }

          // Record ledger transaction
          await InventoryTransaction.create({
            productVariantId: variant._id,
            warehouseId: targetWarehouse._id,
            type: onHandAfter >= onHandBefore ? "receive" : "adjustment",
            quantity: onHandAfter - onHandBefore,
            onHandBefore,
            onHandAfter,
            reservedBefore,
            reservedAfter: reservedBefore,
            referenceType: "bulk_import",
            referenceId: jobId || "IMPORT_DIRECT",
            actorUserId: actor.id || actor._id,
            notes: `Bulk import stock allocation for SKU ${vRow.sku} in warehouse ${targetWarehouse.code || targetWarehouse.name}`,
          });

          // Sync variant stock aggregate read-mirror
          await syncVariantStockMirror(variant._id);

          // Mark variant files as successfully committed
          for (const f of variantCreatedFiles) {
            groupCreatedFiles.push(f);
            successfullyCommittedFiles.add(f);
          }
        } catch (vErr) {
          // P1-D: Clean up permanent files created exclusively for this failed variant
          cleanupOperationFiles(variantCreatedFiles);
          failedCount++;
          failedDetails.push({
            rowNumber: vRow.rowNumber,
            sku: vRow.sku,
            error: vErr.message || "Variant persistence failed",
          });
        }
      }

      // Mark files as successfully committed for this product group
      for (const f of groupCreatedFiles) {
        successfullyCommittedFiles.add(f);
      }
    } catch (pErr) {
      // P1-D: Clean up permanent files created exclusively for this failed product group
      cleanupOperationFiles(parentCreatedFiles);
      cleanupOperationFiles(groupCreatedFiles);
      failedCount += variantRows.length;
      failedDetails.push({
        rowNumber: variantRows[0]?.rowNumber,
        sku: variantRows[0]?.sku,
        error: pErr.message || "Product group persistence failed",
      });
    }
  }
} catch (err) {
  for (const filePath of newlyCreatedPermanentFiles) {
    try {
      if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { force: true });
      }
    } catch {
      // Ignored
    }
  }
  throw err;
} finally {
  if (stagingId) {
    cleanupStaging(stagingId);
  }
}

  // Record ImportExportJob
  const generatedJobId =
    jobId ||
    `IMP-PRD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

  let jobRecord = null;
  try {
    jobRecord = await ImportExportJob.create({
      jobId: generatedJobId,
      type: "import_products",
      scope: vendorObjId ? "vendor" : "platform_admin",
      vendorId: vendorObjId || null,
      requestedBy: actor?.id || actor?._id,
      filename: req?.body?.filename || "bulk_import.xlsx",
      format: "xlsx",
      status: failedCount === 0 ? "completed" : "completed_with_errors",
      progress: 100,
      totalRecords: validRows.length + failedCount,
      processedRecords: validRows.length,
      successfulRecords: validRows.length - failedCount,
      failedRecords: failedCount,
      errorDetails: failedDetails.map((f) => ({
        rowNumber: f.rowNumber || 0,
        sku: f.sku || "",
        error: f.error || "Import error",
      })),
      summary: {
        createdProductsCount,
        createdVariantsCount,
        updatedCount,
        failedCount,
      },
      startedAt: new Date(),
      completedAt: new Date(),
    });
  } catch (jErr) {
    console.warn("Failed to create ImportExportJob record:", jErr.message);
  }

  // Record audit log
  await recordAuditLog({
    actorId: actor.id,
    action: "BULK_PRODUCT_IMPORT",
    entityType: "product",
    targetId: vendorObjId || actor.id,
    details: {
      jobId: generatedJobId,
      totalRows: validRows.length,
      createdProductsCount,
      createdVariantsCount,
      updatedCount,
      failedCount,
      warehouseId: primaryWarehouse._id,
    },
    req,
  });

  return {
    jobId: generatedJobId,
    job: jobRecord,
    totalProcessed: validRows.length,
    createdProductsCount,
    createdVariantsCount,
    createdCount: createdProductsCount,
    updatedCount,
    failedCount,
    failedDetails,
  };
};

/**
 * 4. Generate Downloadable Error Report Spreadsheet
 */
const generateErrorReport = ({ errorDetails, format = "csv" }) => {
  const isXlsx = format?.toLowerCase() === "xlsx";
  const ERROR_HEADERS = [
    "Row Number",
    "SKU",
    "Product Name",
    "Field",
    "Error Description",
    "Suggested Action",
  ];

  const rows = [ERROR_HEADERS];
  for (const err of errorDetails || []) {
    rows.push([
      err.rowNumber || "",
      sanitizeFormula(err.sku || ""),
      sanitizeFormula(err.product || ""),
      sanitizeFormula(err.field || ""),
      sanitizeFormula(err.error || ""),
      sanitizeFormula(err.suggestedAction || ""),
    ]);
  }

  const ws = xlsx.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 12 }, // Row Number
    { wch: 18 }, // SKU
    { wch: 30 }, // Product
    { wch: 18 }, // Field
    { wch: 45 }, // Error
    { wch: 45 }, // Suggested Action
  ];

  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "Import_Errors");

  const timestamp = new Date().toISOString().slice(0, 10);
  if (isXlsx) {
    const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
    return {
      buffer,
      filename: `buybox_import_errors_${timestamp}.xlsx`,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  const buffer = xlsx.write(wb, { type: "buffer", bookType: "csv" });
  return {
    buffer,
    filename: `buybox_import_errors_${timestamp}.csv`,
    contentType: "text/csv; charset=utf-8",
  };
};

/**
 * 5. Export Authenticated Vendor Products to CSV or XLSX
 */
const exportVendorProducts = async ({
  vendorId,
  filters = {},
  format = "csv",
  actor,
  req = null,
}) => {
  const query = {
    deletedAt: null,
  };

  if (vendorId && mongoose.isValidObjectId(vendorId)) {
    query.vendorId = new mongoose.Types.ObjectId(vendorId);
  }

  if (filters.status && filters.status !== "all") {
    query.status = filters.status;
  }

  if (filters.search && filters.search.trim()) {
    const s = filters.search.trim();
    query.$or = [
      { name: { $regex: s, $options: "i" } },
      { sku: { $regex: s, $options: "i" } },
    ];
  }

  if (filters.categoryId) {
    query.categoryId = filters.categoryId;
  }

  if (filters.brandId) {
    query.brandId = filters.brandId;
  }

  const products = await Product.find(query)
    .populate("categoryId", "name slug")
    .populate("brandId", "name slug")
    .sort({ createdAt: -1 })
    .lean();

  const productIds = products.map((p) => p._id);
  const variants = await ProductVariant.find({
    productId: { $in: productIds },
    deletedAt: null,
  }).lean();

  const variantMap = new Map();
  for (const v of variants) {
    const list = variantMap.get(v.productId.toString()) || [];
    list.push(v);
    variantMap.set(v.productId.toString(), list);
  }

  const isTemplateCompatible = Boolean(filters.templateCompatible || format === "template");
  let exportRows;
  let wsCols;

  if (isTemplateCompatible) {
    exportRows = [TEMPLATE_HEADERS];
    wsCols = [
      { wch: 38 }, // Product Name
      { wch: 18 }, // Parent SKU
      { wch: 22 }, // Variant SKU
      { wch: 16 }, // Product Type
      { wch: 18 }, // Category
      { wch: 16 }, // Brand
      { wch: 12 }, // Price
      { wch: 18 }, // Compare At Price
      { wch: 14 }, // Cost Price
      { wch: 16 }, // Stock Quantity
      { wch: 18 }, // Warehouse Code
      { wch: 18 }, // Low Stock Threshold
      { wch: 16 }, // Color
      { wch: 16 }, // Size
      { wch: 24 }, // Material
      { wch: 18 }, // Barcode
      { wch: 18 }, // Attribute 1 Name
      { wch: 18 }, // Attribute 1 Value
      { wch: 18 }, // Attribute 2 Name
      { wch: 18 }, // Attribute 2 Value
      { wch: 14 }, // Tax Category
      { wch: 12 }, // Is Taxable
      { wch: 14 }, // Weight (kg)
      { wch: 22 }, // Dimensions (LxWxH cm)
      { wch: 16 }, // Shipping Class
      { wch: 35 }, // Short Description
      { wch: 60 }, // Description
      { wch: 45 }, // Image 1
      { wch: 45 }, // Image 2
      { wch: 45 }, // Image 3
      { wch: 45 }, // Image 4
      { wch: 30 }, // Tags
      { wch: 25 }, // SEO Title
      { wch: 35 }, // SEO Description
      { wch: 25 }, // SEO Keywords
      { wch: 12 }, // Is Virtual
      { wch: 16 }, // Is Downloadable
      { wch: 14 }, // Status
    ];

    // Pre-fetch warehouse inventory for accurate Warehouse Code & Low Stock Threshold
    const allVariantIds = variants.map((v) => v._id);
    const invRecords = await Inventory.find({
      productVariantId: { $in: allVariantIds },
    })
      .populate("warehouseId", "code name")
      .lean();

    const invMap = new Map();
    for (const inv of invRecords) {
      invMap.set(inv.productVariantId.toString(), inv);
    }

    for (const p of products) {
      const prdVariants = variantMap.get(p._id.toString()) || [];
      const dimsStr =
        p.dimensions && p.dimensions.length && p.dimensions.width && p.dimensions.height
          ? `${p.dimensions.length}x${p.dimensions.width}x${p.dimensions.height}`
          : "";

      if (prdVariants.length === 0) {
        exportRows.push([
          sanitizeFormula(p.name),
          sanitizeFormula(p.sku),
          sanitizeFormula(p.sku),
          p.productType || "simple",
          sanitizeFormula(p.categoryId?.name || ""),
          sanitizeFormula(p.brandId?.name || ""),
          p.price ? Number(p.price.toString()).toFixed(2) : "0.00",
          p.compareAtPrice ? Number(p.compareAtPrice.toString()).toFixed(2) : "",
          "",
          0,
          "",
          5,
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          p.taxCategory || "standard",
          p.isTaxable !== false ? "true" : "false",
          p.weight?.value != null ? p.weight.value : "",
          dimsStr,
          p.shippingClass || "standard",
          sanitizeFormula(p.shortDescription || ""),
          sanitizeFormula(p.description || ""),
          (p.images && p.images[0]?.url) || "",
          (p.images && p.images[1]?.url) || "",
          (p.images && p.images[2]?.url) || "",
          (p.images && p.images[3]?.url) || "",
          (p.tags || []).join(","),
          p.seo?.title || "",
          p.seo?.description || "",
          (p.seo?.keywords || []).join(","),
          p.isVirtual ? "true" : "false",
          p.isDownloadable ? "true" : "false",
          p.status || "draft",
        ]);
      } else {
        for (let vIdx = 0; vIdx < prdVariants.length; vIdx++) {
          const v = prdVariants[vIdx];
          const vAttrs = v.attributes instanceof Map ? Object.fromEntries(v.attributes) : v.attributes || {};
          const vDims =
            v.dimensions && v.dimensions.length && v.dimensions.width && v.dimensions.height
              ? `${v.dimensions.length}x${v.dimensions.width}x${v.dimensions.height}`
              : dimsStr;

          // Extract non-standard dynamic attributes
          const customAttrKeys = Object.keys(vAttrs).filter(
            (k) => !["color", "size", "material"].includes(k.toLowerCase())
          );
          const attr1Name = customAttrKeys[0] || "";
          const attr1Val = attr1Name ? vAttrs[attr1Name] : "";
          const attr2Name = customAttrKeys[1] || "";
          const attr2Val = attr2Name ? vAttrs[attr2Name] : "";

          const vInv = invMap.get(v._id.toString());
          const warehouseCode = vInv?.warehouseId?.code || "";
          const stockQty = vInv?.onHand != null ? vInv.onHand : v.stockQuantity || 0;
          const lowStock = vInv?.lowStockThreshold != null ? vInv.lowStockThreshold : 5;

          // Fix F: Row 0 is parent product row -> canonical parent gallery in Image 1..4
          // Subsequent rows (> 0) -> only variant's singular image in Image 1, Image 2..4 empty
          let img1Col = "";
          let img2Col = "";
          let img3Col = "";
          let img4Col = "";

          if (vIdx === 0) {
            img1Col = (p.images && p.images[0]?.url) || v.image?.url || "";
            img2Col = (p.images && p.images[1]?.url) || "";
            img3Col = (p.images && p.images[2]?.url) || "";
            img4Col = (p.images && p.images[3]?.url) || "";
          } else {
            img1Col = v.image?.url || "";
            img2Col = "";
            img3Col = "";
            img4Col = "";
          }

          exportRows.push([
            sanitizeFormula(p.name),
            sanitizeFormula(p.sku),
            sanitizeFormula(v.sku),
            p.productType || (prdVariants.length > 1 ? "variable" : "simple"),
            sanitizeFormula(p.categoryId?.name || ""),
            sanitizeFormula(p.brandId?.name || ""),
            v.price
              ? Number(v.price.toString()).toFixed(2)
              : p.price
              ? Number(p.price.toString()).toFixed(2)
              : "0.00",
            v.compareAtPrice
              ? Number(v.compareAtPrice.toString()).toFixed(2)
              : p.compareAtPrice
              ? Number(p.compareAtPrice.toString()).toFixed(2)
              : "",
            v.costPrice ? Number(v.costPrice.toString()).toFixed(2) : "",
            stockQty,
            warehouseCode,
            lowStock,
            sanitizeFormula(vAttrs.color || ""),
            sanitizeFormula(vAttrs.size || ""),
            sanitizeFormula(vAttrs.material || ""),
            sanitizeFormula(v.barcode || ""),
            sanitizeFormula(attr1Name),
            sanitizeFormula(attr1Val),
            sanitizeFormula(attr2Name),
            sanitizeFormula(attr2Val),
            p.taxCategory || "standard",
            p.isTaxable !== false ? "true" : "false",
            v.weight?.value != null ? v.weight.value : p.weight?.value != null ? p.weight.value : "",
            vDims,
            v.shippingClass || p.shippingClass || "standard",
            sanitizeFormula(p.shortDescription || ""),
            sanitizeFormula(p.description || ""),
            img1Col,
            img2Col,
            img3Col,
            img4Col,
            (p.tags || []).join(","),
            p.seo?.title || "",
            p.seo?.description || "",
            (p.seo?.keywords || []).join(","),
            v.isVirtual || p.isVirtual ? "true" : "false",
            v.isDownloadable || p.isDownloadable ? "true" : "false",
            p.status || "draft",
          ]);
        }
      }
    }
  } else {
    const EXPORT_HEADERS = [
      "Product ID (Secure)",
      "Product Name",
      "Parent SKU",
      "Category",
      "Brand",
      "Price (INR)",
      "Compare At Price (INR)",
      "Stock Status",
      "Variants Count",
      "Catalog Status",
      "Created Date",
    ];

    exportRows = [EXPORT_HEADERS];
    wsCols = [
      { wch: 32 }, // Secure ID
      { wch: 40 }, // Product Name
      { wch: 18 }, // SKU
      { wch: 20 }, // Category
      { wch: 20 }, // Brand
      { wch: 14 }, // Price
      { wch: 18 }, // Compare At Price
      { wch: 14 }, // Stock Status
      { wch: 14 }, // Variants Count
      { wch: 16 }, // Status
      { wch: 14 }, // Created Date
    ];

    for (const p of products) {
      const prdVariants = variantMap.get(p._id.toString()) || [];
      const secureId = encodeSecureId("product", p._id);

      exportRows.push([
        secureId,
        sanitizeFormula(p.name),
        sanitizeFormula(p.sku),
        sanitizeFormula(p.categoryId?.name || "Uncategorized"),
        sanitizeFormula(p.brandId?.name || "Unbranded"),
        p.price ? Number(p.price.toString()).toFixed(2) : "0.00",
        p.compareAtPrice ? Number(p.compareAtPrice.toString()).toFixed(2) : "",
        p.stockStatus || "out_of_stock",
        prdVariants.length || 1,
        p.status || "draft",
        p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : "",
      ]);
    }
  }

  const ws = xlsx.utils.aoa_to_sheet(exportRows);
  ws["!cols"] = wsCols;

  const isXlsx = String(format).toLowerCase() === "xlsx";
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, isTemplateCompatible ? "Products" : "Merchant_Products");

  await recordAuditLog({
    actorId: actor.id,
    action: "BULK_PRODUCT_EXPORT",
    entityType: "product",
    targetId: vendorId,
    details: {
      format: isXlsx ? "xlsx" : "csv",
      exportedCount: products.length,
      filters,
    },
    req,
  });

  const timestamp = new Date().toISOString().slice(0, 10);
  if (isXlsx) {
    const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
    return {
      buffer,
      filename: `buybox_products_export_${timestamp}.xlsx`,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      count: products.length,
    };
  }

  const buffer = xlsx.write(wb, { type: "buffer", bookType: "csv" });
  return {
    buffer,
    filename: `buybox_products_export_${timestamp}.csv`,
    contentType: "text/csv; charset=utf-8",
    count: products.length,
  };
};

/**
 * 6. Export Marketplace Inventory to CSV or XLSX (Admin or Vendor)
 */
const exportInventory = async ({
  vendorId = null,
  warehouseId = null,
  format = "csv",
  actor,
  req = null,
}) => {
  const query = {};
  if (warehouseId && mongoose.isValidObjectId(warehouseId)) {
    query.warehouseId = new mongoose.Types.ObjectId(warehouseId);
  }

  const inventoryRecords = await Inventory.find(query)
    .populate({
      path: "productVariantId",
      populate: { path: "productId", select: "name sku vendorId categoryId" },
    })
    .populate("warehouseId", "name code")
    .lean();

  // Filter by vendorId if requested
  const filtered = inventoryRecords.filter((inv) => {
    if (!inv.productVariantId?.productId) return false;
    if (vendorId) {
      return (
        inv.productVariantId.productId.vendorId?.toString() ===
        vendorId.toString()
      );
    }
    return true;
  });

  const INVENTORY_HEADERS = [
    "Product Name",
    "Variant SKU",
    "Variant Name",
    "Warehouse Code",
    "Warehouse Name",
    "On Hand",
    "Reserved",
    "Available",
    "Low Stock Threshold",
    "Last Updated",
  ];

  const rows = [INVENTORY_HEADERS];
  for (const inv of filtered) {
    const prd = inv.productVariantId.productId;
    const v = inv.productVariantId;
    const wh = inv.warehouseId;
    const available = Math.max((inv.onHand || 0) - (inv.reserved || 0), 0);

    rows.push([
      sanitizeFormula(prd.name),
      sanitizeFormula(v.sku),
      sanitizeFormula(v.name),
      sanitizeFormula(wh?.code || ""),
      sanitizeFormula(wh?.name || ""),
      inv.onHand || 0,
      inv.reserved || 0,
      available,
      inv.lowStockThreshold || 5,
      inv.lastStockUpdateAt
        ? new Date(inv.lastStockUpdateAt).toISOString().slice(0, 10)
        : "",
    ]);
  }

  const ws = xlsx.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 35 },
    { wch: 18 },
    { wch: 20 },
    { wch: 18 },
    { wch: 25 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 18 },
    { wch: 14 },
  ];

  const isXlsx = String(format).toLowerCase() === "xlsx";
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "Inventory");

  await recordAuditLog({
    actorId: actor.id,
    action: "INVENTORY_EXPORTED",
    entityType: "inventory",
    targetId: vendorId || actor.id,
    details: {
      format: isXlsx ? "xlsx" : "csv",
      count: filtered.length,
      warehouseId,
    },
    req,
  });

  const timestamp = new Date().toISOString().slice(0, 10);
  if (isXlsx) {
    const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
    return {
      buffer,
      filename: `buybox_inventory_${timestamp}.xlsx`,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      count: filtered.length,
    };
  }

  const buffer = xlsx.write(wb, { type: "buffer", bookType: "csv" });
  return {
    buffer,
    filename: `buybox_inventory_${timestamp}.csv`,
    contentType: "text/csv; charset=utf-8",
    count: filtered.length,
  };
};

/**
 * 7. Bulk Update Prices & Stock
 */
const bulkUpdatePricesAndStock = async ({ updates, vendorId, actor, req = null }) => {
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new AppError("No updates provided", 400, "EMPTY_PAYLOAD");
  }

  let updatedCount = 0;
  let failedCount = 0;
  const failedDetails = [];
  const affectedParentProductIds = new Set();

  for (const item of updates) {
    try {
      const sku = String(item.sku).trim().toUpperCase();
      const variant = await ProductVariant.findOne({ sku, deletedAt: null }).populate(
        "productId"
      );

      if (!variant) {
        failedCount++;
        failedDetails.push({ sku, error: "Variant not found" });
        continue;
      }

      if (
        vendorId &&
        variant.productId.vendorId?.toString() !== vendorId.toString()
      ) {
        failedCount++;
        failedDetails.push({ sku, error: "Unauthorized vendor ownership" });
        continue;
      }

      let priceChanged = false;

      if (item.price !== undefined && Number(item.price) > 0) {
        variant.price = mongoose.Types.Decimal128.fromString(
          Number(item.price).toFixed(2)
        );
        priceChanged = true;
      }

      if (item.compareAtPrice !== undefined) {
        variant.compareAtPrice =
          Number(item.compareAtPrice) >= 0
            ? mongoose.Types.Decimal128.fromString(
                Number(item.compareAtPrice).toFixed(2)
              )
            : null;
        priceChanged = true;
      }

      if (item.stockQuantity !== undefined && Number(item.stockQuantity) >= 0) {
        const qty = Math.floor(Number(item.stockQuantity));

        // Update authoritative warehouse inventory
        const inv = await Inventory.findOne({ productVariantId: variant._id });
        if (inv) {
          const onHandBefore = inv.onHand;
          const targetOnHand = Math.max(qty, inv.reserved || 0);
          inv.onHand = targetOnHand;
          inv.lastStockUpdateAt = new Date();
          await inv.save();

          await InventoryTransaction.create({
            productVariantId: variant._id,
            warehouseId: inv.warehouseId,
            type: "adjustment",
            quantity: targetOnHand - onHandBefore,
            onHandBefore,
            onHandAfter: targetOnHand,
            reservedBefore: inv.reserved,
            reservedAfter: inv.reserved,
            referenceType: "bulk_stock_update",
            referenceId: "DIRECT_BULK_UPDATE",
            actorUserId: actor.id || actor._id,
            notes: `Bulk price/stock adjustment for SKU ${sku}`,
          });
        }
        await syncVariantStockMirror(variant._id);
      }

      await variant.save();

      if (priceChanged) {
        const parentId =
          variant.productId?._id
            ? variant.productId._id.toString()
            : variant.productId?.toString();
        if (parentId) {
          affectedParentProductIds.add(parentId);
        }
      }

      updatedCount++;
    } catch (err) {
      failedCount++;
      failedDetails.push({ sku: item.sku, error: err.message });
    }
  }

  // Synchronize canonical parent product prices for affected products
  if (affectedParentProductIds.size > 0) {
    const { syncParentProductPrice } = require("./product-variant.service");
    for (const parentId of affectedParentProductIds) {
      try {
        await syncParentProductPrice(parentId);
      } catch (syncErr) {
        // Graceful continuation consistent with bulk operation conventions
      }
    }
  }

  await recordAuditLog({
    actorId: actor.id,
    action: "BULK_UPDATE_COMPLETED",
    entityType: "product",
    targetId: vendorId || actor.id,
    details: { total: updates.length, updatedCount, failedCount },
    req,
  });

  return { total: updates.length, updatedCount, failedCount, failedDetails };
};

/**
 * 8. Import / Export Job Management
 */
const createJob = async ({
  type,
  scope = "vendor",
  vendorId = null,
  requestedBy,
  filename = "",
  format = "csv",
}) => {
  const jobId = `JOB-${type.toUpperCase().slice(0, 3)}-${Date.now().toString(36).toUpperCase()}`;

  const job = await ImportExportJob.create({
    jobId,
    type,
    scope,
    vendorId,
    requestedBy,
    filename,
    format,
    status: "queued",
    progress: 0,
    startedAt: new Date(),
  });

  return job;
};

const getJobById = async (jobId, actor) => {
  const job = await ImportExportJob.findOne({ jobId })
    .populate("requestedBy", "firstName lastName email")
    .populate("vendorId", "storeName")
    .lean();

  if (!job) {
    throw new AppError("Job not found", 404, "JOB_NOT_FOUND");
  }

  // Vendor isolation: Vendors can only access their own jobs
  if (actor && actor.role === "vendor" && job.vendorId) {
    const Vendor = require("../models/Vendor");
    const vendor = await Vendor.findOne({ userId: actor.id });
    if (!vendor || vendor._id.toString() !== job.vendorId.toString()) {
      throw new AppError("You do not have access to this job", 403, "ACCESS_DENIED");
    }
  }

  return job;
};

const listJobs = async ({ vendorId = null, scope = null, page = 1, limit = 20, actor }) => {
  const query = {};

  if (actor && actor.role === "vendor") {
    const Vendor = require("../models/Vendor");
    const vendor = await Vendor.findOne({ userId: actor.id });
    if (!vendor) return { items: [], total: 0 };
    query.vendorId = vendor._id;
  } else if (vendorId) {
    query.vendorId = vendorId;
  }

  if (scope) {
    query.scope = scope;
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [jobs, total] = await Promise.all([
    ImportExportJob.find(query)
      .populate("requestedBy", "firstName lastName email")
      .populate("vendorId", "storeName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    ImportExportJob.countDocuments(query),
  ]);

  return {
    items: jobs,
    jobs,
    total,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  };
};

module.exports = {
  TEMPLATE_HEADERS,
  SAMPLE_ROWS,
  INSTRUCTION_ROWS,
  REFERENCE_ROWS,
  generateImportTemplate,
  validateBulkImport,
  commitBulkImport,
  generateErrorReport,
  exportVendorProducts,
  exportInventory,
  bulkUpdatePricesAndStock,
  createJob,
  getJobById,
  listJobs,
  sanitizeFormula,
  stripLeadingQuote,
};
