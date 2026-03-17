/**
 * Unit tests for ProtocolManager
 */

import { describe, it, expect } from "vitest";
import { ProtocolManager, CURRENT_VERSION } from "./ProtocolManager";
import type { SocketMessage } from "@talos/types";

describe("ProtocolManager", () => {
  describe("constructor", () => {
    it("should initialize with default options", () => {
      const manager = new ProtocolManager();
      expect(manager["defaultVersion"]).toBe(CURRENT_VERSION);
      expect(manager["supportedVersions"]).toEqual([CURRENT_VERSION]);
    });

    it("should initialize with custom options", () => {
      const manager = new ProtocolManager({
        supportedVersions: ["1.0", "2.0"],
        defaultVersion: "2.0",
      });
      expect(manager["defaultVersion"]).toBe("2.0");
      expect(manager["supportedVersions"]).toEqual(["1.0", "2.0"]);
    });

    it("should throw error if default version is not supported", () => {
      expect(
        () =>
          new ProtocolManager({
            supportedVersions: ["1.0"],
            defaultVersion: "2.0",
          })
      ).toThrow("Default version 2.0 is not in supported versions");
    });
  });

  describe("negotiateVersion", () => {
    it("should return default version if client version is not specified", () => {
      const manager = new ProtocolManager({ defaultVersion: "1.0" });
      expect(manager.negotiateVersion()).toBe("1.0");
    });

    it("should return client version if supported", () => {
      const manager = new ProtocolManager({
        supportedVersions: ["1.0", "2.0"],
        defaultVersion: "1.0",
      });
      expect(manager.negotiateVersion("2.0")).toBe("2.0");
    });

    it("should throw error if client version is not supported", () => {
      const manager = new ProtocolManager({
        supportedVersions: ["1.0", "2.0"],
        defaultVersion: "1.0",
      });
      expect(() => manager.negotiateVersion("3.0")).toThrow(
        "Unsupported protocol version: 3.0. Supported versions: 1.0, 2.0"
      );
    });
  });

  describe("transformMessage", () => {
    it("should return same message if target version is current", () => {
      const manager = new ProtocolManager();
      const message: SocketMessage = {
        version: "1.0",
        type: "request",
        payload: { action: "test" },
        id: "msg-123",
      };

      const transformed = manager.transformMessage(message, "1.0");
      expect(transformed).toEqual(message);
    });

    it("should update version field for different target version", () => {
      const manager = new ProtocolManager({
        supportedVersions: ["1.0", "2.0"],
      });
      const message: SocketMessage = {
        version: "1.0",
        type: "request",
        payload: { action: "test" },
        id: "msg-123",
      };

      const transformed = manager.transformMessage(message, "2.0");
      expect(transformed.version).toBe("2.0");
      expect(transformed.type).toBe(message.type);
      expect(transformed.payload).toEqual(message.payload);
      expect(transformed.id).toBe(message.id);
    });
  });

  describe("createRequest", () => {
    it("should create request message with default version", () => {
      const manager = new ProtocolManager();
      const message = manager.createRequest("test_action", { data: "test" });

      expect(message.version).toBe(CURRENT_VERSION);
      expect(message.type).toBe("test_action");
      expect(message.payload).toEqual({ data: "test" });
      expect(message.id).toBeDefined();
      expect(typeof message.id).toBe("string");
    });

    it("should create request message with custom version", () => {
      const manager = new ProtocolManager();
      const message = manager.createRequest(
        "test_action",
        { data: "test" },
        "2.0"
      );

      expect(message.version).toBe("2.0");
      expect(message.type).toBe("test_action");
    });

    it("should generate unique message IDs", () => {
      const manager = new ProtocolManager();
      const msg1 = manager.createRequest("action1", {});
      const msg2 = manager.createRequest("action2", {});

      expect(msg1.id).not.toBe(msg2.id);
    });
  });

  describe("createResponse", () => {
    it("should create response message with success", () => {
      const manager = new ProtocolManager();
      const request: SocketMessage = {
        version: "1.0",
        type: "request",
        payload: { action: "test" },
        id: "req-123",
      };

      const response = manager.createResponse(request, { result: "ok" });

      expect(response.version).toBe(request.version);
      expect(response.type).toBe("response");
      expect(response.payload).toEqual({
        success: true,
        result: "ok",
      });
      expect(response.id).toBe(request.id);
    });

    it("should create response message with failure", () => {
      const manager = new ProtocolManager();
      const request: SocketMessage = {
        version: "1.0",
        type: "request",
        payload: { action: "test" },
        id: "req-123",
      };

      const response = manager.createResponse(
        request,
        { error: "failed" },
        false
      );

      expect(response.payload).toEqual({
        success: false,
        error: "failed",
      });
    });

    it("should copy id from original message", () => {
      const manager = new ProtocolManager();
      const request: SocketMessage = {
        version: "1.0",
        type: "request",
        payload: {},
        id: "test-id-456",
      };

      const response = manager.createResponse(request, {});
      expect(response.id).toBe("test-id-456");
    });
  });

  describe("isVersionSupported", () => {
    it("should return true for supported versions", () => {
      const manager = new ProtocolManager({
        supportedVersions: ["1.0", "2.0"],
      });

      expect(manager.isVersionSupported("1.0")).toBe(true);
      expect(manager.isVersionSupported("2.0")).toBe(true);
    });

    it("should return false for unsupported versions", () => {
      const manager = new ProtocolManager({
        supportedVersions: ["1.0", "2.0"],
      });

      expect(manager.isVersionSupported("3.0")).toBe(false);
      expect(manager.isVersionSupported("0.9")).toBe(false);
    });
  });
});
