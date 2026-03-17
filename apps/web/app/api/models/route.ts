import { storage } from '@talos/core';
import type { ModelConfig } from "@/types";
import {
  handleSuccess,
  withErrorHandler,
} from "@/lib/api/error-handler";

/**
 * GET /api/models
 * Returns an array of all configured models (without API keys for security)
 */
export async function GET() {
  return withErrorHandler(async () => {
    const files = await storage.listFiles("data/models", ".json");

    const models: ModelConfig[] = [];
    for (const file of files) {
      const model = await storage.readJSON<ModelConfig>(`data/models/${file}`);
      if (model) {
        // Don't expose API keys in list endpoint
        models.push({
          ...model,
          apiKey: model.apiKey ? "***" : "",
        });
      }
    }

    return handleSuccess(models);
  }, "GET /api/models");
}
