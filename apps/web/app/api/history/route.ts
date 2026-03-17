import { historyManager } from "@/lib/history";
import type { HistoryMetadata } from "@/lib/history";
import {
  handleValidationError,
  handleSuccess,
  withErrorHandler,
} from "@/lib/api/error-handler";
import { NextRequest } from "next/server";

/**
 * GET /api/history
 * Returns filtered list of execution history
 *
 * Query parameters:
 * - level?: "console" | "project" - Filter by level
 * - prdId?: string - Filter by PRD ID
 * - role?: string - Filter by role
 * - startDate?: number - Filter by start date (timestamp)
 * - endDate?: number - Filter by end date (timestamp)
 * - limit?: number - Limit number of results (default: 50)
 * - offset?: number - Offset for pagination (default: 0)
 *
 * Returns:
 * - Array of history metadata records
 */
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const searchParams = request.nextUrl.searchParams;
    const level = searchParams.get("level") as "console" | "project" | null;
    const prdId = searchParams.get("prdId");
    const role = searchParams.get("role");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");

    // Validate level parameter
    if (level && level !== "console" && level !== "project") {
      return handleValidationError("level must be either 'console' or 'project'", { field: "level" });
    }

    // Parse numeric parameters
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    const startDateNum = startDate ? parseInt(startDate, 10) : 0;
    const endDateNum = endDate ? parseInt(endDate, 10) : Date.now();

    // Fetch all history records
    const allRecords: HistoryMetadata[] = await fetchAllHistory();

    // Apply filters
    let filteredRecords = allRecords;

    if (level) {
      filteredRecords = filteredRecords.filter((r) => r.level === level);
    }

    if (prdId) {
      filteredRecords = filteredRecords.filter((r) => r.prdId === prdId);
    }

    if (role) {
      filteredRecords = filteredRecords.filter((r) => r.role === role);
    }

    if (startDate) {
      filteredRecords = filteredRecords.filter(
        (r) => r.timestamp >= startDateNum
      );
    }

    if (endDate) {
      filteredRecords = filteredRecords.filter(
        (r) => r.timestamp <= endDateNum
      );
    }

    // Sort by timestamp descending
    filteredRecords.sort((a, b) => b.timestamp - a.timestamp);

    // Apply pagination
    const paginatedRecords = filteredRecords.slice(
      offsetNum,
      offsetNum + limitNum
    );

    return handleSuccess({
      records: paginatedRecords,
      total: filteredRecords.length,
      limit: limitNum,
      offset: offsetNum,
    });
  }, "GET /api/history");
}

/**
 * Fetch all history records from both console and project levels
 */
async function fetchAllHistory(): Promise<HistoryMetadata[]> {
  const records: HistoryMetadata[] = [];

  // Fetch console history from current and previous year/months
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Search current year and previous year
  for (let year = currentYear; year >= currentYear - 1; year--) {
    for (let month = 12; month >= 1; month--) {
      // Skip future months in current year
      if (year === currentYear && month > currentMonth) {
        continue;
      }

      try {
        const monthRecords = await historyManager.getConsoleHistory(
          year,
          month
        );
        // Extract metadata from full records
        records.push(
          ...monthRecords.map(
            ({
              id,
              level,
              timestamp,
              prdId,
              prdTitle,
              role,
              roleDescription,
              modelsUsed,
              duration,
              status,
              startedAt,
              completedAt,
            }) => ({
              id,
              level,
              timestamp,
              prdId,
              prdTitle,
              role,
              roleDescription,
              modelsUsed,
              duration,
              status,
              startedAt,
              completedAt,
            })
          )
        );
      } catch {
        // Ignore errors for non-existent months
      }
    }
  }

  // Fetch project history
  try {
    const projects = await historyManager.listProjects();
    for (const project of projects) {
      try {
        const projectRecords = await historyManager.getProjectHistory(project);
        // Extract metadata from full records
        records.push(
          ...projectRecords.map(
            ({
              id,
              level,
              timestamp,
              prdId,
              prdTitle,
              role,
              roleDescription,
              modelsUsed,
              duration,
              status,
              startedAt,
              completedAt,
            }) => ({
              id,
              level,
              timestamp,
              prdId,
              prdTitle,
              role,
              roleDescription,
              modelsUsed,
              duration,
              status,
              startedAt,
              completedAt,
            })
          )
        );
      } catch {
        // Ignore errors for projects without history
      }
    }
  } catch {
    // Ignore errors listing projects
  }

  return records;
}
