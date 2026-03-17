/**
 * Claude Environment Check Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkClaudeEnvironment } from "./claude-env-check";
import { EventEmitter } from "events";

// Mock child_process
vi.mock("child_process", () => ({
  spawn: vi.fn(),
}));

describe("checkClaudeEnvironment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return available true when Claude command succeeds", async () => {
    const { spawn } = await import("child_process");
    const mockChildProcess = new EventEmitter() as any;
    mockChildProcess.stdout = new EventEmitter();
    mockChildProcess.stderr = new EventEmitter();

    vi.mocked(spawn).mockReturnValue(mockChildProcess);

    // Simulate successful execution
    setTimeout(() => {
      mockChildProcess.emit("close", 0);
    }, 10);

    const result = await checkClaudeEnvironment();

    expect(result.available).toBe(true);
    expect(result.error).toBeUndefined();
    expect(spawn).toHaveBeenCalledWith("claude", ["--version"], {
      stdio: "pipe",
    });
  });

  it("should return available true when Claude command returns exit code 1 (not logged in)", async () => {
    const { spawn } = await import("child_process");
    const mockChildProcess = new EventEmitter() as any;
    mockChildProcess.stdout = new EventEmitter();
    mockChildProcess.stderr = new EventEmitter();

    vi.mocked(spawn).mockReturnValue(mockChildProcess);

    // Simulate exit code 1 (e.g., not logged in)
    setTimeout(() => {
      mockChildProcess.emit("close", 1);
    }, 10);

    const result = await checkClaudeEnvironment();

    expect(result.available).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should return available false when Claude command not found (exit code 127)", async () => {
    const { spawn } = await import("child_process");
    const mockChildProcess = new EventEmitter() as any;
    mockChildProcess.stdout = new EventEmitter();
    mockChildProcess.stderr = new EventEmitter();

    vi.mocked(spawn).mockReturnValue(mockChildProcess);

    // Simulate command not found
    setTimeout(() => {
      mockChildProcess.emit("close", 127);
    }, 10);

    const result = await checkClaudeEnvironment();

    expect(result.available).toBe(false);
    expect(result.error).toBe("Claude command not found");
  });

  it("should return available false when spawn fails with ENOENT", async () => {
    const { spawn } = await import("child_process");
    const mockError = new Error("spawn claude ENOENT") as any;
    mockError.code = "ENOENT";

    vi.mocked(spawn).mockImplementation(() => {
      throw mockError;
    });

    const result = await checkClaudeEnvironment();

    expect(result.available).toBe(false);
    expect(result.error).toBe("Claude command not found");
  });

  it("should return available false when spawn throws other error", async () => {
    const { spawn } = await import("child_process");
    const mockError = new Error("Permission denied") as any;

    vi.mocked(spawn).mockImplementation(() => {
      throw mockError;
    });

    const result = await checkClaudeEnvironment();

    expect(result.available).toBe(false);
    expect(result.error).toBe("Permission denied");
  });

  it("should return available false when Claude command returns other exit code", async () => {
    const { spawn } = await import("child_process");
    const mockChildProcess = new EventEmitter() as any;
    mockChildProcess.stdout = new EventEmitter();
    mockChildProcess.stderr = new EventEmitter();

    vi.mocked(spawn).mockReturnValue(mockChildProcess);

    // Simulate other exit code
    setTimeout(() => {
      mockChildProcess.emit("close", 2);
    }, 10);

    const result = await checkClaudeEnvironment();

    expect(result.available).toBe(false);
    expect(result.error).toBe("Claude command exited with code 2");
  });

  it("should return available false on spawn error", async () => {
    const { spawn } = await import("child_process");
    const mockChildProcess = new EventEmitter() as any;
    mockChildProcess.stdout = new EventEmitter();
    mockChildProcess.stderr = new EventEmitter();

    vi.mocked(spawn).mockReturnValue(mockChildProcess);

    // Simulate spawn error
    setTimeout(() => {
      mockChildProcess.emit("error", new Error("Permission denied"));
    }, 10);

    const result = await checkClaudeEnvironment();

    expect(result.available).toBe(false);
    expect(result.error).toBe("Permission denied");
  });

  it("should return available false when command times out", async () => {
    const { spawn } = await import("child_process");
    const mockChildProcess = new EventEmitter() as any;
    mockChildProcess.stdout = new EventEmitter();
    mockChildProcess.stderr = new EventEmitter();
    mockChildProcess.kill = vi.fn();

    vi.mocked(spawn).mockReturnValue(mockChildProcess);

    // Don't emit close event - should timeout
    const result = await checkClaudeEnvironment();

    expect(result.available).toBe(false);
    expect(result.error).toBe("Claude command timed out");
    expect(mockChildProcess.kill).toHaveBeenCalled();
  }, 10000); // Increase timeout for this test

  it("should clear timeout when process closes normally", async () => {
    const { spawn } = await import("child_process");
    const mockChildProcess = new EventEmitter() as any;
    mockChildProcess.stdout = new EventEmitter();
    mockChildProcess.stderr = new EventEmitter();

    vi.mocked(spawn).mockReturnValue(mockChildProcess);

    // Close immediately
    setTimeout(() => {
      mockChildProcess.emit("close", 0);
    }, 10);

    const result = await checkClaudeEnvironment();

    expect(result.available).toBe(true);
    expect(result.error).toBeUndefined();
  });
});
