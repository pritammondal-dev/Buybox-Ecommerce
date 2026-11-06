const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../src/app");
const storageService = require("../src/services/storage");
const LocalStorageProvider = require("../src/services/storage/local-storage.provider");
const S3StorageProvider = require("../src/services/storage/s3-storage.provider");
const S3Client = require("../src/services/storage/s3-client");
const digitalStorageService = require("../src/services/digital-storage.service");
const digitalEntitlementService = require("../src/services/digital-entitlement.service");
const { validateImageReference } = require("../src/utils/image-validator.util");
const { runMigration } = require("../scripts/migrate-media-to-s3");
const User = require("../src/models/User");
const Customer = require("../src/models/Customer");
const DigitalEntitlement = require("../src/models/DigitalEntitlement");
const { generateAccessToken } = require("../src/services/token.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace(/\/buybox(_test)?(\?|$)/, "/buybox_phase_e12a_test$2")
  : "mongodb://127.0.0.1:27017/buybox_phase_e12a_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Phase E12A — Persistent Object Storage Migration & Security Test Suite", () => {
  let createdFiles = [];
  let testCustomer, testCustomerToken, testAdmin, testAdminToken;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    // Create test user and tokens
    testCustomer = await User.create({
      firstName: "Storage",
      lastName: "Tester",
      email: `storage_test_${Date.now()}@buybox.test`,
      passwordHash: "dummyHash123",
      role: "customer",
      isEmailVerified: true,
      status: "active",
    });

    testCustomerProfile = await Customer.create({
      userId: testCustomer._id,
      email: testCustomer.email,
      firstName: testCustomer.firstName,
      lastName: testCustomer.lastName,
    });

    testAdmin = await User.create({
      firstName: "Admin",
      lastName: "Storage",
      email: `admin_storage_${Date.now()}@buybox.test`,
      passwordHash: "dummyHash123",
      role: "admin",
      isEmailVerified: true,
      status: "active",
    });

    testCustomerToken = generateAccessToken({ id: testCustomer._id, role: "customer" });
    testAdminToken = generateAccessToken({ id: testAdmin._id, role: "admin" });
  });

  afterAll(async () => {
    // Cleanup any temporary test files
    for (const f of createdFiles) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {}
    }
    // Restore default provider
    storageService.resetProvider();
    process.env.MEDIA_STORAGE_PROVIDER = "local";

    await User.deleteMany({ email: { $regex: /storage_test|admin_storage/ } });
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  // ============================================================================
  // 1. LOCAL STORAGE PROVIDER TESTS
  // ============================================================================
  describe("1. LocalStorageProvider Implementation", () => {
    const provider = new LocalStorageProvider();

    it("should successfully save public media and return correct delivery metadata", async () => {
      const buffer = Buffer.from("test-image-content-12345");
      const filename = `test_local_${Date.now()}.png`;

      const result = await provider.savePublicMedia({
        filename,
        buffer,
        mimeType: "image/png",
        prefix: "uploads",
      });

      expect(result.storageProvider).toBe("local");
      expect(result.url).toBe(`/uploads/${filename}`);
      expect(result.key).toBe(`uploads/${filename}`);
      expect(result.size).toBe(buffer.length);
      expect(result.filename).toBe(filename);

      // Verify file written to backend/public/uploads
      const backendUploadPath = path.resolve(__dirname, "../public/uploads", filename);
      expect(fs.existsSync(backendUploadPath)).toBe(true);
      createdFiles.push(backendUploadPath);

      // Verify assetExists
      const exists = await provider.assetExists(filename, false);
      expect(exists).toBe(true);

      // Verify deletion
      const deleted = await provider.deletePublicMedia(filename);
      expect(deleted).toBe(true);
      expect(fs.existsSync(backendUploadPath)).toBe(false);
    });

    it("should safely save private digital assets with checksum", async () => {
      const buffer = Buffer.from("sample-ebook-content-binary");
      const filename = `test_digital_${Date.now()}.pdf`;
      const expectedChecksum = crypto.createHash("sha256").update(buffer).digest("hex");

      const result = await provider.saveDigitalAsset({
        filename,
        buffer,
        mimeType: "application/pdf",
        metadata: { name: "Sample EBook", version: "2.0" },
      });

      expect(result.storageProvider).toBe("local");
      expect(result.storageKey).toBe(filename);
      expect(result.fileSize).toBe(buffer.length);
      expect(result.checksum).toBe(expectedChecksum);
      expect(result.version).toBe("2.0");

      const digitalPath = path.resolve(__dirname, "../storage/digital-assets", filename);
      expect(fs.existsSync(digitalPath)).toBe(true);
      createdFiles.push(digitalPath);

      // Verify stream reading
      const streamResult = await provider.getDigitalAssetStream(filename);
      expect(streamResult.size).toBe(buffer.length);
      expect(streamResult.stream).toBeDefined();

      // Collect stream data
      const chunks = [];
      for await (const chunk of streamResult.stream) {
        chunks.push(chunk);
      }
      expect(Buffer.concat(chunks).toString()).toBe("sample-ebook-content-binary");

      // Verify signed URL returns null for local provider (streaming only)
      const signedUrl = await provider.getDigitalAssetSignedUrl(filename);
      expect(signedUrl).toBeNull();

      // Verify safe deletion
      const deleted = await provider.deleteDigitalAsset(filename);
      expect(deleted).toBe(true);
      expect(fs.existsSync(digitalPath)).toBe(false);
    });

    it("should prevent directory traversal attacks on public media and digital assets", async () => {
      expect(() => {
        provider.resolveDigitalPath("../../etc/passwd");
      }).toThrow(/Path traversal attempt detected/i);

      expect(() => {
        provider.resolveDigitalPath("..\\..\\windows\\system32");
      }).toThrow();

      expect(() => {
        provider.resolvePublicPath("../../secret.txt");
      }).toThrow(/Path traversal attempt detected/i);
    });
  });

  // ============================================================================
  // 2. S3 CLIENT & SIGV4 SIGNING TESTS
  // ============================================================================
  describe("2. S3Client & AWS SigV4 Request Construction", () => {
    it("should correctly resolve AWS virtual-hosted and path-style URLs", () => {
      const clientVirtual = new S3Client({
        bucket: "my-buybox-bucket",
        region: "ap-south-1",
        accessKeyId: "TEST_KEY",
        secretAccessKey: "TEST_SECRET",
        forcePathStyle: false,
      });

      const urlInfo1 = clientVirtual.resolveUrl("uploads/banner.jpg");
      expect(urlInfo1.url).toBe("https://my-buybox-bucket.s3.ap-south-1.amazonaws.com/uploads/banner.jpg");
      expect(urlInfo1.host).toBe("my-buybox-bucket.s3.ap-south-1.amazonaws.com");

      const clientPathStyle = new S3Client({
        bucket: "my-buybox-bucket",
        region: "ap-south-1",
        accessKeyId: "TEST_KEY",
        secretAccessKey: "TEST_SECRET",
        forcePathStyle: true,
      });

      const urlInfo2 = clientPathStyle.resolveUrl("uploads/banner.jpg");
      expect(urlInfo2.url).toBe("https://s3.ap-south-1.amazonaws.com/my-buybox-bucket/uploads/banner.jpg");
    });

    it("should support custom endpoints (Cloudflare R2, MinIO)", () => {
      const clientR2 = new S3Client({
        bucket: "my-r2-bucket",
        region: "auto",
        endpoint: "https://cf-account-id.r2.cloudflarestorage.com",
        accessKeyId: "TEST_KEY",
        secretAccessKey: "TEST_SECRET",
        forcePathStyle: true,
      });

      const urlInfo = clientR2.resolveUrl("digital-assets/software.zip");
      expect(urlInfo.url).toBe("https://cf-account-id.r2.cloudflarestorage.com/my-r2-bucket/digital-assets/software.zip");
    });

    it("should generate valid AWS SigV4 signed headers and authorization header", () => {
      const client = new S3Client({
        bucket: "buybox-test-bucket",
        region: "us-east-1",
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      });

      const urlInfo = client.resolveUrl("uploads/test.jpg");
      const signed = client.signRequest({
        method: "PUT",
        urlInfo,
        headers: { "content-type": "image/jpeg" },
        payloadHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      });

      expect(signed.authorization).toBeDefined();
      expect(signed.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE\/\d{8}\/us-east-1\/s3\/aws4_request/);
      expect(signed.authorization).toContain("SignedHeaders=");
      expect(signed.authorization).toContain("Signature=");
      expect(signed["x-amz-date"]).toBeDefined();
      expect(signed["x-amz-content-sha256"]).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    });

    it("should generate valid SigV4 presigned URLs for private downloads", () => {
      const client = new S3Client({
        bucket: "buybox-private-bucket",
        region: "us-east-1",
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      });

      const signedUrl = client.getSignedUrl({
        key: "digital-assets/secure_manual.pdf",
        expiresInSeconds: 600,
        method: "GET",
      });

      expect(signedUrl).toContain("https://buybox-private-bucket.s3.amazonaws.com/digital-assets/secure_manual.pdf?");
      expect(signedUrl).toContain("X-Amz-Algorithm=AWS4-HMAC-SHA256");
      expect(signedUrl).toContain("X-Amz-Credential=AKIAIOSFODNN7EXAMPLE");
      expect(signedUrl).toContain("X-Amz-Expires=600");
      expect(signedUrl).toContain("X-Amz-Signature=");
    });

    it("should fail with clear error when config is missing", () => {
      const badClient = new S3Client({ bucket: "" });
      expect(() => badClient.validateConfig()).toThrow(/S3_BUCKET is required/);
    });
  });

  // ============================================================================
  // 3. S3 STORAGE PROVIDER (MOCKED REST INTERFACE)
  // ============================================================================
  describe("3. S3StorageProvider Operations with Mocked REST API", () => {
    let mockS3Client;
    let s3Provider;

    beforeEach(() => {
      mockS3Client = {
        validateConfig: jest.fn(),
        putObject: jest.fn().mockResolvedValue({
          key: "uploads/product_test.jpg",
          etag: '"etag123"',
          size: 100,
          contentType: "image/jpeg",
          url: "https://buybox-bucket.s3.amazonaws.com/uploads/product_test.jpg",
        }),
        headObject: jest.fn().mockResolvedValue({
          exists: true,
          size: 100,
          contentType: "image/jpeg",
          etag: '"etag123"',
        }),
        getObjectStream: jest.fn().mockImplementation(() => {
          const { Readable } = require("stream");
          const s = new Readable();
          s.push("mock-s3-data");
          s.push(null);
          return Promise.resolve({
            stream: s,
            size: 12,
            contentType: "application/pdf",
            etag: '"etag456"',
          });
        }),
        deleteObject: jest.fn().mockResolvedValue(true),
        getSignedUrl: jest.fn().mockReturnValue("https://buybox-bucket.s3.amazonaws.com/digital-assets/file.pdf?X-Amz-Signature=mock123"),
      };

      s3Provider = new S3StorageProvider({
        bucket: "buybox-bucket",
        region: "us-east-1",
        accessKeyId: "mock-key",
        secretAccessKey: "mock-secret",
        publicBaseUrl: "https://cdn.buybox.com",
        s3Client: mockS3Client,
      });
    });

    it("should upload public media and return CDN URL", async () => {
      const buffer = Buffer.from("image-bytes");
      const result = await s3Provider.savePublicMedia({
        filename: "hero_banner.jpg",
        buffer,
        mimeType: "image/jpeg",
        prefix: "uploads",
      });

      expect(mockS3Client.putObject).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "uploads/hero_banner.jpg",
          contentType: "image/jpeg",
          isPrivate: false,
        })
      );

      expect(result.storageProvider).toBe("s3");
      expect(result.url).toBe("https://cdn.buybox.com/uploads/hero_banner.jpg");
      expect(result.key).toBe("uploads/hero_banner.jpg");
    });

    it("should upload private digital asset with private flag and metadata", async () => {
      const buffer = Buffer.from("asset-bytes");
      const result = await s3Provider.saveDigitalAsset({
        filename: "manual.pdf",
        buffer,
        mimeType: "application/pdf",
        metadata: { fileName: "manual.pdf", version: "1.0" },
      });

      expect(mockS3Client.putObject).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "digital-assets/manual.pdf",
          contentType: "application/pdf",
          isPrivate: true,
        })
      );

      expect(result.storageProvider).toBe("s3");
      expect(result.storageKey).toBe("digital-assets/manual.pdf");
      expect(result.checksum).toBe(crypto.createHash("sha256").update(buffer).digest("hex"));
    });

    it("should stream private digital assets from S3", async () => {
      const streamResult = await s3Provider.getDigitalAssetStream("digital-assets/manual.pdf");
      expect(mockS3Client.getObjectStream).toHaveBeenCalledWith({ key: "digital-assets/manual.pdf" });
      expect(streamResult.size).toBe(12);

      const chunks = [];
      for await (const chunk of streamResult.stream) {
        chunks.push(chunk);
      }
      expect(Buffer.concat(chunks).toString()).toBe("mock-s3-data");
    });

    it("should generate presigned download URL for private digital assets", async () => {
      const signedUrl = await s3Provider.getDigitalAssetSignedUrl("digital-assets/manual.pdf", { expiresIn: 300 });
      expect(mockS3Client.getSignedUrl).toHaveBeenCalledWith({
        key: "digital-assets/manual.pdf",
        expiresInSeconds: 300,
        method: "GET",
      });
      expect(signedUrl).toBe("https://buybox-bucket.s3.amazonaws.com/digital-assets/file.pdf?X-Amz-Signature=mock123");
    });

    it("should verify existence via headObject and delete via deleteObject", async () => {
      const exists = await s3Provider.assetExists("uploads/hero_banner.jpg");
      expect(mockS3Client.headObject).toHaveBeenCalledWith({ key: "uploads/hero_banner.jpg" });
      expect(exists).toBe(true);

      const deleted = await s3Provider.deletePublicMedia("uploads/hero_banner.jpg");
      expect(mockS3Client.deleteObject).toHaveBeenCalledWith({ key: "uploads/hero_banner.jpg" });
      expect(deleted).toBe(true);
    });
  });

  // ============================================================================
  // 4. STORAGE ABSTRACTION & FAIL-SAFE CONFIGURATION TESTS
  // ============================================================================
  describe("4. Storage Facade Provider Selection & Safety Guardrails", () => {
    beforeEach(() => {
      storageService.resetProvider();
    });

    afterEach(() => {
      storageService.resetProvider();
      process.env.MEDIA_STORAGE_PROVIDER = "local";
    });

    it("should default to LocalStorageProvider without requiring cloud credentials", () => {
      delete process.env.MEDIA_STORAGE_PROVIDER;
      delete process.env.S3_BUCKET;
      delete process.env.S3_ACCESS_KEY_ID;
      delete process.env.S3_SECRET_ACCESS_KEY;

      const provider = storageService.getActiveProvider();
      expect(provider.name).toBe("local");
      expect(storageService.getStorageProviderName()).toBe("local");
    });

    it("should fail safely with clear error if S3 provider is enabled without credentials", () => {
      process.env.MEDIA_STORAGE_PROVIDER = "s3";
      delete process.env.S3_BUCKET;
      delete process.env.S3_ACCESS_KEY_ID;
      delete process.env.S3_SECRET_ACCESS_KEY;

      expect(() => {
        storageService.getActiveProvider();
      }).toThrow(/Persistent S3 storage is enabled .* but failed initialization/i);
    });

    it("should never silently fall back to public local storage for protected digital assets when S3 fails", async () => {
      process.env.MEDIA_STORAGE_PROVIDER = "s3";
      delete process.env.S3_BUCKET;

      await expect(async () => {
        await storageService.uploadDigitalAsset({
          filename: "secret_file.pdf",
          buffer: Buffer.from("secret"),
          mimeType: "application/pdf",
        });
      }).rejects.toThrow();

      // Ensure no file was leaked into public uploads
      const leakedPublic = path.resolve(__dirname, "../public/uploads/secret_file.pdf");
      expect(fs.existsSync(leakedPublic)).toBe(false);
    });
  });

  // ============================================================================
  // 5. VALIDATION & SECURITY CHECKS (MAGIC BYTES, SVG, EXTENSIONS)
  // ============================================================================
  describe("5. Media Validation & Attack Surface Hardening", () => {
    it("should accept valid HTTPS URLs and local /uploads/ URLs", () => {
      const httpsRes = validateImageReference("https://cdn.buybox.com/uploads/product_123.jpg");
      expect(httpsRes.isValid).toBe(true);

      const localRes = validateImageReference("/uploads/product_123.png");
      expect(localRes.isValid).toBe(true);
    });

    it("should reject SVG files from catalog products to prevent stored XSS", () => {
      const svgRes = validateImageReference("/uploads/malicious.svg");
      expect(svgRes.isValid).toBe(false);
      expect(svgRes.error).toContain("SVG image format is not permitted");
    });

    it("should reject path traversal in image references", () => {
      const traversalRes = validateImageReference("/uploads/../../etc/passwd.jpg");
      expect(traversalRes.isValid).toBe(false);
      expect(traversalRes.error).toContain("path traversal");
    });

    it("should reject storefront media upload exceeding 2MB", async () => {
      const largeBuffer = Buffer.alloc(2.5 * 1024 * 1024); // 2.5 MB
      const res = await request(app)
        .post("/api/v1/storefront/media/upload")
        .set("Authorization", `Bearer ${testAdminToken}`)
        .attach("file", largeBuffer, "oversize.png");

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("exceeds 2MB");
    });

    it("should reject storefront media upload with corrupt magic bytes (renamed exe)", async () => {
      const fakePngBuffer = Buffer.from("MZThisIsAnExecutableFileNotAPNG");
      const res = await request(app)
        .post("/api/v1/storefront/media/upload")
        .set("Authorization", `Bearer ${testAdminToken}`)
        .attach("file", fakePngBuffer, "fake.png");

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("File signature does not match expected image format");
    });

    it("should reject SVG upload in storefront media with explicit SVG_NOT_ALLOWED code", async () => {
      const svgBuffer = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>");
      const res = await request(app)
        .post("/api/v1/storefront/media/upload")
        .set("Authorization", `Bearer ${testAdminToken}`)
        .attach("file", svgBuffer, "icon.svg");

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("SVG_NOT_ALLOWED");
    });
  });

  // ============================================================================
  // 6. DIGITAL DOWNLOAD ENTITLEMENT PROTECTION
  // ============================================================================
  describe("6. Digital Download Entitlement Protection & Authorization", () => {
    let activeEntitlement, expiredEntitlement, revokedEntitlement;
    const testAssetKey = `dgt_test_${Date.now()}.pdf`;

    beforeAll(async () => {
      // Save physical file locally
      const assetPath = path.resolve(__dirname, "../storage/digital-assets", testAssetKey);
      fs.writeFileSync(assetPath, Buffer.from("Entitlement-protected binary payload"));
      createdFiles.push(assetPath);

      // Create Active Entitlement
      activeEntitlement = await DigitalEntitlement.create({
        customerId: testCustomerProfile._id,
        userId: testCustomer._id,
        orderId: new mongoose.Types.ObjectId(),
        orderNumber: "ORD-STORAGE-001",
        productId: new mongoose.Types.ObjectId(),
        productName: "E-Commerce Architecture Guide",
        asset: {
          id: "asset_test_1",
          name: "architecture_guide",
          fileName: "architecture_guide.pdf",
          storageKey: testAssetKey,
          fileSize: 36,
          mimeType: "application/pdf",
        },
        downloadLimit: 5,
        downloadCount: 0,
        status: "active",
      });

      // Create Expired Entitlement
      expiredEntitlement = await DigitalEntitlement.create({
        customerId: testCustomerProfile._id,
        userId: testCustomer._id,
        orderId: new mongoose.Types.ObjectId(),
        orderNumber: "ORD-STORAGE-002",
        productId: new mongoose.Types.ObjectId(),
        productName: "Expired Guide",
        asset: {
          id: "asset_test_2",
          name: "expired_guide",
          fileName: "expired_guide.pdf",
          storageKey: testAssetKey,
          fileSize: 36,
          mimeType: "application/pdf",
        },
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
        status: "expired",
      });

      // Create Revoked Entitlement
      revokedEntitlement = await DigitalEntitlement.create({
        customerId: testCustomerProfile._id,
        userId: testCustomer._id,
        orderId: new mongoose.Types.ObjectId(),
        orderNumber: "ORD-STORAGE-003",
        productId: new mongoose.Types.ObjectId(),
        productName: "Revoked Guide",
        asset: {
          id: "asset_test_3",
          name: "revoked_guide",
          fileName: "revoked_guide.pdf",
          storageKey: testAssetKey,
          fileSize: 36,
          mimeType: "application/pdf",
        },
        status: "revoked",
        revocationReason: "Order refunded",
      });
    });

    afterAll(async () => {
      await DigitalEntitlement.deleteMany({
        _id: { $in: [activeEntitlement?._id, expiredEntitlement?._id, revokedEntitlement?._id] },
      });
    });

    it("should stream download to authorized customer and increment download count", async () => {
      const res = await request(app)
        .get(`/api/v1/digital-downloads/${activeEntitlement._id}`)
        .set("Authorization", `Bearer ${testCustomerToken}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("application/pdf");
      const bodyText = res.text || (Buffer.isBuffer(res.body) ? res.body.toString("utf8") : "");
      expect(bodyText).toBe("Entitlement-protected binary payload");

      // Verify download count incremented
      const updated = await DigitalEntitlement.findById(activeEntitlement._id);
      expect(updated.downloadCount).toBe(1);
      expect(updated.downloadLogs.length).toBe(1);
    });

    it("should reject unauthorized users with 403 Forbidden", async () => {
      const otherUser = await User.create({
        firstName: "Intruder",
        lastName: "User",
        email: `intruder_${Date.now()}@buybox.test`,
        passwordHash: "hash",
        role: "customer",
        status: "active",
      });
      const intruderToken = generateAccessToken({ id: otherUser._id, role: "customer" });

      const res = await request(app)
        .get(`/api/v1/digital-downloads/${activeEntitlement._id}`)
        .set("Authorization", `Bearer ${intruderToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("not authorized");

      await User.deleteOne({ _id: otherUser._id });
    });

    it("should reject expired downloads with 410 Gone", async () => {
      const res = await request(app)
        .get(`/api/v1/digital-downloads/${expiredEntitlement._id}`)
        .set("Authorization", `Bearer ${testCustomerToken}`);

      expect(res.status).toBe(410);
      expect(res.body.code).toBe("ENTITLEMENT_EXPIRED");
    });

    it("should reject revoked downloads with 403 Forbidden", async () => {
      const res = await request(app)
        .get(`/api/v1/digital-downloads/${revokedEntitlement._id}`)
        .set("Authorization", `Bearer ${testCustomerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("ENTITLEMENT_REVOKED");
    });

    it("should reject guessed or non-existent entitlement IDs with 404", async () => {
      const randomObjectId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/v1/digital-downloads/${randomObjectId}`)
        .set("Authorization", `Bearer ${testCustomerToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ============================================================================
  // 7. MIGRATION SCRIPT TESTS
  // ============================================================================
  describe("7. Safe Migration Tooling (Dry-Run & Verification)", () => {
    it("should run programmatic dry-run migration without modifying files or database", async () => {
      const { inventoryReport, migrationResults, reportPath } = await runMigration();

      expect(migrationResults.mode).toBe("dry-run");
      expect(Array.isArray(inventoryReport.referenced)).toBe(true);
      expect(Array.isArray(inventoryReport.orphans)).toBe(true);
      expect(migrationResults.dbUpdatesCount).toBe(0);
      expect(fs.existsSync(reportPath)).toBe(true);

      const savedJson = JSON.parse(fs.readFileSync(reportPath, "utf8"));
      expect(savedJson.results.mode).toBe("dry-run");
    });
  });
});
