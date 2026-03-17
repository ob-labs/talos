import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET, POST } from "./route";
import { storage } from "@talos/core";
import { NextRequest } from "next/server";
import type { PRD, UserStory } from "@/types";

// Mock @talos/core
vi.mock("@talos/core", () => ({
  storage: {
    listFiles: vi.fn(),
    readJSON: vi.fn(),
    writeJSON: vi.fn(),
    fileExists: vi.fn(),
    getFileStats: vi.fn(),
  },
}));

describe("GET /api/prds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return empty array when no PRDs exist", async () => {
    vi.mocked(storage.listFiles).mockResolvedValue([]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual([]);
    expect(storage.listFiles).toHaveBeenCalledWith("data/prds", ".json");
  });

  it("should return array of PRDs with metadata", async () => {
    const mockPRD1: PRD = {
      project: "Project Alpha",
      description: "First project",
      userStories: [],
      branchName: "main",
    };

    const mockPRD2: PRD = {
      project: "Project Beta",
      description: "Second project",
      userStories: [],
      branchName: "feature/beta",
    };

    const mockStats1 = {
      birthtime: new Date("2024-01-01T00:00:00Z"),
      size: 1024,
    };

    const mockStats2 = {
      birthtime: new Date("2024-01-02T00:00:00Z"),
      size: 2048,
    };

    vi.mocked(storage.listFiles).mockResolvedValue(["project-alpha.json", "project-beta.json"]);
    vi.mocked(storage.readJSON)
      .mockResolvedValueOnce(mockPRD1)
      .mockResolvedValueOnce(mockPRD2);
    vi.mocked(storage.getFileStats)
      .mockResolvedValueOnce(mockStats1 as any)
      .mockResolvedValueOnce(mockStats2 as any);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(data[0]).toMatchObject({
      ...mockPRD1,
      id: "project-alpha",
      createdAt: "2024-01-01T00:00:00.000Z",
    });
    expect(data[1]).toMatchObject({
      ...mockPRD2,
      id: "project-beta",
      createdAt: "2024-01-02T00:00:00.000Z",
    });
  });

  it("should skip PRDs that return null", async () => {
    const mockPRD: PRD = {
      project: "Project Alpha",
      description: "First project",
      userStories: [],
      branchName: "main",
    };

    vi.mocked(storage.listFiles).mockResolvedValue(["project-alpha.json", "project-beta.json"]);
    vi.mocked(storage.readJSON)
      .mockResolvedValueOnce(mockPRD)
      .mockResolvedValueOnce(null);
    vi.mocked(storage.getFileStats).mockResolvedValue({
      birthtime: new Date(),
      size: 1024,
    } as any);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].project).toBe("Project Alpha");
  });

  it("should return 500 on error", async () => {
    vi.mocked(storage.listFiles).mockRejectedValue(new Error("Failed to read directory"));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to read PRDs");
    expect(data.message).toContain("Failed to read directory");
  });
});

describe("POST /api/prds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should create a new PRD successfully", async () => {
    const newPRD: PRD = {
      project: "Test Project",
      description: "Test description",
      userStories: [],
      branchName: "main",
    };

    vi.mocked(storage.fileExists).mockResolvedValue(false);
    vi.mocked(storage.writeJSON).mockResolvedValue();

    const request = {
      json: async () => newPRD,
    } as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toEqual(newPRD);
    expect(storage.fileExists).toHaveBeenCalledWith("data/prds/test-project.json");
    expect(storage.writeJSON).toHaveBeenCalledWith("data/prds/test-project.json", newPRD);
  });

  it("should generate ID from project name", async () => {
    const newPRD: PRD = {
      project: "My Awesome Project",
      description: "Test description",
      userStories: [],
    };

    vi.mocked(storage.fileExists).mockResolvedValue(false);
    vi.mocked(storage.writeJSON).mockResolvedValue();

    const request = {
      json: async () => newPRD,
    } as unknown as NextRequest;

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(storage.fileExists).toHaveBeenCalledWith("data/prds/my-awesome-project.json");
  });

  it("should set default branchName to 'main' if not provided", async () => {
    const newPRD: PRD = {
      project: "Test Project",
      description: "Test description",
      userStories: [],
    };

    const expectedPRD: PRD = {
      project: "Test Project",
      description: "Test description",
      userStories: [],
      branchName: "main",
    };

    vi.mocked(storage.fileExists).mockResolvedValue(false);
    vi.mocked(storage.writeJSON).mockResolvedValue();

    const request = {
      json: async () => newPRD,
    } as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toEqual(expectedPRD);
    expect(storage.writeJSON).toHaveBeenCalledWith("data/prds/test-project.json", expectedPRD);
  });

  it("should return 400 if project is missing", async () => {
    const invalidPRD = {
      description: "Test description",
      userStories: [],
    };

    const request = {
      json: async () => invalidPRD,
    } as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid input");
    expect(data.message).toContain("PRD project name is required");
  });

  it("should return 400 if project is not a string", async () => {
    const invalidPRD = {
      project: 123,
      description: "Test description",
      userStories: [],
    };

    const request = {
      json: async () => invalidPRD,
    } as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid input");
    expect(data.message).toContain("PRD project name is required and must be a string");
  });

  it("should return 400 if description is missing", async () => {
    const invalidPRD = {
      project: "Test Project",
      userStories: [],
    };

    const request = {
      json: async () => invalidPRD,
    } as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid input");
    expect(data.message).toContain("PRD description is required");
  });

  it("should return 400 if description is not a string", async () => {
    const invalidPRD = {
      project: "Test Project",
      description: 123,
      userStories: [],
    };

    const request = {
      json: async () => invalidPRD,
    } as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid input");
    expect(data.message).toContain("PRD description is required and must be a string");
  });

  it("should return 400 if userStories is missing", async () => {
    const invalidPRD = {
      project: "Test Project",
      description: "Test description",
    };

    const request = {
      json: async () => invalidPRD,
    } as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid input");
    expect(data.message).toContain("PRD userStories is required");
  });

  it("should return 400 if userStories is not an array", async () => {
    const invalidPRD = {
      project: "Test Project",
      description: "Test description",
      userStories: "not an array",
    };

    const request = {
      json: async () => invalidPRD,
    } as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid input");
    expect(data.message).toContain("PRD userStories is required and must be an array");
  });

  it("should return 409 if PRD already exists", async () => {
    const existingPRD: PRD = {
      project: "Test Project",
      description: "Test description",
      userStories: [],
      branchName: "main",
    };

    vi.mocked(storage.fileExists).mockResolvedValue(true);

    const request = {
      json: async () => existingPRD,
    } as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe("PRD already exists");
    expect(data.message).toContain("PRD with ID 'test-project' already exists");
  });

  it("should return 500 on write error", async () => {
    const newPRD: PRD = {
      project: "Test Project",
      description: "Test description",
      userStories: [],
      branchName: "main",
    };

    vi.mocked(storage.fileExists).mockResolvedValue(false);
    vi.mocked(storage.writeJSON).mockRejectedValue(new Error("Write failed"));

    const request = {
      json: async () => newPRD,
    } as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to create PRD");
    expect(data.message).toContain("Write failed");
  });
});
