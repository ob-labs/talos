import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST } from "./route";
import { GitRepository } from "@talos/git";
import { NextRequest } from "next/server";

// Mock GitRepository
vi.mock("@talos/git", () => ({
  GitRepository: vi.fn(),
}));

describe("POST /api/git/init", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return 400 if path is missing", async () => {
    const request = {
      json: async () => ({}),
    } as unknown as Request;

    const response = await POST(request as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid request");
    expect(data.message).toContain("Path is required");
  });

  it("should return 400 if path is not a string", async () => {
    const request = {
      json: async () => ({ path: 123 }),
    } as unknown as Request;

    const response = await POST(request as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid request");
  });

  it("should return success if directory is already a git repository", async () => {
    const mockIsRepo = vi.fn().mockResolvedValue({
      success: true,
      data: true,
    });

    vi.mocked(GitRepository).mockImplementation(
      () =>
        ({
          isRepo: mockIsRepo,
        }) as unknown as GitRepository
    );

    const request = {
      json: async () => ({ path: "/existing/repo" }),
    } as unknown as Request;

    const response = await POST(request as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.isRepo).toBe(true);
    expect(data.message).toContain("already a git repository");
    expect(mockIsRepo).toHaveBeenCalledOnce();
  });

  it("should initialize git repository successfully", async () => {
    const mockIsRepo = vi.fn().mockResolvedValue({
      success: true,
      data: false,
    });

    const mockInit = vi.fn().mockResolvedValue({
      success: true,
      data: ".git",
    });

    vi.mocked(GitRepository).mockImplementation(
      () =>
        ({
          isRepo: mockIsRepo,
          init: mockInit,
        }) as unknown as GitRepository
    );

    const request = {
      json: async () => ({ path: "/new/repo" }),
    } as unknown as Request;

    const response = await POST(request as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.isRepo).toBe(false);
    expect(data.message).toContain("initialized successfully");
    expect(data.path).toBe("/new/repo");
    expect(mockIsRepo).toHaveBeenCalledOnce();
    expect(mockInit).toHaveBeenCalledOnce();
    expect(mockInit).toHaveBeenCalledWith(false);
  });

  it("should return 500 if git check fails", async () => {
    const mockIsRepo = vi.fn().mockResolvedValue({
      success: false,
      error: "Failed to check repository",
    });

    vi.mocked(GitRepository).mockImplementation(
      () =>
        ({
          isRepo: mockIsRepo,
        }) as unknown as GitRepository
    );

    const request = {
      json: async () => ({ path: "/some/path" }),
    } as unknown as Request;

    const response = await POST(request as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Git error");
    expect(data.message).toContain("Failed to check repository");
  });

  it("should return 500 if git init fails", async () => {
    const mockIsRepo = vi.fn().mockResolvedValue({
      success: true,
      data: false,
    });

    const mockInit = vi.fn().mockResolvedValue({
      success: false,
      error: "Failed to initialize",
    });

    vi.mocked(GitRepository).mockImplementation(
      () =>
        ({
          isRepo: mockIsRepo,
          init: mockInit,
        }) as unknown as GitRepository
    );

    const request = {
      json: async () => ({ path: "/some/path" }),
    } as unknown as Request;

    const response = await POST(request as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Git init failed");
    expect(data.message).toContain("Failed to initialize");
  });
});
