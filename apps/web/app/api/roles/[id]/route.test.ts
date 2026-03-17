import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET, PUT, DELETE } from "./route";
import { storage } from "@talos/core";
import { NextRequest } from "next/server";
import type { Role } from "@/types";

// Mock @talos/core
vi.mock("@talos/core", () => ({
  storage: {
    readJSON: vi.fn(),
    writeJSON: vi.fn(),
    fileExists: vi.fn(),
    deleteFile: vi.fn(),
  },
}));

describe("GET /api/roles/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return role when found", async () => {
    const mockRole: Role = {
      id: "role-1",
      name: "Developer",
      model: "claude-sonnet-4-5",
      mcpServers: [],
      skills: [],
      description: "Developer role",
      isDefault: false,
    };

    vi.mocked(storage.fileExists).mockResolvedValue(true);
    vi.mocked(storage.readJSON).mockResolvedValue(mockRole);

    const params = Promise.resolve({ id: "role-1" });
    const request = {} as unknown as NextRequest;

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockRole);
    expect(storage.fileExists).toHaveBeenCalledWith("data/roles/role-1.json");
    expect(storage.readJSON).toHaveBeenCalledWith("data/roles/role-1.json");
  });

  it("should return 404 when role file does not exist", async () => {
    vi.mocked(storage.fileExists).mockResolvedValue(false);

    const params = Promise.resolve({ id: "role-1" });
    const request = {} as unknown as NextRequest;

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Role not found");
    expect(data.message).toContain("Role with ID 'role-1' does not exist");
  });

  it("should return 404 when readJSON returns null", async () => {
    vi.mocked(storage.fileExists).mockResolvedValue(true);
    vi.mocked(storage.readJSON).mockResolvedValue(null);

    const params = Promise.resolve({ id: "role-1" });
    const request = {} as unknown as NextRequest;

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Role not found");
    expect(data.message).toContain("Role with ID 'role-1' does not exist");
  });

  it("should return 500 on error", async () => {
    vi.mocked(storage.fileExists).mockRejectedValue(new Error("Read error"));

    const params = Promise.resolve({ id: "role-1" });
    const request = {} as unknown as NextRequest;

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to read role");
    expect(data.message).toContain("Read error");
  });
});

describe("PUT /api/roles/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should update role successfully", async () => {
    const existingRole: Role = {
      id: "role-1",
      name: "Developer",
      model: "claude-sonnet-4-5",
      mcpServers: [],
      skills: [],
      description: "Developer role",
      isDefault: false,
    };

    const updatedRole: Role = {
      id: "role-1",
      name: "Senior Developer",
      model: "claude-opus-4-6",
      mcpServers: [{ name: "server1", command: "cmd", args: [] }],
      skills: [{ name: "skill1", path: "/path/to/skill1", triggerWords: ["test"] }],
      description: "Senior developer role",
      isDefault: true,
    };

    vi.mocked(storage.fileExists).mockResolvedValue(true);
    vi.mocked(storage.readJSON).mockResolvedValue(existingRole);
    vi.mocked(storage.writeJSON).mockResolvedValue();

    const params = Promise.resolve({ id: "role-1" });
    const request = {
      json: async () => ({
        name: "Senior Developer",
        model: "claude-opus-4-6",
        mcpServers: [{ name: "server1", command: "cmd", args: [] }],
        skills: [{ name: "skill1", path: "/path/to/skill1", triggerWords: ["test"] }],
        description: "Senior developer role",
        isDefault: true,
      }),
    } as unknown as NextRequest;

    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(updatedRole);
    expect(storage.writeJSON).toHaveBeenCalledWith("data/roles/role-1.json", updatedRole);
  });

  it("should update role with partial fields", async () => {
    const existingRole: Role = {
      id: "role-1",
      name: "Developer",
      model: "claude-sonnet-4-5",
      mcpServers: [],
      skills: [],
      description: "Developer role",
      isDefault: false,
    };

    const expectedRole: Role = {
      ...existingRole,
      name: "Senior Developer",
    };

    vi.mocked(storage.fileExists).mockResolvedValue(true);
    vi.mocked(storage.readJSON).mockResolvedValue(existingRole);
    vi.mocked(storage.writeJSON).mockResolvedValue();

    const params = Promise.resolve({ id: "role-1" });
    const request = {
      json: async () => ({
        name: "Senior Developer",
      }),
    } as unknown as NextRequest;

    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(expectedRole);
  });

  it("should return 404 when role does not exist", async () => {
    vi.mocked(storage.fileExists).mockResolvedValue(false);

    const params = Promise.resolve({ id: "role-1" });
    const request = {
      json: async () => ({
        name: "Senior Developer",
      }),
    } as unknown as NextRequest;

    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Role not found");
    expect(data.message).toContain("Role with ID 'role-1' does not exist");
  });

  it("should return 404 when readJSON returns null", async () => {
    vi.mocked(storage.fileExists).mockResolvedValue(true);
    vi.mocked(storage.readJSON).mockResolvedValue(null);

    const params = Promise.resolve({ id: "role-1" });
    const request = {
      json: async () => ({
        name: "Senior Developer",
      }),
    } as unknown as NextRequest;

    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Role not found");
  });

  it("should return 400 if name is not a string", async () => {
    vi.mocked(storage.fileExists).mockResolvedValue(true);

    const params = Promise.resolve({ id: "role-1" });
    const request = {
      json: async () => ({
        name: 123,
      }),
    } as unknown as NextRequest;

    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid input");
    expect(data.message).toContain("Role name must be a string");
  });

  it("should return 400 if model is not a string", async () => {
    vi.mocked(storage.fileExists).mockResolvedValue(true);

    const params = Promise.resolve({ id: "role-1" });
    const request = {
      json: async () => ({
        model: 123,
      }),
    } as unknown as NextRequest;

    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid input");
    expect(data.message).toContain("Role model must be a string");
  });

  it("should return 500 on error", async () => {
    vi.mocked(storage.fileExists).mockRejectedValue(new Error("Update error"));

    const params = Promise.resolve({ id: "role-1" });
    const request = {
      json: async () => ({
        name: "Senior Developer",
      }),
    } as unknown as NextRequest;

    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to update role");
    expect(data.message).toContain("Update error");
  });
});

describe("DELETE /api/roles/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should delete role successfully", async () => {
    vi.mocked(storage.fileExists).mockResolvedValue(true);
    vi.mocked(storage.deleteFile).mockResolvedValue();

    const params = Promise.resolve({ id: "role-1" });
    const request = {} as unknown as NextRequest;

    const response = await DELETE(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe("Role deleted successfully");
    expect(data.id).toBe("role-1");
    expect(storage.fileExists).toHaveBeenCalledWith("data/roles/role-1.json");
    expect(storage.deleteFile).toHaveBeenCalledWith("data/roles/role-1.json");
  });

  it("should return 404 when role does not exist", async () => {
    vi.mocked(storage.fileExists).mockResolvedValue(false);

    const params = Promise.resolve({ id: "role-1" });
    const request = {} as unknown as NextRequest;

    const response = await DELETE(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Role not found");
    expect(data.message).toContain("Role with ID 'role-1' does not exist");
  });

  it("should return 500 on error", async () => {
    vi.mocked(storage.fileExists).mockRejectedValue(new Error("Delete error"));

    const params = Promise.resolve({ id: "role-1" });
    const request = {} as unknown as NextRequest;

    const response = await DELETE(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to delete role");
    expect(data.message).toContain("Delete error");
  });
});
