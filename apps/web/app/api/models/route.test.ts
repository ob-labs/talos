import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET, POST } from "./route";
import { storage } from "@talos/core";
import { NextRequest } from "next/server";
import type { ModelConfig, ModelProvider } from "@/types";

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

describe("GET /api/models", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return empty array when no models exist", async () => {
    vi.mocked(storage.listFiles).mockResolvedValue([]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual([]);
    expect(storage.listFiles).toHaveBeenCalledWith("data/models", ".json");
  });

  it("should return array of models with masked API keys", async () => {
    const mockModel1: ModelConfig = {
      id: "claude-default",
      provider: "claude",
      apiKey: "sk-ant-test-key-123",
      model: "claude-3-5-sonnet-20241022",
      enabled: true,
    };

    const mockModel2: ModelConfig = {
      id: "openai-gpt4",
      provider: "openai",
      apiKey: "sk-openai-test-key-456",
      model: "gpt-4",
      enabled: false,
    };

    vi.mocked(storage.listFiles).mockResolvedValue(["claude-default.json", "openai-gpt4.json"]);
    vi.mocked(storage.readJSON)
      .mockResolvedValueOnce(mockModel1)
      .mockResolvedValueOnce(mockModel2);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(data[0]).toMatchObject({
      ...mockModel1,
      apiKey: "***",
    });
    expect(data[1]).toMatchObject({
      ...mockModel2,
      apiKey: "***",
    });
  });

  it("should mask empty API key as empty string", async () => {
    const mockModel: ModelConfig = {
      id: "test-model",
      provider: "claude",
      apiKey: "",
      model: "claude-3-5-sonnet-20241022",
      enabled: true,
    };

    vi.mocked(storage.listFiles).mockResolvedValue(["test-model.json"]);
    vi.mocked(storage.readJSON).mockResolvedValueOnce(mockModel);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data[0].apiKey).toBe("");
  });

  it("should skip models that return null", async () => {
    const mockModel: ModelConfig = {
      id: "test-model",
      provider: "claude",
      apiKey: "sk-ant-test-key",
      model: "claude-3-5-sonnet-20241022",
      enabled: true,
    };

    vi.mocked(storage.listFiles).mockResolvedValue(["test-model.json", "invalid-model.json"]);
    vi.mocked(storage.readJSON)
      .mockResolvedValueOnce(mockModel)
      .mockResolvedValueOnce(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe("test-model");
  });

  it("should handle storage errors", async () => {
    vi.mocked(storage.listFiles).mockRejectedValue(new Error("Storage error"));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to read models");
    expect(data.message).toBe("Storage error");
  });
});

describe("POST /api/models", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should create model with valid input", async () => {
    const modelData: ModelConfig = {
      id: "claude-default",
      provider: "claude",
      apiKey: "sk-ant-test-key",
      model: "claude-3-5-sonnet-20241022",
      enabled: true,
    };

    vi.mocked(storage.fileExists).mockResolvedValue(false);
    vi.mocked(storage.writeJSON).mockResolvedValue(undefined);

    const request = new NextRequest("http://localhost:3000/api/models", {
      method: "POST",
      body: JSON.stringify(modelData),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toMatchObject({
      id: "claude-default",
      provider: "claude",
      apiKey: "***",
      model: "claude-3-5-sonnet-20241022",
      enabled: true,
    });
    expect(storage.writeJSON).toHaveBeenCalledWith("data/models/claude-default.json", modelData);
  });

  it("should create model with default enabled=true", async () => {
    const modelData = {
      id: "claude-default",
      provider: "claude",
      apiKey: "sk-ant-test-key",
      model: "claude-3-5-sonnet-20241022",
    };

    vi.mocked(storage.fileExists).mockResolvedValue(false);
    vi.mocked(storage.writeJSON).mockResolvedValue(undefined);

    const request = new NextRequest("http://localhost:3000/api/models", {
      method: "POST",
      body: JSON.stringify(modelData),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.enabled).toBe(true);
    expect(storage.writeJSON).toHaveBeenCalledWith(
      "data/models/claude-default.json",
      expect.objectContaining({ enabled: true })
    );
  });

  it("should create model with optional endpoint", async () => {
    const modelData: ModelConfig = {
      id: "custom-openai",
      provider: "openai",
      apiKey: "sk-test-key",
      endpoint: "https://custom.endpoint.com",
      model: "gpt-4",
      enabled: true,
    };

    vi.mocked(storage.fileExists).mockResolvedValue(false);
    vi.mocked(storage.writeJSON).mockResolvedValue(undefined);

    const request = new NextRequest("http://localhost:3000/api/models", {
      method: "POST",
      body: JSON.stringify(modelData),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.endpoint).toBe("https://custom.endpoint.com");
  });

  it("should return 400 when id is missing", async () => {
    const modelData = {
      provider: "claude",
      apiKey: "sk-ant-test-key",
      model: "claude-3-5-sonnet-20241022",
    };

    const request = new NextRequest("http://localhost:3000/api/models", {
      method: "POST",
      body: JSON.stringify(modelData),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid input");
    expect(data.message).toBe("Model ID is required and must be a string");
  });

  it("should return 400 when id is not a string", async () => {
    const modelData = {
      id: 123,
      provider: "claude",
      apiKey: "sk-ant-test-key",
      model: "claude-3-5-sonnet-20241022",
    };

    const request = new NextRequest("http://localhost:3000/api/models", {
      method: "POST",
      body: JSON.stringify(modelData),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid input");
  });

  it("should return 400 when provider is missing", async () => {
    const modelData = {
      id: "test-model",
      apiKey: "sk-ant-test-key",
      model: "claude-3-5-sonnet-20241022",
    };

    const request = new NextRequest("http://localhost:3000/api/models", {
      method: "POST",
      body: JSON.stringify(modelData),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Provider is required and must be a string");
  });

  it("should return 400 when provider is invalid", async () => {
    const modelData = {
      id: "test-model",
      provider: "invalid-provider",
      apiKey: "sk-ant-test-key",
      model: "claude-3-5-sonnet-20241022",
    };

    const request = new NextRequest("http://localhost:3000/api/models", {
      method: "POST",
      body: JSON.stringify(modelData),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toContain("Provider must be one of:");
  });

  it("should return 400 when apiKey is missing", async () => {
    const modelData = {
      id: "test-model",
      provider: "claude",
      model: "claude-3-5-sonnet-20241022",
    };

    const request = new NextRequest("http://localhost:3000/api/models", {
      method: "POST",
      body: JSON.stringify(modelData),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("API key is required and must be a string");
  });

  it("should return 400 when model is missing", async () => {
    const modelData = {
      id: "test-model",
      provider: "claude",
      apiKey: "sk-ant-test-key",
    };

    const request = new NextRequest("http://localhost:3000/api/models", {
      method: "POST",
      body: JSON.stringify(modelData),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Model name is required and must be a string");
  });

  it("should return 409 when model already exists", async () => {
    const modelData: ModelConfig = {
      id: "existing-model",
      provider: "claude",
      apiKey: "sk-ant-test-key",
      model: "claude-3-5-sonnet-20241022",
      enabled: true,
    };

    vi.mocked(storage.fileExists).mockResolvedValue(true);

    const request = new NextRequest("http://localhost:3000/api/models", {
      method: "POST",
      body: JSON.stringify(modelData),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe("Model already exists");
    expect(data.message).toContain("existing-model");
  });

  it("should handle storage errors on write", async () => {
    const modelData: ModelConfig = {
      id: "test-model",
      provider: "claude",
      apiKey: "sk-ant-test-key",
      model: "claude-3-5-sonnet-20241022",
      enabled: true,
    };

    vi.mocked(storage.fileExists).mockResolvedValue(false);
    vi.mocked(storage.writeJSON).mockRejectedValue(new Error("Write error"));

    const request = new NextRequest("http://localhost:3000/api/models", {
      method: "POST",
      body: JSON.stringify(modelData),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to create model");
    expect(data.message).toBe("Write error");
  });
});
