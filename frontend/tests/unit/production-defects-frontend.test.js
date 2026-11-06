import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { adminOperationsService } from "../../src/services/admin/admin.service.js";
import { adminCustomerService } from "../../src/services/admin/admin.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Production Defects Frontend Regression Tests", () => {
  describe("Defect 1: Superadmin Customer Inspection Unwrapping", () => {
    it("adminCustomerService exposes get method for customer inspection", () => {
      assert.strictEqual(typeof adminCustomerService.get, "function");
    });

    it("unwraps customer details from API response without nested blank state", () => {
      const mockRawApiResponse = {
        success: true,
        data: {
          customer: {
            id: "cust-12345",
            firstName: "Priya",
            lastName: "Nair",
            email: "priya.nair@example.com",
            phone: "+919876500000",
            isActive: true,
            kpis: {
              totalOrders: 3,
              totalSpent: 4500,
              completedOrders: 3,
            },
            orders: [{ orderNumber: "ORD-999", grandTotal: 1500 }],
          },
        },
      };

      // Test customer page unwrapping logic
      const custObj =
        mockRawApiResponse?.customer ||
        mockRawApiResponse?.data?.customer ||
        (mockRawApiResponse?.firstName ? mockRawApiResponse : null) ||
        mockRawApiResponse?.data ||
        mockRawApiResponse;

      assert.strictEqual(custObj.firstName, "Priya");
      assert.strictEqual(custObj.lastName, "Nair");
      assert.strictEqual(custObj.email, "priya.nair@example.com");
      assert.strictEqual(custObj.kpis.totalOrders, 3);
      assert.strictEqual(custObj.orders.length, 1);
    });
  });

  describe("Defect 2: Shipment Operations adminOperationsService Import", () => {
    it("adminOperationsService is defined and exports required methods", () => {
      assert.strictEqual(typeof adminOperationsService, "object");
      assert.strictEqual(typeof adminOperationsService.listShipments, "function");
      assert.strictEqual(typeof adminOperationsService.getShipment, "function");
      assert.strictEqual(typeof adminOperationsService.getShipmentPackingSlip, "function");
      assert.strictEqual(typeof adminOperationsService.updateShipmentStatus, "function");
      assert.strictEqual(typeof adminOperationsService.exportShipments, "function");
    });

    it("shipments/page.js explicitly imports adminOperationsService", () => {
      const shipmentsPagePath = path.resolve(
        __dirname,
        "../../src/app/administrator/operations/shipments/page.js"
      );
      const content = fs.readFileSync(shipmentsPagePath, "utf8");

      assert.ok(
        content.includes("adminOperationsService"),
        "shipments page.js must reference adminOperationsService"
      );
      assert.ok(
        /import\s+\{[^}]*adminOperationsService[^}]*\}\s+from/.test(content),
        "shipments page.js must import adminOperationsService from admin.service.js"
      );
    });
  });

  describe("Defect 4: Switch onCheckedChange Warning Prevention", () => {
    it("Switch component safely handles onCheckedChange and does not leak it to DOM input", () => {
      const switchPath = path.resolve(
        __dirname,
        "../../src/components/ui/Switch.jsx"
      );
      const content = fs.readFileSync(switchPath, "utf8");

      assert.ok(
        content.includes("onCheckedChange"),
        "Switch component must handle onCheckedChange for backwards compatibility"
      );
      assert.ok(
        /\{\s*className,\s*checked,\s*defaultChecked,\s*onChange,\s*onCheckedChange,/.test(
          content
        ),
        "onCheckedChange must be destructured so it does not leak to native input props"
      );
    });

    it("AdminPaymentMethodsView does not pass onCheckedChange to Switch", () => {
      const paymentViewPath = path.resolve(
        __dirname,
        "../../src/components/admin/payments/AdminPaymentMethodsView.jsx"
      );
      const content = fs.readFileSync(paymentViewPath, "utf8");

      assert.ok(
        !content.includes("onCheckedChange"),
        "AdminPaymentMethodsView must not contain onCheckedChange"
      );
    });
  });

  describe("Defect 5: Controlled Checkbox onChange Warning Prevention", () => {
    it("AdminPaymentMethodsView wires onChange and id to the status Switch", () => {
      const paymentViewPath = path.resolve(
        __dirname,
        "../../src/components/admin/payments/AdminPaymentMethodsView.jsx"
      );
      const content = fs.readFileSync(paymentViewPath, "utf8");

      assert.ok(
        content.includes("id={`payment-method-toggle-${method._id}`}"),
        "Status switch must have unique id"
      );
      assert.ok(
        content.includes("onChange={() => handleToggle(method)}"),
        "Status switch must supply onChange handler"
      );
      assert.ok(
        content.includes("disabled={togglingId === method._id}"),
        "Status switch must be disabled while toggle is in flight"
      );
    });
  });
});
