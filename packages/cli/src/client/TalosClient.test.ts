/**
 * Talos Client Unit Tests
 *
 * Tests communication logic with mocked Socket connections.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Server as NetServer, Socket } from "net";
import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";

import { TalosClient } from "./TalosClient";
import type { ILogger, ITask } from "@talos/types";

describe("TalosClient", () => {
  let mockSocketPath: string;
  let mockServer: NetServer;
  let mockLogger: ILogger;

  beforeEach(async () => {
    // Create temporary socket path
    const tmpDir = path.join(os.tmpdir(), `talos-test-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });
    mockSocketPath = path.join(tmpDir, "test.sock");

    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      audit: vi.fn(),
      setLevel: vi.fn(),
      getLevel: vi.fn(() => "info"),
    };

    // Create mock server
    mockServer = new NetServer();
    await new Promise<void>((resolve) => {
      mockServer.listen(mockSocketPath, () => {
        resolve();
      });
    });
  });

  afterEach(async () => {
    // Close mock server
    await new Promise<void>((resolve) => {
      mockServer.close(() => {
        resolve();
      });
    });

    // Clean up socket file
    try {
      await fs.unlink(mockSocketPath);
    } catch {
      // Ignore
    }
  });

  describe("connect()", () => {
    it("should connect successfully when socket file exists and server responds", async () => {
      // Set up server handler to respond to ping
      mockServer.on("connection", (socket: Socket) => {
        socket.on("data", (data: Buffer) => {
          const message = JSON.parse(data.toString());
          if (message.payload?.action === "ping") {
            const response = JSON.stringify({
              version: "1.0",
              type: "response",
              payload: { success: true, data: { message: "pong" } },
            });
            socket.write(response + "\n");
          }
        });
      });

      const client = new TalosClient({
        socketPath: mockSocketPath,
        logger: mockLogger,
      });

      await expect(client.connect()).resolves.not.toThrow();
      expect(client.isConnected()).toBe(true);
    });

    it("should throw error when socket file does not exist", async () => {
      const client = new TalosClient({
        socketPath: "/nonexistent/path/talos.sock",
        logger: mockLogger,
      });

      await expect(client.connect()).rejects.toThrow("socket file not found");
    });

    it("should throw error when server does not respond", async () => {
      // Server that doesn't respond
      mockServer.on("connection", (_socket: Socket) => {
        // Do nothing
      });

      const client = new TalosClient({
        socketPath: mockSocketPath,
        logger: mockLogger,
        timeout: 1000, // Short timeout for test
      });

      await expect(client.connect()).rejects.toThrow("timeout");
    });
  });

  describe("disconnect()", () => {
    it("should disconnect and cancel subscriptions", async () => {
      // Set up server handler
      mockServer.on("connection", (socket: Socket) => {
        socket.on("data", (data: Buffer) => {
          const message = JSON.parse(data.toString());
          if (message.payload?.action === "ping") {
            const response = JSON.stringify({
              version: "1.0",
              type: "response",
              payload: { success: true, data: { message: "pong" } },
            });
            socket.write(response + "\n");
          }
        });
      });

      const client = new TalosClient({
        socketPath: mockSocketPath,
        logger: mockLogger,
      });

      await client.connect();
      client.subscribe("test_event", vi.fn());

      expect(client.isConnected()).toBe(true);

      await client.disconnect();

      expect(client.isConnected()).toBe(false);
    });
  });

  describe("startTask()", () => {
    it("should start task and return task data", async () => {
      const mockTask: ITask = {
        id: "task-123",
        status: "in_progress",
        workingDir: "/path/to/project",
        metadata: { prdId: "my-prd" },
      } as ITask;

      // Set up server handler
      mockServer.on("connection", (socket: Socket) => {
        socket.on("data", (data: Buffer) => {
          const message = JSON.parse(data.toString());
          if (message.payload?.action === "start_task") {
            const response = JSON.stringify({
              version: "1.0",
              type: "response",
              payload: { success: true, data: mockTask },
            });
            socket.write(response + "\n");
          } else if (message.payload?.action === "ping") {
            const response = JSON.stringify({
              version: "1.0",
              type: "response",
              payload: { success: true, data: { message: "pong" } },
            });
            socket.write(response + "\n");
          }
        });
      });

      const client = new TalosClient({
        socketPath: mockSocketPath,
        logger: mockLogger,
      });

      await client.connect();

      const result = await client.startTask({
        prdId: "my-prd",
        workingDir: "/path/to/project",
      });

      expect(result).toEqual(mockTask);
    });

    it("should throw error when server returns failure", async () => {
      // Set up server handler
      mockServer.on("connection", (socket: Socket) => {
        socket.on("data", (data: Buffer) => {
          const message = JSON.parse(data.toString());
          if (message.payload?.action === "start_task") {
            const response = JSON.stringify({
              version: "1.0",
              type: "response",
              payload: { success: false, error: "Task start failed" },
            });
            socket.write(response + "\n");
          } else if (message.payload?.action === "ping") {
            const response = JSON.stringify({
              version: "1.0",
              type: "response",
              payload: { success: true, data: { message: "pong" } },
            });
            socket.write(response + "\n");
          }
        });
      });

      const client = new TalosClient({
        socketPath: mockSocketPath,
        logger: mockLogger,
      });

      await client.connect();

      await expect(
        client.startTask({
          prdId: "my-prd",
          workingDir: "/path/to/project",
        })
      ).rejects.toThrow("Task start failed");
    });

    it("should throw error when not connected", async () => {
      const client = new TalosClient({
        socketPath: mockSocketPath,
        logger: mockLogger,
      });

      await expect(
        client.startTask({
          prdId: "my-prd",
          workingDir: "/path/to/project",
        })
      ).rejects.toThrow("Not connected");
    });
  });

  describe("stopTask()", () => {
    it("should stop task successfully", async () => {
      // Set up server handler
      mockServer.on("connection", (socket: Socket) => {
        socket.on("data", (data: Buffer) => {
          const message = JSON.parse(data.toString());
          if (message.payload?.action === "stop_task") {
            const response = JSON.stringify({
              version: "1.0",
              type: "response",
              payload: { success: true, data: { message: "Task stopped" } },
            });
            socket.write(response + "\n");
          } else if (message.payload?.action === "ping") {
            const response = JSON.stringify({
              version: "1.0",
              type: "response",
              payload: { success: true, data: { message: "pong" } },
            });
            socket.write(response + "\n");
          }
        });
      });

      const client = new TalosClient({
        socketPath: mockSocketPath,
        logger: mockLogger,
      });

      await client.connect();

      await expect(
        client.stopTask({
          taskId: "task-123",
          reason: "User requested stop",
        })
      ).resolves.not.toThrow();
    });
  });

  describe("resumeTask()", () => {
    it("should resume task successfully", async () => {
      // Set up server handler
      mockServer.on("connection", (socket: Socket) => {
        socket.on("data", (data: Buffer) => {
          const message = JSON.parse(data.toString());
          if (message.payload?.action === "resume_task") {
            const response = JSON.stringify({
              version: "1.0",
              type: "response",
              payload: { success: true, data: { message: "Task resumed" } },
            });
            socket.write(response + "\n");
          } else if (message.payload?.action === "ping") {
            const response = JSON.stringify({
              version: "1.0",
              type: "response",
              payload: { success: true, data: { message: "pong" } },
            });
            socket.write(response + "\n");
          }
        });
      });

      const client = new TalosClient({
        socketPath: mockSocketPath,
        logger: mockLogger,
      });

      await client.connect();

      await expect(
        client.resumeTask({
          taskId: "task-123",
        })
      ).resolves.not.toThrow();
    });
  });

  describe("getTaskStatus()", () => {
    it("should return task status", async () => {
      const mockTask: ITask = {
        id: "task-123",
        status: "in_progress",
        workingDir: "/path/to/project",
      } as ITask;

      // Set up server handler
      mockServer.on("connection", (socket: Socket) => {
        socket.on("data", (data: Buffer) => {
          const message = JSON.parse(data.toString());
          if (message.payload?.action === "get_status") {
            const response = JSON.stringify({
              version: "1.0",
              type: "response",
              payload: { success: true, data: mockTask },
            });
            socket.write(response + "\n");
          } else if (message.payload?.action === "ping") {
            const response = JSON.stringify({
              version: "1.0",
              type: "response",
              payload: { success: true, data: { message: "pong" } },
            });
            socket.write(response + "\n");
          }
        });
      });

      const client = new TalosClient({
        socketPath: mockSocketPath,
        logger: mockLogger,
      });

      await client.connect();

      const result = await client.getTaskStatus("task-123");

      expect(result).toEqual(mockTask);
    });
  });

  describe("listTasks()", () => {
    it("should return all tasks", async () => {
      const mockTasks: ITask[] = [
        {
          id: "task-1",
          status: "in_progress",
          workingDir: "/path/to/project",
        } as ITask,
        {
          id: "task-2",
          status: "completed",
          workingDir: "/path/to/project",
        } as ITask,
      ];

      // Set up server handler
      mockServer.on("connection", (socket: Socket) => {
        socket.on("data", (data: Buffer) => {
          const message = JSON.parse(data.toString());
          if (message.payload?.action === "list_tasks") {
            const response = JSON.stringify({
              version: "1.0",
              type: "response",
              payload: { success: true, data: mockTasks },
            });
            socket.write(response + "\n");
          } else if (message.payload?.action === "ping") {
            const response = JSON.stringify({
              version: "1.0",
              type: "response",
              payload: { success: true, data: { message: "pong" } },
            });
            socket.write(response + "\n");
          }
        });
      });

      const client = new TalosClient({
        socketPath: mockSocketPath,
        logger: mockLogger,
      });

      await client.connect();

      const result = await client.listTasks();

      expect(result).toEqual(mockTasks);
      expect(result.length).toBe(2);
    });

    it("should filter tasks by status", async () => {
      const mockTasks: ITask[] = [
        {
          id: "task-1",
          status: "in_progress",
          workingDir: "/path/to/project",
        } as ITask,
        {
          id: "task-2",
          status: "completed",
          workingDir: "/path/to/project",
        } as ITask,
      ];

      // Set up server handler
      mockServer.on("connection", (socket: Socket) => {
        socket.on("data", (data: Buffer) => {
          const message = JSON.parse(data.toString());
          if (message.payload?.action === "list_tasks") {
            const response = JSON.stringify({
              version: "1.0",
              type: "response",
              payload: { success: true, data: mockTasks },
            });
            socket.write(response + "\n");
          } else if (message.payload?.action === "ping") {
            const response = JSON.stringify({
              version: "1.0",
              type: "response",
              payload: { success: true, data: { message: "pong" } },
            });
            socket.write(response + "\n");
          }
        });
      });

      const client = new TalosClient({
        socketPath: mockSocketPath,
        logger: mockLogger,
      });

      await client.connect();

      const result = await client.listTasks({ status: "in_progress" });

      expect(result.length).toBe(1);
      expect(result[0].status).toBe("in_progress");
    });
  });

  describe("removeTask()", () => {
    it("should remove task successfully", async () => {
      // Set up server handler
      mockServer.on("connection", (socket: Socket) => {
        socket.on("data", (data: Buffer) => {
          const message = JSON.parse(data.toString());
          if (message.payload?.action === "delete_task") {
            const response = JSON.stringify({
              version: "1.0",
              type: "response",
              payload: { success: true, data: { message: "Task deleted" } },
            });
            socket.write(response + "\n");
          } else if (message.payload?.action === "ping") {
            const response = JSON.stringify({
              version: "1.0",
              type: "response",
              payload: { success: true, data: { message: "pong" } },
            });
            socket.write(response + "\n");
          }
        });
      });

      const client = new TalosClient({
        socketPath: mockSocketPath,
        logger: mockLogger,
      });

      await client.connect();

      await expect(client.removeTask("task-123")).resolves.not.toThrow();
    });
  });

  describe("clearFailedTasks()", () => {
    it("should clear all failed tasks", async () => {
      const mockTasks: ITask[] = [
        {
          id: "task-1",
          status: "failed",
          workingDir: "/path/to/project",
        } as ITask,
        {
          id: "task-2",
          status: "failed",
          workingDir: "/path/to/project",
        } as ITask,
      ];

      let deleteCallCount = 0;

      // Set up server handler
      mockServer.on("connection", (socket: Socket) => {
        socket.on("data", (data: Buffer) => {
          const message = JSON.parse(data.toString());
          if (message.payload?.action === "list_tasks") {
            const response = JSON.stringify({
              version: "1.0",
              type: "response",
              payload: { success: true, data: mockTasks },
            });
            socket.write(response + "\n");
          } else if (message.payload?.action === "delete_task") {
            deleteCallCount++;
            const response = JSON.stringify({
              version: "1.0",
              type: "response",
              payload: { success: true, data: { message: "Task deleted" } },
            });
            socket.write(response + "\n");
          } else if (message.payload?.action === "ping") {
            const response = JSON.stringify({
              version: "1.0",
              type: "response",
              payload: { success: true, data: { message: "pong" } },
            });
            socket.write(response + "\n");
          }
        });
      });

      const client = new TalosClient({
        socketPath: mockSocketPath,
        logger: mockLogger,
      });

      await client.connect();

      const cleared = await client.clearFailedTasks();

      expect(cleared).toBe(2);
      expect(deleteCallCount).toBe(2);
    });
  });

  describe("getTaskHealth()", () => {
    it("should return healthy status for in_progress task", async () => {
      const mockTask: ITask = {
        id: "task-123",
        status: "in_progress",
        workingDir: "/path/to/project",
        metadata: { prdId: "my-prd" },
      } as ITask;

      // Set up server handler
      mockServer.on("connection", (socket: Socket) => {
        socket.on("data", (data: Buffer) => {
          const message = JSON.parse(data.toString());
          if (message.payload?.action === "get_status") {
            const response = JSON.stringify({
              version: "1.0",
              type: "response",
              payload: { success: true, data: mockTask },
            });
            socket.write(response + "\n");
          } else if (message.payload?.action === "ping") {
            const response = JSON.stringify({
              version: "1.0",
              type: "response",
              payload: { success: true, data: { message: "pong" } },
            });
            socket.write(response + "\n");
          }
        });
      });

      const client = new TalosClient({
        socketPath: mockSocketPath,
        logger: mockLogger,
      });

      await client.connect();

      const result = await client.getTaskHealth("task-123");

      expect(result.isHealthy).toBe(true);
      expect(result.status).toBe("in_progress");
    });

    it("should return unhealthy status for failed task", async () => {
      const mockTask: ITask = {
        id: "task-123",
        status: "failed",
        workingDir: "/path/to/project",
      } as ITask;

      // Set up server handler
      mockServer.on("connection", (socket: Socket) => {
        socket.on("data", (data: Buffer) => {
          const message = JSON.parse(data.toString());
          if (message.payload?.action === "get_status") {
            const response = JSON.stringify({
              version: "1.0",
              type: "response",
              payload: { success: true, data: mockTask },
            });
            socket.write(response + "\n");
          } else if (message.payload?.action === "ping") {
            const response = JSON.stringify({
              version: "1.0",
              type: "response",
              payload: { success: true, data: { message: "pong" } },
            });
            socket.write(response + "\n");
          }
        });
      });

      const client = new TalosClient({
        socketPath: mockSocketPath,
        logger: mockLogger,
      });

      await client.connect();

      const result = await client.getTaskHealth("task-123");

      expect(result.isHealthy).toBe(false);
      expect(result.status).toBe("failed");
    });
  });

  describe("subscribe() and unsubscribe()", () => {
    it("should subscribe to events and return subscription ID", () => {
      const client = new TalosClient({
        socketPath: mockSocketPath,
        logger: mockLogger,
      });

      const callback = vi.fn();
      const subscriptionId = client.subscribe("test_event", callback);

      expect(subscriptionId).toBeDefined();
      expect(typeof subscriptionId).toBe("string");
    });

    it("should unsubscribe from events", () => {
      const client = new TalosClient({
        socketPath: mockSocketPath,
        logger: mockLogger,
      });

      const callback = vi.fn();
      const subscriptionId = client.subscribe("test_event", callback);

      client.unsubscribe(subscriptionId);

      // Should not throw
      expect(() => client.unsubscribe(subscriptionId)).not.toThrow();
    });
  });
});
