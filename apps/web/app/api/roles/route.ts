import { storage } from '@talos/core';
import type { Role } from "@/types";
import {
  handleSuccess,
  withErrorHandler,
} from "@/lib/api/error-handler";

/**
 * GET /api/roles
 * Returns an array of all configured roles
 */
export async function GET() {
  return withErrorHandler(async () => {
    const files = await storage.listFiles("data/roles", ".json");

    const roles: Role[] = [];
    for (const file of files) {
      const role = await storage.readJSON<Role>(`data/roles/${file}`);
      if (role) {
        roles.push(role);
      }
    }

    return handleSuccess(roles);
  }, "GET /api/roles");
}
