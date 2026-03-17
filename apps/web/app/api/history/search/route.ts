import { NextRequest, NextResponse } from "next/server";
import { historyManager } from "@/lib/history";
import type { HistoryMetadata } from "@/lib/history";

/**
 * GET /api/history/search
 * Searches execution history by PRD name or task description
 *
 * Query parameters:
 * - q: string - Search query (searches PRD title and task descriptions)
 * - level?: "console" | "project" - Filter by level
 * - limit?: number - Limit number of results (default: 20)
 * - offset?: number - Offset for pagination (default: 0)
 *
 * Returns:
 * - Array of matching history metadata records
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");
    const level = searchParams.get("level") as "console" | "project" | null;
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");

    // Validate query parameter
    if (!query) {
      return NextResponse.json(
        {
          error: "Invalid input",
          message: "Search query 'q' is required",
        },
        { status: 400 }
      );
    }

    if (query.trim().length === 0) {
      return NextResponse.json(
        {
          error: "Invalid input",
          message: "Search query cannot be empty",
        },
        { status: 400 }
      );
    }

    // Validate level parameter
    if (level && level !== "console" && level !== "project") {
      return NextResponse.json(
        {
          error: "Invalid input",
          message: "level must be either 'console' or 'project'",
        },
        { status: 400 }
      );
    }

    // Parse numeric parameters
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const offsetNum = offset ? parseInt(offset, 10) : 0;

    // Fetch all history records with full details
    const allRecords = await fetchAllHistoryWithTasks();

    // Filter by level if specified
    let filteredRecords = allRecords;
    if (level) {
      filteredRecords = filteredRecords.filter((r) => r.level === level);
    }

    // Search by PRD title or task descriptions
    const searchLower = query.toLowerCase();
    const matchingRecords = filteredRecords.filter((record) => {
      // Search in PRD title
      if (record.prdTitle.toLowerCase().includes(searchLower)) {
        return true;
      }

      // Search in PRD ID
      if (record.prdId.toLowerCase().includes(searchLower)) {
        return true;
      }

      // Search in task descriptions
      if (record.tasks) {
        for (const task of record.tasks) {
          if (
            task.description?.toLowerCase().includes(searchLower) ||
            task.title?.toLowerCase().includes(searchLower)
          ) {
            return true;
          }
        }
      }

      return false;
    });

    // Sort by timestamp descending
    matchingRecords.sort((a, b) => b.timestamp - a.timestamp);

    // Apply pagination
    const paginatedRecords = matchingRecords.slice(
      offsetNum,
      offsetNum + limitNum
    );

    // Return metadata only for pagination results
    const results: HistoryMetadata[] = paginatedRecords.map(
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
    );

    return NextResponse.json({
      results,
      total: matchingRecords.length,
      query,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    console.error("Error searching history:", error);
    return NextResponse.json(
      {
        error: "Failed to search history",
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

/**
 * Fetch all history records with full task details for searching
 */
async function fetchAllHistoryWithTasks() {
  const records = [];

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
        records.push(...monthRecords);
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
        records.push(...projectRecords);
      } catch {
        // Ignore errors for projects without history
      }
    }
  } catch {
    // Ignore errors listing projects
  }

  return records;
}
