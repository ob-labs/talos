import { NextRequest, NextResponse } from "next/server";
import { MODEL_ENDPOINTS } from "@/types";

/**
 * POST /api/models/test
 * Tests API connection to a model provider
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, endpoint, apiKey, model } = body;

    // Input validation
    if (!provider || typeof provider !== "string") {
      return NextResponse.json(
        { error: "Invalid input", message: "Provider is required" },
        { status: 400 }
      );
    }

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { error: "Invalid input", message: "API key is required" },
        { status: 400 }
      );
    }

    // Use provided endpoint or default for provider
    const apiEndpoint = endpoint || MODEL_ENDPOINTS[provider as keyof typeof MODEL_ENDPOINTS];

    if (!apiEndpoint) {
      return NextResponse.json(
        { error: "Invalid provider", message: `Unknown provider: ${provider}` },
        { status: 400 }
      );
    }

    // Test connection based on provider
    let success = false;
    let message = "";
    let details: Record<string, unknown> = {};

    switch (provider) {
      case "claude":
        // Test Claude API connection
        try {
          const testResponse = await fetch(`${apiEndpoint}/v1/messages`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: model || "claude-3-5-sonnet-20241022",
              max_tokens: 1,
              messages: [{ role: "user", content: "test" }],
            }),
          });

          if (testResponse.ok) {
            success = true;
            message = "Connection successful";
          } else {
            const errorData = await testResponse.json().catch(() => ({}));
            success = false;
            message = `Connection failed: ${testResponse.statusText}`;
            details = {
              status: testResponse.status,
              error: errorData,
            };
          }
        } catch (error) {
          success = false;
          message = `Connection error: ${(error as Error).message}`;
        }
        break;

      case "openai":
        // Test OpenAI API connection
        try {
          const testResponse = await fetch(`${apiEndpoint}/models`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
          });

          if (testResponse.ok) {
            success = true;
            message = "Connection successful";
          } else {
            const errorData = await testResponse.json().catch(() => ({}));
            success = false;
            message = `Connection failed: ${testResponse.statusText}`;
            details = {
              status: testResponse.status,
              error: errorData,
            };
          }
        } catch (error) {
          success = false;
          message = `Connection error: ${(error as Error).message}`;
        }
        break;

      case "glm":
      case "qwen":
        // For GLM and Qwen, we'll do a basic validation
        // Actual API testing would require provider-specific endpoints
        if (apiKey && apiKey.length > 10) {
          success = true;
          message = "API key format validated (provider-specific testing not implemented)";
          details = {
            note: "Full API testing requires provider-specific implementation",
          };
        } else {
          success = false;
          message = "Invalid API key format";
        }
        break;

      default:
        return NextResponse.json(
          { error: "Invalid provider", message: `Provider '${provider}' not supported` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success,
      message,
      provider,
      endpoint: apiEndpoint,
      ...(Object.keys(details).length > 0 && { details }),
    });
  } catch (error) {
    console.error("Error testing model connection:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to test connection",
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
