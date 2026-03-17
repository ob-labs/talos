import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET, PUT, DELETE } from "./route";
import { storage } from "@talos/core";
import { NextRequest } from "next/server";
import type { PRD, UserStory } from "@/types";

// Mock @talos/core
vi.mock("@talos/core", () => ({
  storage: {
    readJSON: vi.fn(),
    writeJSON: vi.fn(),
    fileExists: vi.fn(),
    deleteFile: vi.fn(),
  },
}));

describe("GET /api/prds/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return PRD by ID", async () => {
    const mockPRD: PRD = {
      project: "Test Project",
      description: "Test description",
      userStories: [],
      branchName: "main",
    };

    vi.mocked(storage.fileExists).mockResolvedValue(true);
    vi.mocked(storage.readJSON).mockResolvedValue(mockPRD);

    const params = Promise.resolve({ id: "test-project" });
    const response = await GET({} as NextRequest, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockPRD);
    expect(storage.fileExists).toHaveBeenCalledWith("data/prds/test-project.json");
    expect(storage.readJSON).toHaveBeenCalledWith("data/prds/test-project.json");
  });

  it("should return 404 if PRD not found (file doesn't exist)", async () => {
    vi.mocked(storage.fileExists).mockResolvedValue(false);

    const params = Promise.resolve({ id: "non-existent" });
    const response = await GET({} as NextRequest, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("PRD not found");
    expect(data.message).toContain("PRD with ID 'non-existent' does not exist");
  });

  it("should return 404 if PRD is null", async () => {
    vi.mocked(storage.fileExists).mockResolvedValue(true);
    vi.mocked(storage.readJSON).mockResolvedValue(null);

    const params = Promise.resolve({ id: "test-project" });
    const response = await GET({} as NextRequest, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("PRD not found");
  });

  it("should return 500 on read error", async () => {
    vi.mocked(storage.fileExists).mockResolvedValue(true);
    vi.mocked(storage.readJSON).mockRejectedValue(new Error("Read failed"));

    const params = Promise.resolve({ id: "test-project" });
    const response = await GET({} as NextRequest, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to read PRD");
    expect(data.message).toContain("Read failed");
  });
});

describe("PUT /api/prds/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should update PRD completely", async () => {
    const existingPRD: PRD = {
      project: "Old Project",
      description: "Old description",
      userStories: [],
      branchName: "main",
    };

    const updatedPRD: PRD = {
      project: "Updated Project",
      description: "Updated description",
      userStories: [],
      branchName: "feature/updated",
    };

    vi.mocked(storage.fileExists).mockResolvedValue(true);
    vi.mocked(storage.readJSON).mockResolvedValue(existingPRD);
    vi.mocked(storage.writeJSON).mockResolvedValue();

    const request = {
      json: async () => updatedPRD,
    } as unknown as NextRequest;

    const params = Promise.resolve({ id: "test-project" });
    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(updatedPRD);
    expect(storage.writeJSON).toHaveBeenCalledWith("data/prds/test-project.json", updatedPRD);
  });

  it("should update PRD partially (only project)", async () => {
    const existingPRD: PRD = {
      project: "Old Project",
      description: "Old description",
      userStories: [],
      branchName: "main",
    };

    const partialUpdate = {
      project: "Updated Project",
    };

    const expectedPRD: PRD = {
      project: "Updated Project",
      description: "Old description",
      userStories: [],
      branchName: "main",
    };

    vi.mocked(storage.fileExists).mockResolvedValue(true);
    vi.mocked(storage.readJSON).mockResolvedValue(existingPRD);
    vi.mocked(storage.writeJSON).mockResolvedValue();

    const request = {
      json: async () => partialUpdate,
    } as unknown as NextRequest;

    const params = Promise.resolve({ id: "test-project" });
    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(expectedPRD);
  });

  it("should update PRD partially (only userStories)", async () => {
    const existingPRD: PRD = {
      project: "Test Project",
      description: "Test description",
      userStories: [],
      branchName: "main",
    };

    const newUserStories: UserStory[] = [
      {
        id: "US-001",
        title: "Story 1",
        description: "Description",
        acceptanceCriteria: [],
        priority: 1,
        passes: false,
      },
    ];

    const expectedPRD: PRD = {
      project: "Test Project",
      description: "Test description",
      userStories: newUserStories,
      branchName: "main",
    };

    vi.mocked(storage.fileExists).mockResolvedValue(true);
    vi.mocked(storage.readJSON).mockResolvedValue(existingPRD);
    vi.mocked(storage.writeJSON).mockResolvedValue();

    const request = {
      json: async () => ({ userStories: newUserStories }),
    } as unknown as NextRequest;

    const params = Promise.resolve({ id: "test-project" });
    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(expectedPRD);
  });

  it("should return 404 if PRD not found", async () => {
    vi.mocked(storage.fileExists).mockResolvedValue(false);

    const request = {
      json: async () => ({ project: "Updated" }),
    } as unknown as NextRequest;

    const params = Promise.resolve({ id: "non-existent" });
    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("PRD not found");
  });

  it("should return 400 if project is not a string", async () => {
    vi.mocked(storage.fileExists).mockResolvedValue(true);

    const request = {
      json: async () => ({ project: 123 }),
    } as unknown as NextRequest;

    const params = Promise.resolve({ id: "test-project" });
    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid input");
    expect(data.message).toContain("PRD project name must be a string");
  });

  it("should return 400 if description is not a string", async () => {
    vi.mocked(storage.fileExists).mockResolvedValue(true);

    const request = {
      json: async () => ({ description: 123 }),
    } as unknown as NextRequest;

    const params = Promise.resolve({ id: "test-project" });
    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid input");
    expect(data.message).toContain("PRD description must be a string");
  });

  it("should return 400 if userStories is not an array", async () => {
    vi.mocked(storage.fileExists).mockResolvedValue(true);

    const request = {
      json: async () => ({ userStories: "not an array" }),
    } as unknown as NextRequest;

    const params = Promise.resolve({ id: "test-project" });
    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid input");
    expect(data.message).toContain("PRD userStories must be an array");
  });

  it("should return 404 if existing PRD is null after file exists", async () => {
    vi.mocked(storage.fileExists).mockResolvedValue(true);
    vi.mocked(storage.readJSON).mockResolvedValue(null);

    const request = {
      json: async () => ({ project: "Updated" }),
    } as unknown as NextRequest;

    const params = Promise.resolve({ id: "test-project" });
    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("PRD not found");
  });

  it("should return 500 on write error", async () => {
    const existingPRD: PRD = {
      project: "Test Project",
      description: "Test description",
      userStories: [],
      branchName: "main",
    };

    vi.mocked(storage.fileExists).mockResolvedValue(true);
    vi.mocked(storage.readJSON).mockResolvedValue(existingPRD);
    vi.mocked(storage.writeJSON).mockRejectedValue(new Error("Write failed"));

    const request = {
      json: async () => ({ project: "Updated" }),
    } as unknown as NextRequest;

    const params = Promise.resolve({ id: "test-project" });
    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to update PRD");
    expect(data.message).toContain("Write failed");
  });
});

describe("DELETE /api/prds/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should delete PRD successfully", async () => {
    vi.mocked(storage.fileExists).mockResolvedValue(true);
    vi.mocked(storage.deleteFile).mockResolvedValue();

    const params = Promise.resolve({ id: "test-project" });
    const response = await DELETE({} as NextRequest, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe("PRD deleted successfully");
    expect(data.id).toBe("test-project");
    expect(storage.fileExists).toHaveBeenCalledWith("data/prds/test-project.json");
    expect(storage.deleteFile).toHaveBeenCalledWith("data/prds/test-project.json");
  });

  it("should return 404 if PRD not found", async () => {
    vi.mocked(storage.fileExists).mockResolvedValue(false);

    const params = Promise.resolve({ id: "non-existent" });
    const response = await DELETE({} as NextRequest, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("PRD not found");
    expect(data.message).toContain("PRD with ID 'non-existent' does not exist");
    expect(storage.deleteFile).not.toHaveBeenCalled();
  });

  it("should return 500 on delete error", async () => {
    vi.mocked(storage.fileExists).mockResolvedValue(true);
    vi.mocked(storage.deleteFile).mockRejectedValue(new Error("Delete failed"));

    const params = Promise.resolve({ id: "test-project" });
    const response = await DELETE({} as NextRequest, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to delete PRD");
    expect(data.message).toContain("Delete failed");
  });
});
