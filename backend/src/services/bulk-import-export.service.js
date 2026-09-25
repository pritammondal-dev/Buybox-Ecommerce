const mongoose = require("mongoose");
const xlsx = require("xlsx");
const crypto = require("crypto");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const Inventory = require("../models/Inventory");
const InventoryTransaction = require("../models/InventoryTransaction");
const Warehouse = require("../models/Warehouse");
const Category = require("../models/Category");
const Brand = require("../models/Brand");
const ImportExportJob = require("../models/ImportExportJob");
const AppError = require("../errors/AppError");
const { recordAuditLog } = require("./governance.service");
const { encodeSecureId } = require("../utils/secure-id.util");

/**
 * Sanitize cell values against spreadsheet formula injection (CSV/Excel Formula Injection).
 * Any string beginning with '=', '+', '-', '@', '\t', or '\r' is prefixed with a single quote.
 */
const sanitizeFormula = (val) => {
  if (val === null || val === undefined) return "";
  const str = String(val).trim();
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
 * Canonical Multi-Row & Variant CSV & XLSX Import Template Headers
 */
const TEMPLATE_HEADERS = [
  "Product Name",
  "Parent SKU",
  "Variant SKU",
  "Category",
  "Brand",
  "Price",
  "Compare At Price",
  "Cost Price",
  "Stock Quantity",
  "Color",
  "Size",
  "Material",
  "Barcode",
  "Tax Category",
  "Weight (kg)",
  "Dimensions (LxWxH cm)",
  "Description",
  "Image 1",
  "Tags",
];

const SAMPLE_ROWS = [
  // --- Example 1: Multi-Variant Apparel (T-Shirt with Size & Color Matrix) ---
  [
    "Classic Combed Cotton Crewneck T-Shirt",
    "TS-CREW-100",
    "TS-BLK-S",
    "Fashion",
    "AuraVue",
    499.0,
    799.0,
    250.0,
    25,
    "Black",
    "S",
    "100% Combed Cotton",
    "890123456001",
    "standard",
    0.2,
    "25x20x2",
    "Ultra-soft breathable combed cotton crewneck t-shirt with reinforced stitching.",
    "https://images.unsplash.com/photo-1521572267360-ee0c2909d518",
    "fashion,tshirt,cotton,casual,men",
  ],
  [
    "Classic Combed Cotton Crewneck T-Shirt",
    "TS-CREW-100",
    "TS-BLK-M",
    "Fashion",
    "AuraVue",
    499.0,
    799.0,
    250.0,
    30,
    "Black",
    "M",
    "100% Combed Cotton",
    "890123456002",
    "standard",
    0.22,
    "25x20x2",
    "Ultra-soft breathable combed cotton crewneck t-shirt with reinforced stitching.",
    "https://images.unsplash.com/photo-1521572267360-ee0c2909d518",
    "fashion,tshirt,cotton,casual,men",
  ],
  [
    "Classic Combed Cotton Crewneck T-Shirt",
    "TS-CREW-100",
    "TS-WHT-L",
    "Fashion",
    "AuraVue",
    499.0,
    799.0,
    250.0,
    15,
    "White",
    "L",
    "100% Combed Cotton",
    "890123456003",
    "standard",
    0.24,
    "25x20x2",
    "Ultra-soft breathable combed cotton crewneck t-shirt with reinforced stitching.",
    "https://images.unsplash.com/photo-1521572267360-ee0c2909d518",
    "fashion,tshirt,cotton,casual,men",
  ],

  // --- Example 2: Multi-Variant Electronics (Flagship Smartphone with Color & Storage) ---
  [
    "AuraPro 5G Flagship Smartphone",
    "PHONE-AP-5G",
    "PHONE-AP-BLK-128",
    "Mobiles",
    "AuraVue",
    49999.0,
    59999.0,
    38000.0,
    50,
    "Obsidian Black",
    "8GB + 128GB",
    "Corning Gorilla Glass & Titanium",
    "890123456004",
    "standard",
    0.19,
    "16x7.5x0.8",
    "Flagship 5G smartphone featuring 120Hz AMOLED HDR10+ display and 108MP AI triple camera.",
    "https://images.unsplash.com/photo-1511707171634-5f897ff02560",
    "smartphone,5g,mobile,flagship,android",
  ],
  [
    "AuraPro 5G Flagship Smartphone",
    "PHONE-AP-5G",
    "PHONE-AP-BLU-256",
    "Mobiles",
    "AuraVue",
    54999.0,
    64999.0,
    42000.0,
    40,
    "Pacific Blue",
    "12GB + 256GB",
    "Corning Gorilla Glass & Titanium",
    "890123456005",
    "standard",
    0.19,
    "16x7.5x0.8",
    "Flagship 5G smartphone featuring 120Hz AMOLED HDR10+ display and 108MP AI triple camera.",
    "https://images.unsplash.com/photo-1511707171634-5f897ff02560",
    "smartphone,5g,mobile,flagship,android",
  ],

  // --- Example 3: Standalone Single Product (Wireless ANC Headphones) ---
  [
    "Acoustic Pro Wireless Noise-Cancelling Headphones",
    "AUDIO-ANC-700",
    "AUDIO-ANC-700-SLV",
    "Audio",
    "Sony",
    12999.0,
    16999.0,
    9000.0,
    80,
    "Silver Matte",
    "Over-Ear",
    "Memory Foam & Aluminum",
    "890123456006",
    "standard",
    0.25,
    "20x18x8",
    "Industry-leading active noise cancellation with 40-hour battery life and Hi-Res Audio certification.",
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
    "audio,headphones,bluetooth,anc,wireless",
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
    "Category",
    "REQUIRED",
    "Text (Platform Taxonomy)",
    "Name or URL slug of an approved, active platform category. Categories are platform-managed; vendors cannot create new categories.",
    "Fashion or Mobiles or Audio",
  ],
  [
    "Brand",
    "OPTIONAL",
    "Text (Platform Brand)",
    "Name or URL slug of an active platform brand. Must match an existing brand in the catalog if supplied.",
    "AuraVue or Sony or Nike",
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
    "Initial available inventory quantity. Allocated to the merchant's primary warehouse upon creation.",
    "25",
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
    "Tax Category",
    "OPTIONAL (Default 'standard')",
    "Text (Enum)",
    "Tax rate classification code.",
    "standard (18%), reduced (5%), zero (0%), exempt",
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
    "25x20x2",
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
    "Tags",
    "OPTIONAL",
    "Text (Comma-separated)",
    "Search keywords and categorization tags separated by commas.",
    "fashion,tshirt,cotton,casual",
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
  ["Category", "Electronics", "Consumer Electronics", "Platform category for smart devices, cameras, and peripherals"],
  ["Brand", "AuraVue", "AuraVue", "Platform certified electronics and apparel brand"],
  ["Brand", "Sony", "Sony", "Official consumer electronics and audio brand"],
  ["Brand", "Apple", "Apple", "Official brand"],
  ["Brand", "Samsung", "Samsung", "Official brand"],
  ["Brand", "Nike", "Nike", "Official sportswear and apparel brand"],
  ["Tax Category", "standard", "Standard GST (18%)", "Standard rate for electronics, apparel, and general goods"],
  ["Tax Category", "reduced", "Reduced GST (5% - 12%)", "Essential goods, select apparel, and packaged items"],
  ["Tax Category", "zero", "Zero Rated (0%)", "Zero-rated agricultural and educational supplies"],
  ["Tax Category", "exempt", "Tax Exempt", "Exempt items not subject to sales tax"],
  ["Import Mode", "CREATE_AND_UPDATE", "Create & Update", "Default mode: inserts new products and updates existing matching SKUs"],
  ["Import Mode", "CREATE_ONLY", "Create Only", "Strict mode: skips or errors on already existing SKUs"],
  ["Import Mode", "UPDATE_ONLY", "Update Only", "Update mode: only modifies existing SKUs owned by the merchant"],
];

/**
 * 1. Generate Downloadable Import Template in CSV or XLSX
 */
const generateImportTemplate = (format = "csv") => {
  const isXlsx = format?.toLowerCase() === "xlsx";
  const wsData = [TEMPLATE_HEADERS, ...SAMPLE_ROWS];
  const ws = xlsx.utils.aoa_to_sheet(wsData);

  ws["!cols"] = [
    { wch: 38 }, // Product Name
    { wch: 18 }, // Parent SKU
    { wch: 22 }, // Variant SKU
    { wch: 18 }, // Category
    { wch: 16 }, // Brand
    { wch: 12 }, // Price
    { wch: 18 }, // Compare At Price
    { wch: 14 }, // Cost Price
    { wch: 16 }, // Stock Quantity
    { wch: 18 }, // Color
    { wch: 16 }, // Size
    { wch: 26 }, // Material
    { wch: 18 }, // Barcode
    { wch: 14 }, // Tax Category
    { wch: 14 }, // Weight (kg)
    { wch: 22 }, // Dimensions (LxWxH cm)
    { wch: 60 }, // Description
    { wch: 50 }, // Image 1
    { wch: 30 }, // Tags
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
  mode = "CREATE_AND_UPDATE",
}) => {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new AppError("No file buffer provided", 400, "MISSING_FILE");
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
  const idxDesc = findHeaderIndex(["description", "desc"]);
  const idxCat = findHeaderIndex(["category"]);
  const idxBrand = findHeaderIndex(["brand"]);
  const idxPrice = findHeaderIndex(["price", "unit price"]);
  const idxComparePrice = findHeaderIndex(["compare at price", "compare price", "mrp"]);
  const idxCostPrice = findHeaderIndex(["cost price", "cost_price"]);
  const idxStock = findHeaderIndex(["stock quantity", "stock", "quantity", "qty"]);
  const idxColor = findHeaderIndex(["color"]);
  const idxSize = findHeaderIndex(["size"]);
  const idxMaterial = findHeaderIndex(["material"]);
  const idxBarcode = findHeaderIndex(["barcode", "ean", "upc"]);
  const idxTaxCat = findHeaderIndex(["tax category", "tax"]);
  const idxWeight = findHeaderIndex(["weight", "weight (kg)"]);
  const idxDimensions = findHeaderIndex(["dimensions (lxwxh cm)", "dimensions", "dimension"]);
  const idxImage1 = findHeaderIndex(["image 1", "image_1", "image", "media"]);
  const idxTags = findHeaderIndex(["tags", "tag"]);

  if (idxName === -1 || idxSku === -1 || idxPrice === -1 || idxCat === -1) {
    throw new AppError(
      "Missing required column headers. Required columns: 'Product Name', 'SKU', 'Price', and 'Category'.",
      400,
      "MISSING_REQUIRED_COLUMNS"
    );
  }

  // Pre-load reference collections
  const categories = await Category.find({ isActive: true, deletedAt: null }).lean();
  const brands = await Brand.find({ isActive: true, deletedAt: null }).lean();

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

  // Pre-load existing SKUs to detect conflict vs self-update
  const rawSkus = rawRows
    .slice(1)
    .map((r) => String(r[idxSku] || "").trim().toUpperCase())
    .filter(Boolean);

  const [existingProducts, existingVariants] = await Promise.all([
    Product.find({ sku: { $in: rawSkus }, deletedAt: null })
      .select("_id sku name vendorId status price")
      .lean(),
    ProductVariant.find({ sku: { $in: rawSkus }, deletedAt: null })
      .populate("productId", "_id sku name vendorId status price")
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

  const seenSkusInFile = new Set();
  const parsedRows = [];
  const errorDetails = [];
  let validRowsCount = 0;
  let errorRowsCount = 0;
  let newProductsCount = 0;
  let newVariantsCount = 0;
  let updateCount = 0;

  const parentProductTracker = new Map();

  for (let i = 1; i < rawRows.length; i++) {
    const r = rawRows[i];
    const rowNum = i + 1; // 1-indexed spreadsheet row

    const name = stripLeadingQuote(String(r[idxName] || "").trim());
    const parentSku = stripLeadingQuote(idxParentSku !== -1 ? String(r[idxParentSku] || "").trim().toUpperCase() : "");
    const sku = stripLeadingQuote(String(r[idxSku] || "").trim().toUpperCase());
    const desc = stripLeadingQuote(idxDesc !== -1 ? String(r[idxDesc] || "").trim() : "");
    const catInput = stripLeadingQuote(String(r[idxCat] || "").trim());
    const brandInput = stripLeadingQuote(idxBrand !== -1 ? String(r[idxBrand] || "").trim() : "");
    const priceStr = String(r[idxPrice] || "").trim().replace(/[$,₹]/g, "");
    const comparePriceStr = idxComparePrice !== -1 ? String(r[idxComparePrice] || "").trim().replace(/[$,₹]/g, "") : "";
    const costPriceStr = idxCostPrice !== -1 ? String(r[idxCostPrice] || "").trim().replace(/[$,₹]/g, "") : "";
    const stockStr = idxStock !== -1 ? String(r[idxStock] || "0").trim() : "0";
    const color = idxColor !== -1 ? stripLeadingQuote(String(r[idxColor] || "").trim()) : "";
    const size = idxSize !== -1 ? stripLeadingQuote(String(r[idxSize] || "").trim()) : "";
    const material = idxMaterial !== -1 ? stripLeadingQuote(String(r[idxMaterial] || "").trim()) : "";
    const barcode = idxBarcode !== -1 ? stripLeadingQuote(String(r[idxBarcode] || "").trim()) : "";
    const taxCat = idxTaxCat !== -1 ? String(r[idxTaxCat] || "standard").trim().toLowerCase() : "standard";
    const weightStr = idxWeight !== -1 ? String(r[idxWeight] || "0").trim() : "0";
    const dimensions = idxDimensions !== -1 ? String(r[idxDimensions] || "").trim() : "";
    const image1 = idxImage1 !== -1 ? stripLeadingQuote(String(r[idxImage1] || "").trim()) : "";
    const tagsStr = idxTags !== -1 ? stripLeadingQuote(String(r[idxTags] || "").trim()) : "";

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

    // 2. SKU validation
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

      // Check cross-vendor isolation
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
    }

    // 3. Price validation
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

    // 4. Stock validation
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

    // 5. Category resolution (Platform-owned taxonomy)
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

    // 6. Brand resolution (optional)
    let resolvedBrand = null;
    if (brandInput) {
      resolvedBrand = brandMap.get(brandInput.toLowerCase());
      if (!resolvedBrand) {
        errors.push(`Brand '${brandInput}' not found or is currently inactive.`);
      }
    }

    // 7. Mode constraints
    const existingPrd = existingProductMap.get(sku);
    const isSelfExisting = Boolean(
      existingPrd &&
        (!vendorId || existingPrd.vendorId?.toString() === vendorId.toString())
    );

    if (mode === "CREATE_ONLY" && isSelfExisting) {
      errors.push(`SKU '${sku}' already exists (CREATE_ONLY mode active).`);
    } else if (mode === "UPDATE_ONLY" && !isSelfExisting) {
      errors.push(`SKU '${sku}' not found for update (UPDATE_ONLY mode active).`);
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
      const parentKey = parentSku || name.toLowerCase().trim();
      if (!parentProductTracker.has(parentKey)) {
        parentProductTracker.set(parentKey, true);
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
      description: desc,
      categoryName: resolvedCategory?.name || catInput,
      categoryId: resolvedCategory?._id || null,
      brandName: resolvedBrand?.name || brandInput || "Unbranded",
      brandId: resolvedBrand?._id || null,
      price: isNaN(price) ? 0 : price,
      compareAtPrice,
      costPrice,
      stockQuantity: isNaN(stockQuantity) ? 0 : stockQuantity,
      color,
      size,
      material,
      barcode,
      taxCategory: ["standard", "reduced", "zero", "exempt"].includes(taxCat)
        ? taxCat
        : "standard",
      weight: Number(weightStr) || 0,
      dimensions,
      imageUrl: image1,
      tags,
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
  };
};

/**
 * 3. Commit Validated Bulk Product Import (Multi-Row Parent & Variant Batch Mode)
 */
const commitBulkImport = async ({
  rows,
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
        categoryId: src.categoryId,
        brandId: src.brandId || null,
        taxCategory: src.taxCategory || "standard",
        weight: Number(src.weight) || 0,
        dimensions: src.dimensions || "",
        description: src.description || "",
        sku: String(src.sku).trim().toUpperCase(),
        parentSku: src.parentSku ? String(src.parentSku).trim().toUpperCase() : "",
        color: src.color || "",
        size: src.size || "",
        material: src.material || "",
        barcode: src.barcode || "",
        imageUrl: src.imageUrl || "",
        tags: Array.isArray(src.tags) ? src.tags : [],
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

  let vendorObjId = null;
  if (vendorId && mongoose.isValidObjectId(vendorId)) {
    vendorObjId = new mongoose.Types.ObjectId(vendorId);
  }

  // Resolve fulfillment warehouse
  let primaryWarehouse = await Warehouse.findOne({ isActive: true }).lean();
  if (!primaryWarehouse) {
    primaryWarehouse = await Warehouse.create({
      name: "Default Marketplace Fulfillment Center",
      code: `WH-DEF-${Date.now().toString().slice(-6)}`,
      address: {
        addressLine1: "Marketplace Logistics Hub",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
      isActive: true,
    });
  }

  // Group rows by parent product (by parentSku or by product name)
  const productGroups = new Map();
  for (const row of validRows) {
    const parentKey = row.parentSku || row.name.toLowerCase().trim();
    const group = productGroups.get(parentKey) || [];
    group.push(row);
    productGroups.set(parentKey, group);
  }

  let createdProductsCount = 0;
  let createdVariantsCount = 0;
  let updatedCount = 0;
  let failedCount = 0;
  const failedDetails = [];

  for (const [parentKey, variantRows] of productGroups.entries()) {
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
        parentProduct.name = firstRow.name;
        parentProduct.price = mongoose.Types.Decimal128.fromString(minPrice.toFixed(2));
        if (firstRow.compareAtPrice) {
          parentProduct.compareAtPrice = mongoose.Types.Decimal128.fromString(
            firstRow.compareAtPrice.toFixed(2)
          );
        }
        if (firstRow.description) parentProduct.description = firstRow.description;
        if (firstRow.categoryId) parentProduct.categoryId = firstRow.categoryId;
        if (firstRow.brandId) parentProduct.brandId = firstRow.brandId;
        parentProduct.stockStatus = totalStock > 0 ? "in_stock" : "out_of_stock";
        await parentProduct.save();
        updatedCount++;
      } else {
        // Create new parent product (strictly DRAFT for moderation workflow)
        const slug = generateSlug(firstRow.name);
        const images = firstRow.imageUrl ? [{ url: firstRow.imageUrl, altText: firstRow.name }] : [];

        parentProduct = await Product.create({
          name: firstRow.name,
          slug,
          sku: firstRow.parentSku || firstRow.sku,
          description: firstRow.description || "",
          categoryId: firstRow.categoryId,
          brandId: firstRow.brandId || null,
          vendorId: vendorObjId || firstRow.vendorId || actor.id,
          price: mongoose.Types.Decimal128.fromString(minPrice.toFixed(2)),
          compareAtPrice: firstRow.compareAtPrice
            ? mongoose.Types.Decimal128.fromString(firstRow.compareAtPrice.toFixed(2))
            : null,
          currency: "INR",
          isTaxable: true,
          taxCategory: firstRow.taxCategory || "standard",
          stockStatus: totalStock > 0 ? "in_stock" : "out_of_stock",
          status: "draft",
          images,
          tags: firstRow.tags,
          submittedAt: null,
          approvedAt: null,
          rejectedAt: null,
          moderatedBy: null,
        });

        createdProductsCount++;
      }

      // Process each variant in the product group
      for (const vRow of variantRows) {
        try {
          const attributes = {};
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
            variant.stockQuantity = vRow.stockQuantity;
            variant.stockStatus = vRow.stockQuantity > 0 ? "in_stock" : "out_of_stock";
            if (Object.keys(attributes).length > 0) {
              variant.attributes = attributes;
            }
            await variant.save();
          } else {
            // Create variant
            const variantName = [vRow.color, vRow.size].filter(Boolean).join(" / ") || "Standard";
            const image = vRow.imageUrl ? { url: vRow.imageUrl, altText: variantName } : undefined;

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
              stockQuantity: vRow.stockQuantity,
              stockStatus: vRow.stockQuantity > 0 ? "in_stock" : "out_of_stock",
              image,
              weight: vRow.weight ? { value: vRow.weight, unit: "kg" } : undefined,
            });

            createdVariantsCount++;
          }

          // Allocate warehouse inventory and record transaction
          let inv = await Inventory.findOne({
            productVariantId: variant._id,
            warehouseId: primaryWarehouse._id,
          });

          const onHandBefore = inv ? inv.onHand : 0;
          const onHandAfter = vRow.stockQuantity;
          const reservedBefore = inv ? inv.reserved : 0;

          if (inv) {
            inv.onHand = onHandAfter;
            inv.lastStockUpdateAt = new Date();
            await inv.save();
          } else {
            inv = await Inventory.create({
              productVariantId: variant._id,
              warehouseId: primaryWarehouse._id,
              onHand: onHandAfter,
              reserved: 0,
              lowStockThreshold: 5,
              lastStockUpdateAt: new Date(),
            });
          }

          // Record ledger transaction
          await InventoryTransaction.create({
            productVariantId: variant._id,
            warehouseId: primaryWarehouse._id,
            type: "receive",
            quantity: onHandAfter - onHandBefore,
            onHandBefore,
            onHandAfter,
            reservedBefore,
            reservedAfter: reservedBefore,
            referenceType: "bulk_import",
            referenceId: jobId || "IMPORT_DIRECT",
            actorUserId: actor.id || actor._id,
            notes: `Bulk import stock allocation for SKU ${vRow.sku}`,
          });
        } catch (vErr) {
          failedCount++;
          failedDetails.push({
            rowNumber: vRow.rowNumber,
            sku: vRow.sku,
            error: vErr.message || "Variant persistence failed",
          });
        }
      }
    } catch (pErr) {
      failedCount += variantRows.length;
      failedDetails.push({
        rowNumber: variantRows[0]?.rowNumber,
        sku: variantRows[0]?.sku,
        error: pErr.message || "Product group persistence failed",
      });
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

  const exportRows = [EXPORT_HEADERS];

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

  const ws = xlsx.utils.aoa_to_sheet(exportRows);
  ws["!cols"] = [
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

  const isXlsx = String(format).toLowerCase() === "xlsx";
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "Merchant_Products");

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

      if (item.price !== undefined && Number(item.price) > 0) {
        variant.price = mongoose.Types.Decimal128.fromString(
          Number(item.price).toFixed(2)
        );
      }

      if (item.compareAtPrice !== undefined) {
        variant.compareAtPrice =
          Number(item.compareAtPrice) >= 0
            ? mongoose.Types.Decimal128.fromString(
                Number(item.compareAtPrice).toFixed(2)
              )
            : null;
      }

      if (item.stockQuantity !== undefined && Number(item.stockQuantity) >= 0) {
        const qty = Math.floor(Number(item.stockQuantity));
        variant.stockQuantity = qty;
        variant.stockStatus = qty > 0 ? "in_stock" : "out_of_stock";

        // Update warehouse inventory
        const inv = await Inventory.findOne({ productVariantId: variant._id });
        if (inv) {
          const onHandBefore = inv.onHand;
          inv.onHand = qty;
          inv.lastStockUpdateAt = new Date();
          await inv.save();

          await InventoryTransaction.create({
            productVariantId: variant._id,
            warehouseId: inv.warehouseId,
            type: "adjustment",
            quantity: qty - onHandBefore,
            onHandBefore,
            onHandAfter: qty,
            reservedBefore: inv.reserved,
            reservedAfter: inv.reserved,
            referenceType: "bulk_stock_update",
            referenceId: "DIRECT_BULK_UPDATE",
            actorUserId: actor.id || actor._id,
            notes: `Bulk price/stock adjustment for SKU ${sku}`,
          });
        }
      }

      await variant.save();
      updatedCount++;
    } catch (err) {
      failedCount++;
      failedDetails.push({ sku: item.sku, error: err.message });
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
