import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET, POST } from "./route";
import { storage } from "@talos/core";
import { NextRequest } from "next/server";
import type { Role } from "@/types";

// Mock @talos/core
vi.mock("@talos/core", () => ({
  storage: {
    listFiles: vi.fn(),
    readJSON: vi.fn(),
    writeJSON: vi.fn(),
    fileExists: vi.fn(),
    deleteFile: vi.fn(),
  },
}));

describe("GET /api/roles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return empty array when no roles exist", async () => {
    vi.mocked(storage.listFiles).mockResolvedValue([]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual([]);
    expect(storage.listFiles).toHaveBeenCalledWith("data/roles", ".json");
  });

  it("should return array of roles", async () => {
    const mockRoles: Role[] = [
      {
        id: "role-1",
        name: "Developer",
        model: "claude-sonnet-4-5",
        mcpServers: [],
        skills: [],
        description: "Developer role",
        isDefault: false,
      },
      {
        id: "role-2",
        name: "Reviewer",
        model: "claude-opus-4-6",
        mcpServers: [],
        skills: [],
        description: "Reviewer role",
        isDefault: true,
      },
    ];

    vi.mocked(storage.listFiles).mockResolvedValue(["role-1.json", "role-2.json"]);
    vi.mocked(storage.readJSON)
      .mockResolvedValueOnce(mockRoles[0])
      .mockResolvedValueOnce(mockRoles[1]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockRoles);
    expect(storage.readJSON).toHaveBeenCalledWith("data/roles/role-1.json");
    expect(storage.readJSON).toHaveBeenCalledWith("data/roles/role-2.json");
  });

  it("should skip roles that return null", async () => {
    const mockRole: Role = {
      id: "role-1",
      name: "Developer",
      model: "claude-sonnet-4-5",
      mcpServers: [],
      skills: [],
      description: "Developer role",
      isDefault: false,
    };

    vi.mocked(storage.listFiles).mockResolvedValue(["role-1.json", "role-2.json"]);
    vi.mocked(storage.readJSON)
      .mockResolvedValueOnce(mockRole)
      .mockResolvedValueOnce(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual([mockRole]);
  });

  it("should return 500 on error", async () => {
    vi.mocked(storage.listFiles).mockRejectedValue(new Error("Failed to read directory"));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to read roles");
    expect(data.message).toContain("Failed to read directory");
  });
});

describe("POST /api/roles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should create a new role successfully", async () => {
    const newRole: Role = {
      id: "role-new",
      name: "Tester",
      model: "claude-sonnet-4-5",
      mcpServers: [],
      skills: [],
      description: "Tester role",
      isDefault: false,
    };

    vi.mocked(storage.fileExists).mockResolvedValue(false);
    vi.mocked(storage.writeJSON).mockResolvedValue();

    const request = {
      json: async () => newRole,
    } as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toEqual(newRole);
    expect(storage.fileExists).toHaveBeenCalledWith("data/roles/role-new.json");
    expect(storage.writeJSON).toHaveBeenCalledWith("data/roles/role-new.json", newRole);
  });

  it("should create role with default values for optional fields", async () => {
    const partialRole = {
      id: "role-new",
      name: "Tester",
      model: "claude-sonnet-4-5",
    };

    const expectedRole: Role = {
      id: "role-new",
      name: "Tester",
      model: "claude-sonnet-4-5",
      mcpServers: [],
      skills: [],
      description: "",
      isDefault: false,
    };

    vi.mocked(storage.fileExists).mockResolvedValue(false);
    vi.mocked(storage.writeJSON).mockResolvedValue();

    const request = {
      json: async () => partialRole,
    } as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toEqual(expectedRole);
  });

  it("should return 400 if id is missing", async () => {
    const invalidRole = {
      name: "Tester",
      model: "claude-sonnet-4-5",
    };

    const request = {
      json: async () => invalidRole,
    } as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid input");
    expect(data.message).toContain("Role ID is required");
  });

  it("should return 400 if id is not a string", async () => {
    const invalidRole = {
      id: 123,
      name: "Tester",
      model: "claude-sonnet-4-5",
    };

    const request = {
      json: async () => invalidRole,
    } as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid input");
    expect(data.message).toContain("Role ID is required and must be a string");
  });

  it("should return 400 if name is missing", async () => {
    const invalidRole = {
      id: "role-new",
      model: "claude-sonnet-4-5",
    };

    const request = {
      json: async () => invalidRole,
    } as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid input");
    expect(data.message).toContain("Role name is required");
  });

  it("should return 400 if name is not a string", async () => {
    const invalidRole = {
      id: "role-new",
      name: 123,
      model: "claude-sonnet-4-5",
    };

    const request = {
      json: async () => invalidRole,
    } as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid input");
    expect(data.message).toContain("Role name is required and must be a string");
  });

  it("should return 400 if model is missing", async () => {
    const invalidRole = {
      id: "role-new",
      name: "Tester",
    };

    const request = {
      json: async () => invalidRole,
    } as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid input");
    expect(data.message).toContain("Role model is required");
  });

  it("should return 400 if model is not a string", async () => {
    const invalidRole = {
      id: "role-new",
      name: "Tester",
      model: 123,
    };

    const request = {
      json: async () => invalidRole,
    } as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid input");
    expect(data.message).toContain("Role model is required and must be a string");
  });

  it("should return 409 if role already exists", async () => {
    const existingRole: Role = {
      id: "role-existing",
      name: "Developer",
      model: "claude-sonnet-4-5",
      mcpServers: [],
      skills: [],
      description: "Developer role",
      isDefault: false,
    };

    vi.mocked(storage.fileExists).mockResolvedValue(true);

    const request = {
      json: async () => existingRole,
    } as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe("Role already exists");
    expect(data.message).toContain("Role with ID 'role-existing' already exists");
  });

  it("should return 500 on write error", async () => {
    const newRole: Role = {
      id: "role-new",
      name: "Tester",
      model: "claude-sonnet-4-5",
      mcpServers: [],
      skills: [],
      description: "Tester role",
      isDefault: false,
    };

    vi.mocked(storage.fileExists).mockResolvedValue(false);
    vi.mocked(storage.writeJSON).mockRejectedValue(new Error("Write failed"));

    const request = {
      json: async () => newRole,
    } as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to create role");
    expect(data.message).toContain("Write failed");
  });
});
