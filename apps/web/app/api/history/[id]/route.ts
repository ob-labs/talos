import { NextRequest, NextResponse } from "next/server";
import { historyManager } from "@/lib/history";

/**
 * GET /api/history/[id]
 * Returns a single execution history record by ID
 *
 * Path parameters:
 * - id: string - History record ID
 *
 * Returns:
 * - Complete history record with metadata and tasks
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Invalid input", message: "History ID is required" },
        { status: 400 }
      );
    }

    const record = await historyManager.loadHistory(id);

    if (!record) {
      return NextResponse.json(
        { error: "Not found", message: `History record with ID '${id}' does not exist` },
        { status: 404 }
      );
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error("Error loading history:", error);
    return NextResponse.json(
      {
        error: "Failed to load history",
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/history/[id]
 * Deletes a single execution history record by ID
 *
 * Path parameters:
 * - id: string - History record ID
 *
 * Returns:
 * - Success message
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Invalid input", message: "History ID is required" },
        { status: 400 }
      );
    }

    const success = await historyManager.deleteHistory(id);

    if (!success) {
      return NextResponse.json(
        { error: "Not found", message: `History record with ID '${id}' does not exist` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "History record deleted successfully",
      id,
    });
  } catch (error) {
    console.error("Error deleting history:", error);
    return NextResponse.json(
      {
        error: "Failed to delete history",
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
