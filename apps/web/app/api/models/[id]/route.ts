import { storage } from '@talos/core';
import type { ModelConfig } from "@/types";
import {
  handleNotFoundError,
  handleSuccess,
  withErrorHandler,
} from "@/lib/api/error-handler";
import { NextRequest } from "next/server";

/**
 * GET /api/models/[id]
 * Returns a single model configuration by ID or 404 if not found
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withErrorHandler(async () => {
    const { id } = await params;
    const modelPath = `data/models/${id}.json`;
    const exists = await storage.fileExists(modelPath);

    if (!exists) {
      return handleNotFoundError("Model", id);
    }

    const model = await storage.readJSON<ModelConfig>(modelPath);

    if (!model) {
      return handleNotFoundError("Model", id);
    }

    // Don't expose API key in GET response
    return handleSuccess({
      ...model,
      apiKey: model.apiKey ? "***" : "",
    });
  }, "GET /api/models/[id]");
}
