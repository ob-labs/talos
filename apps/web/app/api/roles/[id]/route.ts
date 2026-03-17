import { storage } from '@talos/core';
import type { Role } from "@/types";
import {
  handleNotFoundError,
  handleSuccess,
  withErrorHandler,
} from "@/lib/api/error-handler";
import { NextRequest } from "next/server";

/**
 * GET /api/roles/[id]
 * Returns a single role by ID or 404 if not found
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withErrorHandler(async () => {
    const { id } = await params;
    const rolePath = `data/roles/${id}.json`;
    const exists = await storage.fileExists(rolePath);

    if (!exists) {
      return handleNotFoundError("Role", id);
    }

    const role = await storage.readJSON<Role>(rolePath);

    if (!role) {
      return handleNotFoundError("Role", id);
    }

    return handleSuccess(role);
  }, "GET /api/roles/[id]");
}
