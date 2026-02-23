import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/app/_utils/api-utils";
import {
  getTimeEntries,
  getAllTimeEntries,
  startTimeEntry,
  startCategoryEntry,
  addManualEntry,
  addManualCategoryEntry,
} from "@/app/_server/actions/time-entries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withApiAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const taskId = searchParams.get("taskId");

      if (taskId) {
        const result = await getTimeEntries(taskId);
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json(result.data);
      }

      // No taskId — return all entries globally
      const result = await getAllTimeEntries();
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
      return NextResponse.json(result.data);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to fetch time entries" },
        { status: 500 },
      );
    }
  });
}

export async function POST(request: NextRequest) {
  return withApiAuth(request, async () => {
    try {
      const body = await request.json();
      const { taskId, category, description = "", durationMin, dateStr } = body;

      if (!taskId && !category) {
        return NextResponse.json(
          { error: "taskId or category is required" },
          { status: 400 },
        );
      }

      // Manual entry (durationMin provided)
      if (durationMin !== undefined) {
        const date = dateStr || new Date().toISOString().split("T")[0];
        if (taskId) {
          const result = await addManualEntry(taskId, description, date, durationMin);
          if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
          }
          return NextResponse.json({ success: true, data: result.data }, { status: 201 });
        }
        const result = await addManualCategoryEntry(category, description, date, durationMin);
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true, data: result.data }, { status: 201 });
      }

      // Start timer
      if (taskId) {
        const result = await startTimeEntry(taskId, description);
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true, data: result.data }, { status: 201 });
      }

      const result = await startCategoryEntry(category, description);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, data: result.data }, { status: 201 });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Internal server error" },
        { status: 500 },
      );
    }
  });
}
