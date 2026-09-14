import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { tokenManager } from "../../src/lib/auth/token-manager.js";

describe("Token Manager Unit Tests", () => {
  beforeEach(() => {
    tokenManager.clearAccessToken();
  });

  test("initial access token is null", () => {
    assert.equal(tokenManager.getAccessToken(), null);
    assert.equal(tokenManager.hasAccessToken(), false);
  });

  test("stores and retrieves access token in memory", () => {
    const sampleToken = "jwt.header.payload.signature";
    tokenManager.setAccessToken(sampleToken);

    assert.equal(tokenManager.getAccessToken(), sampleToken);
    assert.equal(tokenManager.hasAccessToken(), true);
  });

  test("clears access token cleanly", () => {
    tokenManager.setAccessToken("active-token");
    assert.equal(tokenManager.hasAccessToken(), true);

    tokenManager.clearAccessToken();
    assert.equal(tokenManager.getAccessToken(), null);
    assert.equal(tokenManager.hasAccessToken(), false);
  });

  test("subscribers receive updates on token change and clear", () => {
    const receivedTokens = [];
    const unsubscribe = tokenManager.subscribe((token) => {
      receivedTokens.push(token);
    });

    tokenManager.setAccessToken("token-1");
    tokenManager.setAccessToken("token-2");
    tokenManager.clearAccessToken();

    assert.deepEqual(receivedTokens, ["token-1", "token-2", null]);

    unsubscribe();
    tokenManager.setAccessToken("token-3");
    // Should not receive token-3 after unsubscribing
    assert.deepEqual(receivedTokens, ["token-1", "token-2", null]);
  });
});
