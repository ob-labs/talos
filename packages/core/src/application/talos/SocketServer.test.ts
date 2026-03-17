/**
 * SocketServer Unit Tests
 *
 * Tests protocol version negotiation and message handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SocketServer } from "./SocketServer";
import { ProtocolManager } from "../../infrastructure/communication/socket/ProtocolManager";
import { StorageManager } from "../../storage";
import { Logger } from "../../logger";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

describe("SocketServer", () => {
  let socketServer: SocketServer;
  let protocolManager: ProtocolManager;
  let storageManager: any;
  let logger: any;
  let tempDir: string;
  let socketPath: string;

  beforeEach(() => {
    // Create temporary directory for socket file
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "socket-test-"));
    socketPath = path.join(tempDir, "test.sock");

    // Create mock dependencies
    storageManager = {
      findTaskByProcessId: vi.fn(),
      getProjectTasks: vi.fn(),
      deleteProjectTask: vi.fn(),
    };

    logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      audit: vi.fn(),
    };

    protocolManager = new ProtocolManager();

    // Create SocketServer instance
    socketServer = new SocketServer({
      taskLifecycleManager: {} as any,
      taskRepository: storageManager,
      storageManager,
      uiManager: {} as any,
      protocolManager,
      logger,
      socketPath,
      basePath: tempDir,
    });
  });

  afterEach(async () => {
    try {
      await socketServer.stop();
    } catch (error) {
      // Ignore errors during cleanup
    }
    // Clean up temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("protocol version negotiation", () => {
    it("should accept requests without version field (backward compatibility)", () => {
      const version = protocolManager.negotiateVersion(undefined);
      expect(version).toBe("1.0");
    });

    it("should accept requests with supported version", () => {
      const version = protocolManager.negotiateVersion("1.0");
      expect(version).toBe("1.0");
    });

    it("should reject requests with unsupported version", () => {
      expect(() => {
        protocolManager.negotiateVersion("2.0");
      }).toThrow("Unsupported protocol version: 2.0");
    });

    it("should check if version is supported", () => {
      expect(protocolManager.isVersionSupported("1.0")).toBe(true);
      expect(protocolManager.isVersionSupported("2.0")).toBe(false);
    });
  });

  describe("server lifecycle", () => {
    it("should start and stop the server", async () => {
      await socketServer.start();
      expect(socketServer.isActive()).toBe(true);

      await socketServer.stop();
      expect(socketServer.isActive()).toBe(false);
    });

    it("should be idempotent when starting multiple times", async () => {
      await socketServer.start();
      await socketServer.start(); // Should not throw
      expect(socketServer.isActive()).toBe(true);
    });

    it("should be idempotent when stopping multiple times", async () => {
      await socketServer.start();
      await socketServer.stop();
      await socketServer.stop(); // Should not throw
      expect(socketServer.isActive()).toBe(false);
    });
  });

  describe("response format", () => {
    it("should create responses with version field", () => {
      const originalMessage = {
        version: "1.0",
        type: "request",
        payload: { action: "ping" },
        id: "test-id",
      };

      const response = protocolManager.createResponse(
        originalMessage,
        { message: "pong" },
        true
      );

      expect(response.version).toBe("1.0");
      expect(response.type).toBe("response");
      expect(response.payload).toEqual({
        success: true,
        message: "pong",
      });
      expect(response.id).toBe("test-id");
    });

    it("should create error responses", () => {
      const originalMessage = {
        version: "1.0",
        type: "request",
        payload: { action: "invalid" },
        id: "test-id",
      };

      const response = protocolManager.createResponse(
        originalMessage,
        { error: "Invalid action" },
        false
      );

      expect(response.payload).toEqual({
        success: false,
        error: "Invalid action",
      });
    });
  });

  describe("message ID generation", () => {
    it("should generate unique message IDs", () => {
      const request1 = protocolManager.createRequest("ping", {});
      const request2 = protocolManager.createRequest("ping", {});

      expect(request1.id).toBeDefined();
      expect(request2.id).toBeDefined();
      expect(request1.id).not.toBe(request2.id);
    });

    it("should generate message IDs with timestamp prefix", () => {
      const request = protocolManager.createRequest("ping", {});
      const id = request.id!;

      // ID should be in format: {timestamp}-{random}
      expect(id).toMatch(/^\d+-[a-z0-9]+$/);
    });
  });
});
