import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

// Mock global fetch
global.fetch = vi.fn();

describe("POST /api/models/test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Claude provider tests", () => {
    it("should test Claude connection successfully", async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "test", type: "message" }),
      });

      const testData = {
        provider: "claude",
        apiKey: "sk-ant-test-key",
        model: "claude-3-5-sonnet-20241022",
      };

      const request = new NextRequest("http://localhost:3000/api/models/test", {
        method: "POST",
        body: JSON.stringify(testData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe("Connection successful");
      expect(data.provider).toBe("claude");
      expect(data.endpoint).toBe("https://api.anthropic.com");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.anthropic.com/v1/messages",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "x-api-key": "sk-ant-test-key",
            "anthropic-version": "2023-06-01",
          }),
          body: expect.stringContaining("claude-3-5-sonnet-20241022"),
        })
      );
    });

    it("should test Claude connection with custom endpoint", async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "test" }),
      });

      const testData = {
        provider: "claude",
        apiKey: "sk-ant-test-key",
        endpoint: "https://custom.endpoint.com",
        model: "claude-3-5-sonnet-20241022",
      };

      const request = new NextRequest("http://localhost:3000/api/models/test", {
        method: "POST",
        body: JSON.stringify(testData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.endpoint).toBe("https://custom.endpoint.com");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://custom.endpoint.com/v1/messages",
        expect.any(Object)
      );
    });

    it("should handle Claude connection failure", async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({ error: { message: "Invalid API key" } }),
      });

      const testData = {
        provider: "claude",
        apiKey: "invalid-key",
        model: "claude-3-5-sonnet-20241022",
      };

      const request = new NextRequest("http://localhost:3000/api/models/test", {
        method: "POST",
        body: JSON.stringify(testData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(false);
      expect(data.message).toContain("Connection failed");
      expect(data.details).toMatchObject({
        status: 401,
        error: { error: { message: "Invalid API key" } },
      });
    });

    it("should handle Claude connection error", async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Network error")
      );

      const testData = {
        provider: "claude",
        apiKey: "sk-ant-test-key",
        model: "claude-3-5-sonnet-20241022",
      };

      const request = new NextRequest("http://localhost:3000/api/models/test", {
        method: "POST",
        body: JSON.stringify(testData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(false);
      expect(data.message).toBe("Connection error: Network error");
    });
  });

  describe("OpenAI provider tests", () => {
    it("should test OpenAI connection successfully", async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ object: "list", data: [] }),
      });

      const testData = {
        provider: "openai",
        apiKey: "sk-openai-test-key",
      };

      const request = new NextRequest("http://localhost:3000/api/models/test", {
        method: "POST",
        body: JSON.stringify(testData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe("Connection successful");
      expect(data.provider).toBe("openai");
      expect(data.endpoint).toBe("https://api.openai.com/v1");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.openai.com/v1/models",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer sk-openai-test-key",
          }),
        })
      );
    });

    it("should test OpenAI connection with custom endpoint", async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ object: "list", data: [] }),
      });

      const testData = {
        provider: "openai",
        apiKey: "sk-openai-test-key",
        endpoint: "https://custom.openai.com",
      };

      const request = new NextRequest("http://localhost:3000/api/models/test", {
        method: "POST",
        body: JSON.stringify(testData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.endpoint).toBe("https://custom.openai.com");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://custom.openai.com/models",
        expect.any(Object)
      );
    });

    it("should handle OpenAI connection failure", async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({ error: { message: "Invalid API key" } }),
      });

      const testData = {
        provider: "openai",
        apiKey: "invalid-key",
      };

      const request = new NextRequest("http://localhost:3000/api/models/test", {
        method: "POST",
        body: JSON.stringify(testData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(false);
      expect(data.message).toContain("Connection failed");
      expect(data.details).toMatchObject({
        status: 401,
      });
    });
  });

  describe("GLM provider tests", () => {
    it("should validate GLM API key format", async () => {
      const testData = {
        provider: "glm",
        apiKey: "valid-glm-api-key-12345",
      };

      const request = new NextRequest("http://localhost:3000/api/models/test", {
        method: "POST",
        body: JSON.stringify(testData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain("API key format validated");
      expect(data.details).toMatchObject({
        note: "Full API testing requires provider-specific implementation",
      });
    });

    it("should reject invalid GLM API key format", async () => {
      const testData = {
        provider: "glm",
        apiKey: "short",
      };

      const request = new NextRequest("http://localhost:3000/api/models/test", {
        method: "POST",
        body: JSON.stringify(testData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(false);
      expect(data.message).toBe("Invalid API key format");
    });
  });

  describe("Qwen provider tests", () => {
    it("should validate Qwen API key format", async () => {
      const testData = {
        provider: "qwen",
        apiKey: "valid-qwen-api-key-67890",
      };

      const request = new NextRequest("http://localhost:3000/api/models/test", {
        method: "POST",
        body: JSON.stringify(testData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain("API key format validated");
      expect(data.details).toMatchObject({
        note: "Full API testing requires provider-specific implementation",
      });
    });

    it("should reject invalid Qwen API key format", async () => {
      const testData = {
        provider: "qwen",
        apiKey: "short",
      };

      const request = new NextRequest("http://localhost:3000/api/models/test", {
        method: "POST",
        body: JSON.stringify(testData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(false);
      expect(data.message).toBe("Invalid API key format");
    });
  });

  describe("Validation tests", () => {
    it("should return 400 when provider is missing", async () => {
      const testData = {
        apiKey: "sk-test-key",
      };

      const request = new NextRequest("http://localhost:3000/api/models/test", {
        method: "POST",
        body: JSON.stringify(testData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid input");
      expect(data.message).toBe("Provider is required");
    });

    it("should return 400 when provider is not a string", async () => {
      const testData = {
        provider: 123,
        apiKey: "sk-test-key",
      };

      const request = new NextRequest("http://localhost:3000/api/models/test", {
        method: "POST",
        body: JSON.stringify(testData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid input");
      expect(data.message).toBe("Provider is required");
    });

    it("should return 400 when apiKey is missing", async () => {
      const testData = {
        provider: "claude",
      };

      const request = new NextRequest("http://localhost:3000/api/models/test", {
        method: "POST",
        body: JSON.stringify(testData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid input");
      expect(data.message).toBe("API key is required");
    });

    it("should return 400 when apiKey is not a string", async () => {
      const testData = {
        provider: "claude",
        apiKey: 123,
      };

      const request = new NextRequest("http://localhost:3000/api/models/test", {
        method: "POST",
        body: JSON.stringify(testData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid input");
      expect(data.message).toBe("API key is required");
    });

    it("should return 400 for unknown provider", async () => {
      const testData = {
        provider: "unknown-provider",
        apiKey: "test-key",
      };

      const request = new NextRequest("http://localhost:3000/api/models/test", {
        method: "POST",
        body: JSON.stringify(testData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid provider");
      expect(data.message).toContain("Unknown provider: unknown-provider");
    });
  });

  describe("Error handling tests", () => {
    it("should handle JSON parse errors gracefully", async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      const testData = {
        provider: "claude",
        apiKey: "sk-ant-test-key",
        model: "claude-3-5-sonnet-20241022",
      };

      const request = new NextRequest("http://localhost:3000/api/models/test", {
        method: "POST",
        body: JSON.stringify(testData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(false);
      expect(data.details).toMatchObject({
        status: 401,
        error: {},
      });
    });

    it("should handle unexpected errors", async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      const testData = {
        provider: "claude",
        apiKey: "sk-ant-test-key",
        model: "claude-3-5-sonnet-20241022",
      };

      const request = new NextRequest("http://localhost:3000/api/models/test", {
        method: "POST",
        body: JSON.stringify(testData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(false);
      expect(data.message).toContain("Connection error");
    });
  });
});
