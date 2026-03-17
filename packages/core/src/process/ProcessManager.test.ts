import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomUUID } from "crypto";
import { rm } from "fs/promises";
import { ProcessManager } from "./ProcessManager";
import * as os from "os";

describe("ProcessManager", () => {
  let processManager: ProcessManager;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = `${os.tmpdir()}/test-process-manager-${randomUUID()}`;
    processManager = new ProcessManager(tempDir);
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("PID file operations", () => {
    it("should write and read PID file", async () => {
      const pidPath = `${tempDir}/test.pid`;
      const testPid = 12345;

      await processManager.writePid(pidPath, testPid);
      const readPid = await processManager.readPid(pidPath);

      expect(readPid).toBe(testPid);
    });

    it("should return null for non-existent PID file", async () => {
      const pidPath = `${tempDir}/nonexistent.pid`;

      const readPid = await processManager.readPid(pidPath);

      expect(readPid).toBeNull();
    });

    it("should check if PID is running", async () => {
      const pidPath = `${tempDir}/current.pid`;

      await processManager.writePid(pidPath, process.pid);
      const isRunning = await processManager.isPidRunning(pidPath);

      expect(isRunning).toBe(true);
    });
  });

  describe("Process state checking", () => {
    it("should detect current process as alive", () => {
      expect(processManager.isAlive(process.pid)).toBe(true);
    });

    it("should detect non-existent PID as not alive", () => {
      // Use a very high PID that's unlikely to exist
      expect(processManager.isAlive(999999)).toBe(false);
    });
  });

  describe("Process spawning", () => {
    it("should spawn a simple process and return pid", async () => {
      const pid = await processManager.spawn("echo", ["hello"], {
        stdin: "pipe",
      });

      expect(pid).toBeGreaterThan(0);
      expect(typeof pid).toBe("number");

      // Wait for process to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it("should spawn a process with options", async () => {
      const pid = await processManager.spawn("node", ["--version"], {
        stdin: "pipe",
      });

      expect(pid).toBeGreaterThan(0);
      expect(typeof pid).toBe("number");

      // Wait for process to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    });
  });

  describe("Process stopping", () => {
    it("should stop a running process", async () => {
      const pid = await processManager.spawn("sleep", ["10"], {
        stdin: "pipe",
      });

      // Give process time to start
      await new Promise(resolve => setTimeout(resolve, 100));

      const exitInfo = await processManager.stop(pid);

      expect(exitInfo.exitCode).toBeNull();
      expect(exitInfo.signal).toBe("SIGTERM");
      expect(exitInfo.killed).toBe(true);
    });

    it("should handle stopping non-existent process gracefully", async () => {
      const exitInfo = await processManager.stop(999999, "SIGTERM");

      expect(exitInfo.killed).toBe(false);
      expect(exitInfo.exitCode).toBeNull();
    });

    it("should get exit info for a process", async () => {
      const pid = await processManager.spawn("echo", ["test"], {
        stdin: "pipe",
      });

      // Wait for process to exit
      await new Promise(resolve => setTimeout(resolve, 500));

      const exitInfo = await processManager.getExitInfo(pid);

      expect(exitInfo).not.toBeNull();
      expect(exitInfo?.exitCode).toBeNull(); // We can't get exit code for arbitrary processes
      expect(exitInfo?.killed).toBe(false);
    });
  });
});
