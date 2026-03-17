import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET } from "./route";
import { storage } from "@talos/core";

// Mock @talos/core
vi.mock("@talos/core", () => ({
  storage: {
    fileExists: vi.fn(),
    getFileStats: vi.fn(),
  },
}));

describe("GET /api/prds/[id]/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return PRD stats successfully", async () => {
    const mockStats = {
      birthtime: new Date("2024-01-01T00:00:00Z"),
      mtime: new Date("2024-01-02T12:30:00Z"),
      size: 2048,
    };

    vi.mocked(storage.fileExists).mockResolvedValue(true);
    vi.mocked(storage.getFileStats).mockResolvedValue(mockStats as any);

    const params = Promise.resolve({ id: "test-project" });
    const response = await GET({} as any, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      createdAt: "2024-01-01T00:00:00.000Z",
      modifiedAt: "2024-01-02T12:30:00.000Z",
      size: 2048,
    });
    expect(storage.fileExists).toHaveBeenCalledWith("data/prds/test-project.json");
    expect(storage.getFileStats).toHaveBeenCalledWith("data/prds/test-project.json");
  });

  it("should return 404 if PRD not found", async () => {
    vi.mocked(storage.fileExists).mockResolvedValue(false);

    const params = Promise.resolve({ id: "non-existent" });
    const response = await GET({} as any, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("PRD not found");
    expect(data.message).toContain("PRD with ID 'non-existent' does not exist");
    expect(storage.getFileStats).not.toHaveBeenCalled();
  });

  it("should return 500 if getFileStats returns null", async () => {
    vi.mocked(storage.fileExists).mockResolvedValue(true);
    vi.mocked(storage.getFileStats).mockResolvedValue(null);

    const params = Promise.resolve({ id: "test-project" });
    const response = await GET({} as any, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to get stats");
    expect(data.message).toContain("Could not retrieve file statistics");
  });

  it("should return 500 on error", async () => {
    vi.mocked(storage.fileExists).mockResolvedValue(true);
    vi.mocked(storage.getFileStats).mockRejectedValue(new Error("Stat failed"));

    const params = Promise.resolve({ id: "test-project" });
    const response = await GET({} as any, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to get PRD stats");
    expect(data.message).toContain("Stat failed");
  });

  it("should handle large file sizes", async () => {
    const mockStats = {
      birthtime: new Date("2024-01-01T00:00:00Z"),
      mtime: new Date("2024-01-02T12:30:00Z"),
      size: 1024 * 1024 * 10, // 10 MB
    };

    vi.mocked(storage.fileExists).mockResolvedValue(true);
    vi.mocked(storage.getFileStats).mockResolvedValue(mockStats as any);

    const params = Promise.resolve({ id: "test-project" });
    const response = await GET({} as any, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.size).toBe(1024 * 1024 * 10);
  });

  it("should convert dates to ISO format correctly", async () => {
    const birthtime = new Date("2024-01-01T00:00:00.123Z");
    const mtime = new Date("2024-12-31T23:59:59.999Z");

    const mockStats = {
      birthtime,
      mtime,
      size: 1024,
    };

    vi.mocked(storage.fileExists).mockResolvedValue(true);
    vi.mocked(storage.getFileStats).mockResolvedValue(mockStats as any);

    const params = Promise.resolve({ id: "test-project" });
    const response = await GET({} as any, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.createdAt).toBe("2024-01-01T00:00:00.123Z");
    expect(data.modifiedAt).toBe("2024-12-31T23:59:59.999Z");
  });
});
