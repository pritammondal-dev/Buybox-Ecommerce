const crypto = require("crypto");
const { Readable } = require("stream");
const AppError = require("../../errors/AppError");

/**
 * RFC 3986 URI encoding helper
 */
function rfc3986Encode(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/**
 * Encode URI path segments while preserving slashes
 */
function encodeUriPath(uriPath) {
  return uriPath
    .split("/")
    .map((seg) => rfc3986Encode(seg))
    .join("/");
}

/**
 * Compute SHA256 hex digest
 */
function sha256Hex(data) {
  return crypto.createHash("sha256").update(data || "").digest("hex");
}

/**
 * Compute HMAC-SHA256
 */
function hmacSha256(key, data) {
  return crypto.createHmac("sha256", key).update(data).digest();
}

/**
 * Native Node.js S3-compatible Client with AWS Signature Version 4 (SigV4).
 * Works across AWS S3, Cloudflare R2, MinIO, Wasabi, and LocalStack without external SDKs.
 */
class S3Client {
  constructor(config = {}) {
    this.bucket = config.bucket || "";
    this.region = config.region || "us-east-1";
    this.endpoint = config.endpoint ? config.endpoint.replace(/\/$/, "") : "";
    this.accessKeyId = config.accessKeyId || "";
    this.secretAccessKey = config.secretAccessKey || "";
    this.forcePathStyle = Boolean(config.forcePathStyle);
    this.timeoutMs = config.timeoutMs || 15000;
  }

  /**
   * Validate that mandatory credentials and bucket are present
   */
  validateConfig() {
    if (!this.bucket) {
      throw new AppError("S3 storage configuration missing: S3_BUCKET is required", 500, "S3_CONFIG_ERROR");
    }
    if (!this.accessKeyId) {
      throw new AppError("S3 storage configuration missing: S3_ACCESS_KEY_ID is required", 500, "S3_CONFIG_ERROR");
    }
    if (!this.secretAccessKey) {
      throw new AppError("S3 storage configuration missing: S3_SECRET_ACCESS_KEY is required", 500, "S3_CONFIG_ERROR");
    }
  }

  /**
   * Derive AWS SigV4 signing key
   */
  getSigningKey(dateStamp) {
    const kDate = hmacSha256(`AWS4${this.secretAccessKey}`, dateStamp);
    const kRegion = hmacSha256(kDate, this.region);
    const kService = hmacSha256(kRegion, "s3");
    return hmacSha256(kService, "aws4_request");
  }

  /**
   * Resolve host and path for a given S3 key
   */
  resolveUrl(key = "") {
    const cleanKey = key.replace(/^\/+/, "");

    if (this.endpoint) {
      const endpointUrl = new URL(this.endpoint);
      const host = endpointUrl.host;
      const protocol = endpointUrl.protocol; // e.g. "https:"

      if (this.forcePathStyle) {
        const path = `/${this.bucket}/${cleanKey}`;
        return {
          protocol,
          host,
          path,
          url: `${protocol}//${host}${path}`,
        };
      }

      // If endpoint is already bucket-qualified (e.g. Cloudflare R2 or custom domain)
      if (host.startsWith(`${this.bucket}.`)) {
        const path = `/${cleanKey}`;
        return {
          protocol,
          host,
          path,
          url: `${protocol}//${host}${path}`,
        };
      }

      // Default path-style for custom endpoints unless subdomains are configured
      const path = `/${this.bucket}/${cleanKey}`;
      return {
        protocol,
        host,
        path,
        url: `${protocol}//${host}${path}`,
      };
    }

    // Standard AWS S3 endpoint
    if (this.forcePathStyle) {
      const host = this.region === "us-east-1" ? "s3.amazonaws.com" : `s3.${this.region}.amazonaws.com`;
      const path = `/${this.bucket}/${cleanKey}`;
      return {
        protocol: "https:",
        host,
        path,
        url: `https://${host}${path}`,
      };
    }

    // Virtual-hosted style: bucket.s3.region.amazonaws.com
    const host =
      this.region === "us-east-1"
        ? `${this.bucket}.s3.amazonaws.com`
        : `${this.bucket}.s3.${this.region}.amazonaws.com`;
    const path = `/${cleanKey}`;
    return {
      protocol: "https:",
      host,
      path,
      url: `https://${host}${path}`,
    };
  }

  /**
   * Build SigV4 signed headers
   */
  signRequest({ method, urlInfo, headers = {}, payloadHash }) {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.substring(0, 8);

    const host = urlInfo.host;
    const allHeaders = {
      host,
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
      ...headers,
    };

    // Sort lowercase headers
    const sortedHeaderKeys = Object.keys(allHeaders)
      .map((k) => k.toLowerCase())
      .sort();

    let canonicalHeaders = "";
    for (const key of sortedHeaderKeys) {
      const origKey = Object.keys(allHeaders).find((k) => k.toLowerCase() === key);
      const val = String(allHeaders[origKey]).trim().replace(/\s+/g, " ");
      canonicalHeaders += `${key}:${val}\n`;
    }
    const signedHeaders = sortedHeaderKeys.join(";");

    const canonicalUri = encodeUriPath(urlInfo.path);
    const canonicalQuery = "";

    const canonicalRequest = [
      method.toUpperCase(),
      canonicalUri,
      canonicalQuery,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join("\n");

    const signingKey = this.getSigningKey(dateStamp);
    const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");

    const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      ...allHeaders,
      authorization: authorizationHeader,
    };
  }

  /**
   * Upload object (PutObject)
   */
  async putObject({ key, body, contentType = "application/octet-stream", isPrivate = false, metadata = {} }) {
    this.validateConfig();

    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
    const payloadHash = sha256Hex(buffer);
    const urlInfo = this.resolveUrl(key);

    const headers = {
      "content-type": contentType,
      "content-length": String(buffer.length),
    };

    if (isPrivate) {
      headers["x-amz-acl"] = "private";
    }

    // Add metadata headers
    for (const [mKey, mVal] of Object.entries(metadata)) {
      headers[`x-amz-meta-${mKey.toLowerCase()}`] = String(mVal);
    }

    const signedHeaders = this.signRequest({
      method: "PUT",
      urlInfo,
      headers,
      payloadHash,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(urlInfo.url, {
        method: "PUT",
        headers: signedHeaders,
        body: buffer,
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        throw new AppError(
          `S3 PutObject failed (${res.status}): ${res.statusText}. Response: ${errorText.substring(0, 200)}`,
          502,
          "S3_UPLOAD_FAILED"
        );
      }

      return {
        key: key.replace(/^\/+/, ""),
        etag: res.headers.get("etag") || "",
        size: buffer.length,
        contentType,
        url: urlInfo.url,
      };
    } catch (err) {
      if (err.name === "AbortError") {
        throw new AppError(`S3 PutObject timed out after ${this.timeoutMs}ms`, 504, "S3_TIMEOUT");
      }
      if (err instanceof AppError) throw err;
      throw new AppError(`S3 PutObject network error: ${err.message}`, 502, "S3_NETWORK_ERROR");
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Check object existence and metadata (HeadObject)
   */
  async headObject({ key }) {
    this.validateConfig();

    const urlInfo = this.resolveUrl(key);
    const payloadHash = sha256Hex("");

    const signedHeaders = this.signRequest({
      method: "HEAD",
      urlInfo,
      headers: {},
      payloadHash,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(urlInfo.url, {
        method: "HEAD",
        headers: signedHeaders,
        signal: controller.signal,
      });

      if (res.status === 404 || res.status === 403) {
        return { exists: false };
      }

      if (!res.ok) {
        throw new AppError(`S3 HeadObject failed with status ${res.status}`, 502, "S3_HEAD_FAILED");
      }

      return {
        exists: true,
        size: parseInt(res.headers.get("content-length") || "0", 10),
        contentType: res.headers.get("content-type") || "application/octet-stream",
        etag: res.headers.get("etag") || "",
        lastModified: res.headers.get("last-modified") || null,
      };
    } catch (err) {
      if (err.name === "AbortError") {
        throw new AppError(`S3 HeadObject timed out after ${this.timeoutMs}ms`, 504, "S3_TIMEOUT");
      }
      if (err instanceof AppError) throw err;
      throw new AppError(`S3 HeadObject network error: ${err.message}`, 502, "S3_NETWORK_ERROR");
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Get object as a readable stream (GetObject)
   */
  async getObjectStream({ key }) {
    this.validateConfig();

    const urlInfo = this.resolveUrl(key);
    const payloadHash = sha256Hex("");

    const signedHeaders = this.signRequest({
      method: "GET",
      urlInfo,
      headers: {},
      payloadHash,
    });

    const res = await fetch(urlInfo.url, {
      method: "GET",
      headers: signedHeaders,
    });

    if (res.status === 404) {
      throw new AppError(`S3 object not found: ${key}`, 404, "S3_OBJECT_NOT_FOUND");
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new AppError(
        `S3 GetObject failed (${res.status}): ${res.statusText}. ${errText.substring(0, 150)}`,
        502,
        "S3_GET_FAILED"
      );
    }

    const stream = Readable.fromWeb(res.body);
    const size = parseInt(res.headers.get("content-length") || "0", 10);
    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const etag = res.headers.get("etag") || "";

    return {
      stream,
      size,
      contentType,
      etag,
    };
  }

  /**
   * Delete object (DeleteObject)
   */
  async deleteObject({ key }) {
    this.validateConfig();

    const urlInfo = this.resolveUrl(key);
    const payloadHash = sha256Hex("");

    const signedHeaders = this.signRequest({
      method: "DELETE",
      urlInfo,
      headers: {},
      payloadHash,
    });

    try {
      const res = await fetch(urlInfo.url, {
        method: "DELETE",
        headers: signedHeaders,
      });

      // S3 returns 204 No Content for successful deletion
      return res.status === 204 || res.status === 200;
    } catch (err) {
      throw new AppError(`S3 DeleteObject failed: ${err.message}`, 502, "S3_DELETE_FAILED");
    }
  }

  /**
   * Generate short-lived presigned URL for private downloads
   */
  getSignedUrl({ key, expiresInSeconds = 300, method = "GET" }) {
    this.validateConfig();

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.substring(0, 8);
    const urlInfo = this.resolveUrl(key);

    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const host = urlInfo.host;

    // Presigned query params
    const queryParams = {
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": `${this.accessKeyId}/${credentialScope}`,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": String(expiresInSeconds),
      "X-Amz-SignedHeaders": "host",
    };

    // Sort query parameters
    const sortedParamKeys = Object.keys(queryParams).sort();
    const canonicalQuery = sortedParamKeys
      .map((k) => `${rfc3986Encode(k)}=${rfc3986Encode(queryParams[k])}`)
      .join("&");

    const canonicalHeaders = `host:${host}\n`;
    const signedHeaders = "host";
    const payloadHash = "UNSIGNED-PAYLOAD";

    const canonicalRequest = [
      method.toUpperCase(),
      encodeUriPath(urlInfo.path),
      canonicalQuery,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join("\n");

    const signingKey = this.getSigningKey(dateStamp);
    const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");

    return `${urlInfo.url}?${canonicalQuery}&X-Amz-Signature=${signature}`;
  }
}

module.exports = S3Client;
