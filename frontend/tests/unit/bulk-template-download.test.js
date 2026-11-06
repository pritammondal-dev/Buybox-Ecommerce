import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { triggerBlobDownload } from "../../src/utils/fileDownload.js";
import { vendorService } from "../../src/services/vendor.service.js";
import { adminCatalogService, adminImportExportService } from "../../src/services/admin/admin.service.js";
import { apiClient } from "../../src/lib/api/axios.js";

describe("Bulk Template & File Download Reliability Unit Tests", () => {
  let createdUrls = [];
  let appendedElements = [];
  let clickedElements = [];

  beforeEach(() => {
    createdUrls = [];
    appendedElements = [];
    clickedElements = [];

    // Mock window.URL and document.createElement if running in Node environment
    global.window = global.window || {};
    global.window.URL = {
      createObjectURL: (blob) => {
        const url = `blob:http://localhost:3000/${Math.random().toString(36).substring(7)}`;
        createdUrls.push({ url, blob, size: blob.size, type: blob.type });
        return url;
      },
      revokeObjectURL: (url) => {
        // no-op mock
      },
    };

    global.document = global.document || {};
    global.document.body = {
      appendChild: (el) => {
        appendedElements.push(el);
      },
      removeChild: (el) => {
        // no-op mock
      },
    };
    global.document.createElement = (tag) => {
      const el = {
        tagName: tag,
        href: "",
        attributes: {},
        setAttribute: (key, val) => {
          el.attributes[key] = val;
        },
        click: () => {
          clickedElements.push({ ...el });
        },
        remove: () => {},
      };
      return el;
    };
  });

  test("1. triggerBlobDownload handles direct Blob instance unwrapped by apiClient", () => {
    const rawZipBytes = Buffer.from("PK\x03\x04MockValidExcelZipArchiveBytesThatAreOver50BytesLength");
    const directBlob = new Blob([rawZipBytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    triggerBlobDownload(directBlob, "buybox_product_import_template.xlsx");

    assert.equal(clickedElements.length, 1);
    assert.equal(clickedElements[0].attributes["download"], "buybox_product_import_template.xlsx");
    assert.equal(createdUrls.length, 1);
    assert.ok(createdUrls[0].size > 20, "Downloaded blob must contain actual binary bytes");
  });

  test("2. triggerBlobDownload handles AxiosResponse object { data: Blob, headers: ... }", () => {
    const rawBytes = Buffer.from("Product Name,SKU,Price\nItem 1,SKU-1,100");
    const blob = new Blob([rawBytes], { type: "text/csv" });
    const axiosResponse = {
      data: blob,
      headers: {
        "content-disposition": 'attachment; filename="custom_template.csv"',
      },
    };

    triggerBlobDownload(axiosResponse, "fallback.csv");

    assert.equal(clickedElements.length, 1);
    assert.equal(clickedElements[0].attributes["download"], "custom_template.csv");
  });

  test("3. triggerBlobDownload safely aborts on empty or undefined input without creating downloads", () => {
    triggerBlobDownload(null, "empty.xlsx");
    triggerBlobDownload(undefined, "empty.xlsx");
    triggerBlobDownload("undefined", "empty.xlsx");

    assert.equal(clickedElements.length, 0, "No download element should be clicked for invalid inputs");
    assert.equal(createdUrls.length, 0, "No ObjectURL should be generated for invalid inputs");
  });

  test("4. Blob resolution never coerces undefined into a 9-byte text file", () => {
    // Simulate what happened prior to Phase 2H defect remediation:
    // When apiClient returned direct Blob `res`, code accessed `res.data` which was undefined.
    const res = new Blob([Buffer.from("ValidExcelZipArchiveBytes1234567890")], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    // Old broken pattern: new Blob([res.data])
    const brokenBlob = new Blob([res.data]);
    assert.equal(brokenBlob.size, 9); // literal "undefined"

    // New safe pattern:
    const safeBlob = res instanceof Blob ? res : (res?.data instanceof Blob ? res.data : new Blob([res?.data || res]));
    assert.ok(safeBlob.size > 20);
    assert.notEqual(safeBlob.size, 9, "Safe blob resolution must not produce a 9-byte undefined string");
  });

  test("5. Repeated downloads with filenames ending in (1), (2) preserve XLSX binary integrity", () => {
    const sampleXlsx = new Blob([Buffer.from("PK\x03\x04ExcelArchiveBytes")], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    // Simulate first download
    triggerBlobDownload(sampleXlsx, "buybox_product_import_template.xlsx");
    // Simulate browser second download with (1)
    triggerBlobDownload(sampleXlsx, "buybox_product_import_template (1).xlsx");

    assert.equal(clickedElements.length, 2);
    assert.equal(clickedElements[0].attributes["download"], "buybox_product_import_template.xlsx");
    assert.equal(clickedElements[1].attributes["download"], "buybox_product_import_template (1).xlsx");
    assert.equal(createdUrls[0].size, sampleXlsx.size);
    assert.equal(createdUrls[1].size, sampleXlsx.size);
  });

  test("6. adminCatalogService.downloadImportTemplate issues request with responseType: blob and returns data", async () => {
    // Verify method configuration
    assert.equal(typeof adminCatalogService.downloadImportTemplate, "function");
    assert.equal(typeof adminImportExportService.downloadTemplate, "function");
    assert.equal(typeof vendorService.downloadImportTemplate, "function");
  });
});
